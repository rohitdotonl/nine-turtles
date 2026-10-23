//! slowfeed: a quiet, single-user reader for writing on the open web.
//!
//! Milestone 1 is only the skeleton: a web server that hands the browser the
//! frontend, which is packed into this program (see `assets`).

pub mod assets;
pub mod search;

use axum::Router;
use tower_http::compression::CompressionLayer;

/// Builds the whole web application. `main` serves it; tests call it directly.
pub fn app() -> Router {
    assets::routes().layer(CompressionLayer::new())
}
