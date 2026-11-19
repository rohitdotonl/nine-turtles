//! Serves the frontend (built by Vite into `web/dist`) from inside this program.
//!
//! In release builds the files are packed into the program itself, so deploying
//! means copying one file. In debug builds rust-embed reads them from disk, so
//! `npm run build` must have run first (scripts/check.sh does this).

use axum::{
    Router,
    http::{HeaderMap, HeaderValue, StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "../web/dist"]
struct Frontend;

/// Vite gives files in `assets/` a name that changes whenever their content
/// changes, so browsers may keep them forever.
const FOREVER: &str = "public, max-age=31536000, immutable";
/// Everything else (the page itself, fonts) is checked for a new version on
/// each visit, so a new release is picked up the next time nine turtles is opened.
/// Each carries a label of its content (`ETag`), so that check costs a few
/// bytes ("unchanged") instead of the whole file when nothing changed.
const CHECK_EACH_TIME: &str = "no-cache";

pub fn routes<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new().fallback(serve)
}

async fn serve(uri: Uri, asked: HeaderMap) -> Response {
    let path = uri.path().trim_start_matches('/');

    match Frontend::get(path) {
        Some(file) if !path.is_empty() => file_response(path, file, &asked),
        // An API address nine turtles doesn't have (perhaps one an older tab
        // still uses after an update) is "not found", never the app's page.
        _ if path == "api" || path.starts_with("api/") => StatusCode::NOT_FOUND.into_response(),
        // A file-like address that doesn't exist is a real "not found".
        None if path
            .rsplit('/')
            .next()
            .is_some_and(|name| name.contains('.')) =>
        {
            StatusCode::NOT_FOUND.into_response()
        }
        // Any other address is a screen of the single-page app.
        _ => match Frontend::get("index.html") {
            Some(file) => file_response("index.html", file, &asked),
            None => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "nine turtles was built without its frontend. Run scripts/check.sh.",
            )
                .into_response(),
        },
    }
}

fn file_response(path: &str, file: rust_embed::EmbeddedFile, asked: &HeaderMap) -> Response {
    let mime = file.metadata.mimetype();
    let cache = if path.starts_with("assets/") {
        FOREVER
    } else {
        CHECK_EACH_TIME
    };
    let label = content_label(&file.metadata.sha256_hash());
    let unchanged = asked
        .get_all(header::IF_NONE_MATCH)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        // A proxy that compresses the file (Cloudflare) may mark the label weak (`W/`).
        .map(|tag| tag.trim().trim_start_matches("W/"))
        .any(|tag| tag == label || tag == "*");

    let mut response = if unchanged {
        StatusCode::NOT_MODIFIED.into_response()
    } else {
        file.data.into_response()
    };
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(mime) {
        headers.insert(header::CONTENT_TYPE, value);
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
    if let Ok(value) = HeaderValue::from_str(&label) {
        headers.insert(header::ETAG, value);
    }
    response
}

/// The file's label for `ETag`: the start of its content's fingerprint, in quotes.
fn content_label(hash: &[u8; 32]) -> String {
    let hex: String = hash[..12]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("\"{hex}\"")
}
