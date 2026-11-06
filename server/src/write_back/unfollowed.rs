//! Ask them for a feed (SPEC section 3, decision 0212): when Add finds no
//! feed on a site, the reader can write to its writer and ask for one. Their
//! address comes from the one visit the blog checkup makes (`checkup::visit`,
//! decision 0178): the page the reader pasted into Add (the page Add has
//! just looked at, as the checkup starts from the page a writer gives) and,
//! only if that shows no address, the one contact or about page it links to.
//! Never any other page, only because the reader pressed the button, and
//! under the feed finder's memory
//! and limits (`finder::guarded`), so pressing again within half an hour
//! asks the site nothing.
//!
//! Nothing is kept: the reader doesn't follow the site, so there's no one to
//! keep it for. What's found only fills in the reader's field, for them to
//! check before their email app opens.

use std::time::Duration;

use axum::{
    Json, Router, extract::State, response::IntoResponse, response::Response, routing::post,
};
use serde::Deserialize;
use serde_json::json;

use crate::{
    AppState,
    auth::SignedIn,
    checkup,
    finder::{self, Answer},
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/api/sites/look-for-address", post(look))
}

/// The longest the visit may take, both pages together: the reader is
/// waiting, so after this the box asks them instead.
const LOOKING_FOR: Duration = Duration::from_secs(8);

#[derive(Deserialize)]
struct Asked {
    #[serde(default)]
    site: String,
}

/// `POST /api/sites/look-for-address` with `{"site": "example.com/page"}`:
/// the address that page (or the contact page it links to) gives, as
/// `{"address": … or null, "looked": whether nine turtles looked}`. Anything
/// that stops the look (not a web address, a private one, the limits) is
/// "not looked", and the box asks the reader instead.
async fn look(
    SignedIn(_): SignedIn,
    State(state): State<AppState>,
    Json(asked): Json<Asked>,
) -> Response {
    let state = &state;
    let answer = finder::guarded(state, "address ", &asked.site, |url| async move {
        match tokio::time::timeout(LOOKING_FOR, checkup::visit(state, &url, None)).await {
            Ok(seen) => Answer::Address {
                address: seen.address,
                looked: seen.looked,
            },
            Err(_) => Answer::Address {
                address: None,
                looked: false,
            },
        }
    })
    .await;
    let (address, looked) = match answer {
        Ok(Answer::Address { address, looked }) => (address, looked),
        _ => (None, false),
    };
    Json(json!({ "address": address, "looked": looked })).into_response()
}
