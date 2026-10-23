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
            if let Err(message) = slowfeed::password::set_password_command() {
                eprintln!("slowfeed: {message}");
                std::process::exit(1);
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

    let app = match slowfeed::app(config).await {
        Ok(app) => app,
        Err(message) => {
            log::problem(&message);
            std::process::exit(1);
        }
    };
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
