//! slowfeed: a quiet, single-user reader for writing on the open web.
//!
//! Milestone 2: sign-in, the database file, and the status pages. The
//! frontend is packed into this program (see `assets`).

pub mod assets;
pub mod auth;
pub mod config;
pub mod db;
pub mod log;
pub mod password;
pub mod search;
pub mod security;
pub mod status;

use std::sync::{Arc, atomic::AtomicU64};

use axum::Router;
use sqlx::SqlitePool;
use tokio::sync::Mutex;
use tower_http::compression::CompressionLayer;

use crate::config::{Config, PasswordSetting};

/// Which build this is. The container image sets `SLOWFEED_VERSION` to the
/// date and commit it was built from; a build on a computer says "-dev".
pub const VERSION: &str = match option_env!("SLOWFEED_VERSION") {
    Some(version) if !version.is_empty() => version,
    _ => concat!(env!("CARGO_PKG_VERSION"), "-dev"),
};

/// What every request handler can reach. Cheap to copy: the parts are shared.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: SqlitePool,
    pub limiter: Arc<Mutex<auth::Limiter>>,
    pub wrong_passwords: Arc<AtomicU64>,
    /// Seconds since 1970 (UTC) when this run of slowfeed started.
    pub started_at: i64,
}

/// Opens the database and builds the whole web application. `main` serves
/// it; tests call it directly with their own settings.
pub async fn app(config: Config) -> Result<Router, String> {
    match &config.password {
        PasswordSetting::Set(_) => {}
        PasswordSetting::Missing => log::problem(
            "no password is set yet (SLOWFEED_PASSWORD_HASH), so nobody can sign in; \
             see docs/operations/render-setup.md",
        ),
        PasswordSetting::Invalid => log::problem(
            "SLOWFEED_PASSWORD_HASH isn't a line made by `slowfeed set-password`, so nobody \
             can sign in; run it again and paste the whole line",
        ),
    }

    let state = AppState {
        db: db::open(&config.data_dir).await?,
        config: Arc::new(config),
        limiter: Arc::default(),
        wrong_passwords: Arc::default(),
        started_at: now(),
    };

    let router = Router::new()
        .merge(auth::routes())
        .merge(status::routes())
        .merge(assets::routes())
        .with_state(state);
    Ok(security::apply(router).layer(CompressionLayer::new()))
}

/// Seconds since 1970 (UTC), the way slowfeed stores times.
pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_secs()).unwrap_or(i64::MAX)
        })
}
