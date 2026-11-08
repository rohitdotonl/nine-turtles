//! Ask them for a feed (SPEC section 3, decision 0212): when Add finds no
//! feed on a site, the reader can write to its writer and ask for one. Their
//! address comes from the one visit the blog checkup makes (`checkup::visit`,
//! decision 0178): the home page of the site the reader pasted into Add and,
//! only if that shows no address, the one contact or about page it links to.
//! Never the page pasted itself, which may be an article, only because the
//! reader pressed the button, and under the feed finder's memory and limits
//! (`finder::guarded`), so pressing again within half an hour asks the site
//! nothing. Each reader may ask only as often in half an hour as one site
//! may be looked up (the finder's `PER_SITE`, counted for the reader as for
//! a site), so an account can't be used to gather addresses from many sites.
//!
//! Nothing is kept: the reader doesn't follow the site, so there's no one to
//! keep it for. What's found only fills in the reader's field, for them to
//! check before their email app opens.

use std::time::Instant;

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

#[derive(Deserialize)]
struct Asked {
    #[serde(default)]
    site: String,
}

/// `POST /api/sites/look-for-address` with `{"site": "example.com/page"}`:
/// the address that site's home page (or the contact page it links to) gives, as
/// `{"address": … or null, "looked": whether nine turtles looked}`. Anything
/// that stops the look (not a web address, a private one, the limits) is
/// "not looked", and the box asks the reader instead.
async fn look(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(asked): Json<Asked>,
) -> Response {
    let state = &state;
    // Counted as one more look at a "site" of the reader's own, under the finder's per-site limit.
    if state
        .finder
        .try_one(&format!("reader {person}"), Instant::now())
        .is_err()
    {
        return not_looked();
    }
    let answer = finder::guarded(state, "address ", &asked.site, |url| async move {
        let Ok(home) = url.join("/") else {
            return Answer::Address {
                address: None,
                looked: false,
            };
        };
        match tokio::time::timeout(checkup::LOOKING_FOR, checkup::visit(state, &home, None)).await {
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
    match answer {
        Ok(Answer::Address { address, looked }) => {
            Json(json!({ "address": address, "looked": looked })).into_response()
        }
        _ => not_looked(),
    }
}

/// Nothing looked at: the box asks the reader instead.
fn not_looked() -> Response {
    Json(json!({ "address": null, "looked": false })).into_response()
}
