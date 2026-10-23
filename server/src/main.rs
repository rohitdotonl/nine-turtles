use slowfeed::{config::Config, log};

const USAGE: &str = "\
Usage:
  slowfeed                 run slowfeed (settings: docs/operations/settings.md)
  slowfeed set-password    choose the password; prints the line for SLOWFEED_PASSWORD_HASH";

#[tokio::main]
async fn main() {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match arguments.iter().map(String::as_str).collect::<Vec<_>>()[..] {
        [] => serve().await,
        ["set-password"] => {
            let command = tokio::task::spawn_blocking(slowfeed::password::set_password_command);
            tokio::select! {
                finished = command => {
                    if let Ok(Err(message)) | Err(message) = finished.map_err(|error| error.to_string()) {
                        eprintln!("slowfeed: {message}");
                        std::process::exit(1);
                    }
                }
                _ = tokio::signal::ctrl_c() => {
                    // Typing may be hidden at this moment; show it again.
                    slowfeed::password::show_typing();
                    eprintln!();
                    eprintln!("slowfeed: cancelled; nothing was changed");
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
            eprintln!("slowfeed: {message}");
            std::process::exit(2);
        }
    };
    let address = config.listen;

    let state = match slowfeed::state(config).await {
        Ok(state) => state,
        Err(message) => {
            log::problem(&message);
            std::process::exit(1);
        }
    };
    tokio::spawn(slowfeed::checking::run(state.clone()));
    let app = slowfeed::router(state);
    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            log::problem(&format!("can't listen on {address}: {error}"));
            std::process::exit(1);
        }
    };

    log::info(&format!(
        "version {} is running at http://{address}",
        slowfeed::VERSION
    ));

    if let Err(error) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        log::problem(&format!("the web server stopped: {error}"));
        std::process::exit(1);
    }
}

/// Finishes the requests in progress when the host asks slowfeed to stop.
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
