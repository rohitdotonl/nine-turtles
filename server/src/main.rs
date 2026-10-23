use std::net::SocketAddr;

/// Where slowfeed listens when `SLOWFEED_LISTEN` isn't set. Only this computer
/// can reach it; hosting sets the variable (Milestone 2).
const DEFAULT_LISTEN: &str = "127.0.0.1:8080";

#[tokio::main]
async fn main() {
    let listen = std::env::var("SLOWFEED_LISTEN").unwrap_or_else(|_| DEFAULT_LISTEN.to_owned());
    let address: SocketAddr = match listen.parse() {
        Ok(address) => address,
        Err(_) => {
            eprintln!("slowfeed: SLOWFEED_LISTEN must look like 127.0.0.1:8080, got {listen:?}");
            std::process::exit(2);
        }
    };

    let listener = match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("slowfeed: can't listen on {address}: {error}");
            std::process::exit(1);
        }
    };

    // Proper logging (the `tracing` library) arrives in Milestone 2.
    eprintln!("slowfeed is running at http://{address}");

    if let Err(error) = axum::serve(listener, slowfeed::app())
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        eprintln!("slowfeed: the web server stopped: {error}");
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
