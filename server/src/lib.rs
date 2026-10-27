//! nine turtles: a quiet, single-user reader for writing on the open web.
//!
//! So far: sign-in, the database file, the status pages, adding feeds,
//! listing and reading their articles, marking them read and starring them,
//! the shared settings, checking feeds in the background (`checking`),
//! folders and unsubscribing (`folders`), tidying many feeds at once
//! (`tidy`), saved searches (`saved_searches`), OPML files (`subscriptions`),
//! instant updates from WebSub hubs (`websub`), syncing with other feed
//! readers (`apps`, `greader`), backups (`backup`, `storage`), and the
//! reader's rules and mutes (`rules`), the readers and sign-up (`people`),
//! and what email makes possible (`email`, `accounts`): confirming an
//! address, a new password, a changed email, and deleting an account,
//! paying through Dodo Payments (`payments`), the website's feed
//! finder (`finder`), and the reader's own AI assistant connected over MCP
//! (`assistants`, `mcp`).
//! The frontend is packed into this program (see `assets`).

pub mod accounts;
pub mod admin;
pub mod apps;
pub mod assets;
pub mod assistants;
pub mod auth;
pub mod backup;
pub mod checking;
pub mod cleanup;
pub mod collections;
pub mod config;
pub mod db;
pub mod discover;
pub mod email;
pub mod feed;
pub mod feeds;
pub mod fetch;
pub mod finder;
pub mod folders;
pub mod frequency;
pub mod greader;
pub mod health;
pub mod log;
pub mod marks;
pub mod mcp;
pub mod newsletter;
pub mod newsletters;
pub mod password;
pub mod payments;
pub mod people;
pub mod recent;
pub mod rules;
pub mod saved_searches;
pub mod search;
pub mod security;
pub mod settings;
pub mod star_import;
pub mod starred;
pub mod status;
pub mod storage;
pub mod subscriptions;
pub mod tidy;
pub mod unread;
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
    /// Wrong passwords for each account. Held only to check and record a
    /// try, never while a password is checked.
    pub limiter: Arc<Mutex<auth::Limiters>>,
    /// How many passwords may be checked at once (each check takes about
    /// 19 MB), with a place kept for the owner's.
    pub password_checks: Arc<auth::PasswordChecks>,
    /// Sign-up tries in the last hour. Held while a new reader's password is
    /// scrambled, so sign-ups go one at a time.
    pub sign_ups: Arc<Mutex<people::SignUpTries>>,
    /// The website's feed finder: its remembered answers and its limits.
    pub finder: Arc<finder::Finder>,
    pub wrong_passwords: Arc<AtomicU64>,
    /// Seconds since 1970 (UTC) when this run of nine turtles started.
    pub started_at: i64,
    /// When background checking last finished a round; 0 before the first.
    pub last_round: Arc<AtomicI64>,
    /// Where backups go; `None` when the backup settings aren't set.
    pub storage: Option<storage::Storage>,
    /// The name of the newest nightly backup known to be stored.
    pub latest_backup: Arc<std::sync::Mutex<Option<String>>>,
    /// Sends email; `None` when the email settings (or the public address
    /// every link starts with) aren't set, and then nothing is sent.
    pub mailer: Option<email::Mailer>,
    /// How often assistants register, call tools and add feeds (`mcp`).
    pub assistant_limits: Arc<assistants::Limits>,
}

/// Opens the database and builds the whole web application. Tests call it
/// directly with their own settings; background checking isn't started.
pub async fn app(config: Config) -> Result<Router, String> {
    Ok(router(state(config).await?))
}

/// Opens the database (restoring it from a backup first if asked) and gets
/// everything ready. `main` then starts background checking (`checking::run`)
/// and nightly backups (`backup::run`), and serves the `router`.
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

    let storage = config
        .backup
        .clone()
        .map(storage::Storage::new)
        .transpose()?;
    if let Some(name) = &config.restore_from {
        backup::restore_if_empty(&config.data_dir, storage.as_ref(), name).await?;
    }

    let mailer = match (&config.smtp, &config.public_url) {
        (Some(smtp), Some(base)) => Some(email::Mailer::smtp(smtp, base.clone())?),
        // Also refused when the settings are read (`Config::from_env`).
        (Some(_), None) => {
            return Err(
                "the email settings are set but NINE_TURTLES_PUBLIC_URL isn't: every link in an \
                 email starts with that address, so set it too (docs/operations/email.md)"
                    .to_owned(),
            );
        }
        (None, _) => None,
    };

    let db = db::open_with_backup(&config.data_dir, storage.as_ref()).await?;
    if config.payments.is_some() {
        payments::note_switched_on(&db, now())
            .await
            .map_err(|error| format!("couldn't note that payments are on: {error}"))?;
    }
    let state = AppState {
        db,
        http: fetch::client(config.local_feeds_allowed)?,
        config: Arc::new(config),
        limiter: Arc::default(),
        password_checks: Arc::default(),
        sign_ups: Arc::default(),
        finder: Arc::default(),
        wrong_passwords: Arc::default(),
        started_at: now(),
        last_round: Arc::default(),
        storage,
        latest_backup: Arc::default(),
        mailer,
        assistant_limits: Arc::default(),
    };
    // A new NINE_TURTLES_PASSWORD_HASH wins over a password the owner set
    // by email (decision 0088): their way back that needs no email.
    auth::owner_password_follows_setting(&state.db, &state.config.password)
        .await
        .map_err(|error| format!("couldn't check the owner's password: {error}"))?;
    Ok(state)
}

/// The whole web application.
pub fn router(state: AppState) -> Router {
    let router = Router::new()
        .merge(auth::routes())
        .merge(accounts::routes())
        .merge(admin::routes())
        .merge(apps::routes())
        .merge(assistants::routes())
        .merge(mcp::routes())
        .merge(greader::routes())
        .merge(feeds::routes())
        .merge(finder::routes())
        .merge(folders::routes())
        .merge(health::routes())
        .merge(subscriptions::routes())
        .merge(tidy::routes())
        .merge(marks::routes())
        .merge(recent::routes())
        .merge(frequency::routes())
        .merge(people::routes())
        .merge(payments::routes())
        .merge(rules::routes())
        .merge(search::routes())
        .merge(saved_searches::routes())
        .merge(collections::routes())
        .merge(settings::routes())
        .merge(unread::routes())
        .merge(starred::routes())
        .merge(star_import::routes())
        .merge(status::routes())
        .merge(websub::routes())
        .merge(newsletters::routes())
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
