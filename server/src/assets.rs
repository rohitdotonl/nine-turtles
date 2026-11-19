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
use std::sync::LazyLock;

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
        Some(file) if !path.is_empty() && path != "index.html" => file_response(path, file, &asked),
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
        _ => match PAGE.as_ref() {
            Some(page) => page_response(page, &asked),
            None => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "nine turtles was built without its frontend. Run scripts/check.sh.",
            )
                .into_response(),
        },
    }
}

/// The app's page, with this program's version written into its
/// `nine-turtles-version` tag (decision 0320): the app knows its own version
/// even when the phone opens its kept copy of the page, and so notices when the
/// server is newer. Its label (`ETag`) names the version too, so a check never
/// answers "unchanged" with an older version's page.
struct Page {
    body: Vec<u8>,
    label: String,
}

/// The empty tag in `web/index.html` (as Vite writes it) that the version goes into.
const VERSION_TAG: &str = r#"<meta name="nine-turtles-version" content="">"#;

static PAGE: LazyLock<Option<Page>> = LazyLock::new(|| {
    let file = Frontend::get("index.html")?;
    let page = String::from_utf8_lossy(&file.data).replacen(
        VERSION_TAG,
        &format!(
            r#"<meta name="nine-turtles-version" content="{}">"#,
            crate::VERSION
        ),
        1,
    );
    let hash = content_label(&file.metadata.sha256_hash());
    Some(Page {
        body: page.into_bytes(),
        label: format!("\"{}-{}\"", hash.trim_matches('"'), crate::VERSION),
    })
});

fn page_response(page: &Page, asked: &HeaderMap) -> Response {
    let mut response = if is_unchanged(asked, &page.label) {
        StatusCode::NOT_MODIFIED.into_response()
    } else {
        page.body.clone().into_response()
    };
    let headers = response.headers_mut();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/html"));
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(CHECK_EACH_TIME),
    );
    if let Ok(value) = HeaderValue::from_str(&page.label) {
        headers.insert(header::ETAG, value);
    }
    response
}

/// Whether the browser's copy (`If-None-Match`) is the one labelled `label`.
fn is_unchanged(asked: &HeaderMap, label: &str) -> bool {
    asked
        .get_all(header::IF_NONE_MATCH)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        // A proxy that compresses the file (Cloudflare) may mark the label weak (`W/`).
        .map(|tag| tag.trim().trim_start_matches("W/"))
        .any(|tag| tag == label || tag == "*")
}

fn file_response(path: &str, file: rust_embed::EmbeddedFile, asked: &HeaderMap) -> Response {
    let mime = file.metadata.mimetype();
    let cache = if path.starts_with("assets/") {
        FOREVER
    } else {
        CHECK_EACH_TIME
    };
    let label = content_label(&file.metadata.sha256_hash());
    let mut response = if is_unchanged(asked, &label) {
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
