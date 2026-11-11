//! Client ID metadata documents (decision 0257): the way MCP's 2025-11-25
//! and later versions prefer an assistant to introduce itself. Instead of
//! registering (`register`), its `client_id` is a web address on its own
//! site (`https://claude.ai/…/client.json`, say), where a small JSON file
//! gives its name and the addresses the reader may be sent back to.
//!
//! nine turtles reads that file only when a signed-in reader opens the
//! "Connect this assistant?" page for a link that's otherwise good, and a
//! file that works is read again at most once a day: it's kept in
//! `assistant_clients` like a registered assistant's (`register::keep`),
//! so approving and swapping the code read nothing. One request to exactly
//! that address (`fetch::get_small`: public addresses only, no redirect
//! followed, at most `LARGEST` bytes read), and the file must name itself.
//! Such an assistant's `client_id` is that address, not a random one.

use std::time::Duration;

use reqwest::Url;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::fetch::FetchError;

use super::{LONGEST_ADDRESS, register};
use crate::{AppState, fetch, now};

/// A document read this long ago is read again.
const FRESH_FOR: i64 = 24 * 60 * 60;
/// The biggest document taken: real ones are a few hundred bytes.
const LARGEST: usize = 10 * 1024;
/// The most return addresses a document may give.
const MOST_REDIRECTS: usize = 20;
/// How long the Connect page waits for the assistant's site.
const LOOKING_FOR: Duration = Duration::from_secs(8);
/// At most this many documents read an hour for one reader, and for
/// everyone together, so the page can't be used to make nine turtles
/// visit many sites.
const READS_AN_HOUR_EACH: u32 = 20;
const READS_AN_HOUR: u32 = 300;

/// Why an assistant's document can't be used.
#[derive(Debug, PartialEq, Eq)]
pub enum Unusable {
    /// It isn't a client id nine turtles can read, or what it says doesn't fit.
    Invalid,
    /// Its site didn't answer, or too many were read this hour: try again later.
    Unreachable,
}

/// Whether a client id is a web address naming its own document, rather
/// than one nine turtles gave at registration (`ntc_…`).
pub fn is_document(client_id: &str) -> bool {
    client_id.starts_with("https://") || client_id.starts_with("http://")
}

/// A client id as the standard allows it: https, a host, a path beyond
/// `/`, written exactly as it reads (no `.` or `..` parts, which would be
/// tidied away), and no name and password or `#` part. Plain http only in
/// the tests, which serve made-up assistants from this computer (`local`).
fn address(client_id: &str, local: bool) -> Option<Url> {
    let url = Url::parse(client_id).ok()?;
    let fits = client_id.len() <= LONGEST_ADDRESS
        && url.as_str() == client_id
        && (url.scheme() == "https" || (local && url.scheme() == "http"))
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && url.path() != "/";
    fits.then_some(url)
}

#[derive(Deserialize)]
struct Document {
    client_id: String,
    #[serde(default)]
    client_name: Option<String>,
    redirect_uris: Vec<String>,
    #[serde(default)]
    token_endpoint_auth_method: Option<String>,
}

/// What a document says, once checked: its name and return addresses.
fn read(client_id: &str, body: &[u8]) -> Option<(String, Vec<String>)> {
    if body.len() > LARGEST {
        return None;
    }
    let document: Document = serde_json::from_slice(body).ok()?;
    let fits = document.client_id == client_id
        && !document.redirect_uris.is_empty()
        && document.redirect_uris.len() <= MOST_REDIRECTS
        && document
            .redirect_uris
            .iter()
            .all(|uri| register::allowed_redirect(uri))
        // nine turtles' assistants keep no secret: it can't check another way.
        && document
            .token_endpoint_auth_method
            .as_deref()
            .is_none_or(|method| method == "none");
    fits.then(|| {
        (
            register::clean_name(document.client_name.as_deref()),
            document.redirect_uris,
        )
    })
}

