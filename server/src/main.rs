use nine_turtles::{config::Config, log};

const USAGE: &str = "\
Usage:
  nine-turtles                run nine turtles (settings: docs/operations/settings.md)
  nine-turtles set-password   choose the password; prints the line for NINE_TURTLES_PASSWORD_HASH";

#[tokio::main]
async fn main() {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match arguments.iter().map(String::as_str).collect::<Vec<_>>()[..] {
        [] => serve().await,
        ["set-password"] => {
            let command = tokio::task::spawn_blocking(nine_turtles::password::set_password_command);
            tokio::select! {
                finished = command => {
                    if let Ok(Err(message)) | Err(message) = finished.map_err(|error| error.to_string()) {
                        eprintln!("nine-turtles: {message}");
                        std::process::exit(1);
                    }
                }
                _ = tokio::signal::ctrl_c() => {
                    // Typing may be hidden at this moment; show it again.
                    nine_turtles::password::show_typing();
                    eprintln!();
                    eprintln!("nine-turtles: cancelled; nothing was changed");
                    std::process::exit(130);
                }
            }
        }
        ["help" | "--help" | "-h"] => println!("{USAGE}"),
        _ => {
            eprintln!("{USAGE}");
            std::process::exit(2);
        }
    }
}

async fn serve() {
    let config = match Config::from_env() {
        Ok(config) => config,
        Err(message) => {
            eprintln!("nine-turtles: {message}");
            std::process::exit(2);
        }
    };
    let address = config.listen;

    let state = match nine_turtles::state(config).await {
        Ok(state) => state,
        Err(message) => {
            log::problem(&message);
            std::process::exit(1);
        }
    };
    tokio::spawn(nine_turtles::checking::run(state.clone()));
    tokio::spawn(nine_turtles::search::catch_up(state.db.clone()));
    let app = nine_turtles::router(state);
    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            log::problem(&format!("can't listen on {address}: {error}"));
            std::process::exit(1);
        }
    };

    log::info(&format!(
        "version {} is running at http://{address}",
        nine_turtles::VERSION
    ));

    if let Err(error) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        log::problem(&format!("the web server stopped: {error}"));
        std::process::exit(1);
    }
}

/// Finishes the requests in progress when the host asks nine turtles to stop.
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut signal) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            signal.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }
}
