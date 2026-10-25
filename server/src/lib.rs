//! nine turtles: a quiet, single-user reader for writing on the open web.
//!
//! So far: sign-in, the database file, the status pages, adding feeds,
//! listing and reading their articles, marking them read and starring them,
//! the shared settings, checking feeds in the background (`checking`),
//! folders and unsubscribing (`folders`), OPML files (`subscriptions`),
//! instant updates from WebSub hubs (`websub`), and syncing with other feed
//! readers (`apps`, `greader`).
//! The frontend is packed into this program (see `assets`).

pub mod apps;
pub mod assets;
pub mod auth;
pub mod checking;
pub mod config;
pub mod db;
pub mod discover;
pub mod feed;
pub mod feeds;
pub mod fetch;
pub mod folders;
pub mod greader;
pub mod health;
pub mod log;
pub mod marks;
pub mod password;
pub mod search;
pub mod security;
pub mod settings;
pub mod starred;
pub mod status;
pub mod subscriptions;
pub mod websub;

use std::sync::{
    Arc,
    atomic::{AtomicI64, AtomicU64},
};

use axum::Router;
use axum::http::{HeaderName, HeaderValue};
use sqlx::SqlitePool;
use tokio::sync::Mutex;
use tower_http::compression::CompressionLayer;
use tower_http::set_header::SetResponseHeaderLayer;

use crate::config::{Config, PasswordSetting};

/// Which build this is. The container image sets `NINE_TURTLES_VERSION` to the
/// date and commit it was built from; a build on a computer says "-dev".
pub const VERSION: &str = match option_env!("NINE_TURTLES_VERSION") {
    Some(version) if !version.is_empty() => version,
    _ => concat!(env!("CARGO_PKG_VERSION"), "-dev"),
};

/// What every request handler can reach. Cheap to copy: the parts are shared.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: SqlitePool,
    /// The one downloader for publishers' websites (see `fetch`).
    pub http: reqwest::Client,
    pub limiter: Arc<Mutex<auth::Limiter>>,
    pub wrong_passwords: Arc<AtomicU64>,
    /// Seconds since 1970 (UTC) when this run of nine turtles started.
    pub started_at: i64,
    /// When background checking last finished a round; 0 before the first.
    pub last_round: Arc<AtomicI64>,
}

/// Opens the database and builds the whole web application. Tests call it
/// directly with their own settings; background checking isn't started.
pub async fn app(config: Config) -> Result<Router, String> {
    Ok(router(state(config).await?))
}

/// Opens the database and gets everything ready. `main` then starts
/// background checking (`checking::run`) and serves the `router`.
pub async fn state(config: Config) -> Result<AppState, String> {
    match &config.password {
        PasswordSetting::Set(_) => {}
        PasswordSetting::Missing => log::problem(
            "no password is set yet (NINE_TURTLES_PASSWORD_HASH), so nobody can sign in; \
             see docs/operations/render-setup.md",
        ),
        PasswordSetting::Invalid => log::problem(
            "NINE_TURTLES_PASSWORD_HASH isn't a line made by `nine-turtles set-password`, so nobody \
             can sign in; run it again and paste the whole line",
        ),
    }

    let state = AppState {
        db: db::open(&config.data_dir).await?,
        http: fetch::client(config.local_feeds_allowed)?,
        config: Arc::new(config),
        limiter: Arc::default(),
        wrong_passwords: Arc::default(),
        started_at: now(),
        last_round: Arc::default(),
    };
    Ok(state)
}

/// The whole web application.
pub fn router(state: AppState) -> Router {
    let router = Router::new()
        .merge(auth::routes())
        .merge(apps::routes())
        .merge(greader::routes())
        .merge(feeds::routes())
        .merge(folders::routes())
        .merge(health::routes())
        .merge(subscriptions::routes())
        .merge(marks::routes())
        .merge(search::routes())
        .merge(settings::routes())
        .merge(starred::routes())
        .merge(status::routes())
        .merge(websub::routes())
        .merge(assets::routes())
        .with_state(state);
    security::apply(router)
        // Every answer says which version sent it, so a tab left open across
        // an update can tell (the reader is asked to reload; SPEC section 18).
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static(VERSION_HEADER),
            HeaderValue::from_static(VERSION),
        ))
        // The header's name before the rename, for a tab opened before it.
        .layer(SetResponseHeaderLayer::overriding(
            HeaderName::from_static(OLD_VERSION_HEADER),
            HeaderValue::from_static(VERSION),
        ))
        .layer(CompressionLayer::new())
}

/// The name of the header that carries `VERSION` on every answer.
pub const VERSION_HEADER: &str = "x-nine-turtles-version";
/// Its name before the rename.
pub const OLD_VERSION_HEADER: &str = "x-slowfeed-version";

/// Seconds since 1970 (UTC), the way nine turtles stores times.
pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_secs()).unwrap_or(i64::MAX)
        })
}