/// When nine turtles last read the assistant's document, if it has a copy.
async fn read_at(db: &SqlitePool, client_id: &str) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar("SELECT created_at FROM assistant_clients WHERE client_id = ?")
        .bind(client_id)
        .fetch_optional(db)
        .await
}

/// Makes sure `assistant_clients` holds what the assistant's document says,
/// reading it for the reader `person` if nine turtles hasn't today. A copy
/// older than that is still used when the site doesn't answer or the
/// hour's reads are used up, so nobody can stop a known assistant
/// connecting by using them up.
pub async fn refresh(
    state: &AppState,
    person: i64,
    client_id: &str,
) -> Result<Result<(), Unusable>, sqlx::Error> {
    let local = state.config.local_feeds_allowed;
    let Some(url) = address(client_id, local) else {
        return Ok(Err(Unusable::Invalid));
    };
    let copy = read_at(&state.db, client_id).await?;
    if copy.is_some_and(|at| at > now() - FRESH_FOR) {
        return Ok(Ok(()));
    }
    let try_later = if copy.is_some() {
        Ok(Ok(()))
    } else {
        Ok(Err(Unusable::Unreachable))
    };
    let hour = Duration::from_secs(3_600);
    let limits = &state.assistant_limits;
    if !limits.allow("client-document-each", person, READS_AN_HOUR_EACH, hour)
        || !limits.allow("client-document", 0, READS_AN_HOUR, hour)
    {
        return try_later;
    }
    let asking = fetch::get_small(&state.http, &url, local, LARGEST);
    let body = match tokio::time::timeout(LOOKING_FOR, asking).await {
        Ok(Ok(body)) => body,
        // Not there, somewhere else (a redirect), too big, or not allowed.
        Ok(Err(FetchError::Status(status))) if status < 500 && status != 429 => {
            return Ok(Err(Unusable::Invalid));
        }
        Ok(Err(FetchError::NotAllowed | FetchError::TooBig)) => {
            return Ok(Err(Unusable::Invalid));
        }
        // No answer, a server error, or asked to wait: try again later.
        _ => return try_later,
    };
    let Some((name, redirects)) = read(client_id, &body) else {
        return Ok(Err(Unusable::Invalid));
    };
    if register::keep(&state.db, client_id, &name, &redirects).await? {
        Ok(Ok(()))
    } else {
        try_later
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_client_id_is_a_plain_https_address_with_a_path() {
        let ok = "https://claude.ai/oauth/mcp-client-metadata.json";
        assert!(is_document(ok) && address(ok, false).is_some());
        for bad in [
            "http://claude.ai/client.json",
            "https://claude.ai",
            "https://claude.ai/",
            "https://claude.ai/a/../client.json",
            "https://user:pass@claude.ai/client.json",
            "https://claude.ai/client.json#part",
            "https://CLAUDE.ai/client.json",
        ] {
            assert!(address(bad, false).is_none(), "{bad}");
        }
        assert!(address("http://127.0.0.1:8090/client.json", true).is_some());
        assert!(!is_document("ntc_0123"));
    }

    #[test]
    fn a_document_must_name_itself_and_send_readers_back_safely() {
        let id = "https://assistant.example/client.json";
        let good = br#"{"client_id":"https://assistant.example/client.json","client_name":" Helper ","redirect_uris":["https://assistant.example/back"],"token_endpoint_auth_method":"none"}"#;
        assert_eq!(
            read(id, good),
            Some((
                "Helper".to_owned(),
                vec!["https://assistant.example/back".to_owned()]
            ))
        );
        let other = br#"{"client_id":"https://elsewhere.example/client.json","redirect_uris":["https://assistant.example/back"]}"#;
        let unsafe_back = br#"{"client_id":"https://assistant.example/client.json","redirect_uris":["javascript:alert(1)"]}"#;
        let secret = br#"{"client_id":"https://assistant.example/client.json","redirect_uris":["https://assistant.example/back"],"token_endpoint_auth_method":"private_key_jwt"}"#;
        for bad in [&other[..], unsafe_back, secret, b"not json"] {
            assert_eq!(read(id, bad), None);
        }
    }
}
