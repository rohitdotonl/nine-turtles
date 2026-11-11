//! An assistant introduces itself (dynamic client registration, RFC 7591):
//! its name and where to send the reader back, kept in `assistant_clients`
//! until a reader connects it.

use std::time::Duration;

use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use reqwest::Url;
use serde::Deserialize;
use serde_json::json;

use super::{LONGEST_ADDRESS, oauth_error};
use crate::{
    AppState,
    auth::{database_problem, new_token},
    log, now,
};

/// A registered assistant nobody connects is forgotten after a day.
const UNUSED_CLIENT_FOR: i64 = 24 * 60 * 60;
/// At most this many registered assistants are kept, so registering can't
/// fill the disk: past it, the oldest nobody connected goes to make room.
const MOST_CLIENTS: i64 = 2_000;
/// At most this many registrations an hour from one internet address, and
/// from everywhere together, so one stranger can't crowd out everyone else.
const REGISTRATIONS_AN_HOUR_EACH: u32 = 10;
const REGISTRATIONS_AN_HOUR: u32 = 300;
/// The longest name an assistant may give itself, in characters.
const LONGEST_NAME: usize = 80;
/// At most this many return addresses.
const MOST_REDIRECTS: usize = 5;

#[derive(Deserialize)]
pub(super) struct Registration {
    #[serde(default)]
    redirect_uris: Vec<String>,
    #[serde(default)]
    client_name: Option<String>,
}

/// A name as an assistant gave it: spaces tidied, controls removed, cut
/// short. "An assistant" when it gave none.
pub(super) fn clean_name(name: Option<&str>) -> String {
    let name: String = name
        .unwrap_or_default()
        .chars()
        .filter(|c| !c.is_control())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let name: String = name.chars().take(LONGEST_NAME).collect();
    if name.is_empty() {
        "An assistant".to_owned()
    } else {
        name
    }
}

/// A return address an assistant may register (OAuth 2.1 and RFC 8252):
/// https anywhere; http only to the computer it runs on, as desktop
/// assistants do; or an app's own kind of address (`cursor://…`), never
/// one a browser would run or open as a file. Never with a `#` part.
fn allowed_redirect(address: &str) -> bool {
    if address.len() > LONGEST_ADDRESS {
        return false;
    }
    let Ok(url) = Url::parse(address) else {
        return false;
    };
    if url.fragment().is_some() {
        return false;
    }
    match url.scheme() {
        "https" => url.host_str().is_some(),
        "http" => matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")),
        "javascript" | "data" | "file" | "vbscript" | "about" | "blob" | "ftp" | "ws" | "wss" => {
            false
        }
        _ => true,
    }
}

/// Dynamic client registration (RFC 7591): an assistant introduces itself.
/// Who is asking, as well as nine turtles can tell: the address the host's
/// proxy says the request came from (the last one it added), as a number
/// for `Limits`. Render's proxy adds it; it can't be faked from outside,
/// since anything a stranger adds comes before it. None with no proxy (on
/// a computer, in the checks): then only the limit for everyone applies.
fn asker(headers: &HeaderMap) -> Option<i64> {
    use std::hash::{Hash, Hasher};
    let address = headers
        .get_all("x-forwarded-for")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .map(str::trim)
        .next_back()
        .filter(|address| !address.is_empty())?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    address.hash(&mut hasher);
    Some(i64::from_ne_bytes(hasher.finish().to_ne_bytes()))
}

pub(super) async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(form): Json<Registration>,
) -> Response {
    if form.redirect_uris.is_empty()
        || form.redirect_uris.len() > MOST_REDIRECTS
        || !form.redirect_uris.iter().all(|uri| allowed_redirect(uri))
    {
        return oauth_error(
            StatusCode::BAD_REQUEST,
            "invalid_redirect_uri",
            "Give one to five return addresses: https, http only to localhost, or an app's own.",
        );
    }
    let hour = Duration::from_secs(3_600);
    let limits = &state.assistant_limits;
    let each = asker(&headers)
        .is_none_or(|who| limits.allow("register-each", who, REGISTRATIONS_AN_HOUR_EACH, hour));
    if !each || !limits.allow("register", 0, REGISTRATIONS_AN_HOUR, hour) {
        return oauth_error(
            StatusCode::TOO_MANY_REQUESTS,
            "temporarily_unavailable",
            "Too many assistants registered this hour. Try again later.",
        );
    }
    let client_id = match new_token() {
        Ok(token) => format!("ntc_{}", &token[..32]),
        Err(error) => {
            log::problem(&format!("couldn't make an assistant's client id: {error}"));
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    let name = clean_name(form.client_name.as_deref());
    let at = now();
    let stored = async {
        let mut transaction = state.db.begin_with("BEGIN IMMEDIATE").await?;
        sqlx::query(
            "DELETE FROM assistant_clients WHERE created_at <= ?
             AND id NOT IN (SELECT client_id FROM assistant_connections WHERE client_id IS NOT NULL)
             AND id NOT IN (SELECT client_id FROM assistant_codes)",
        )
        .bind(at - UNUSED_CLIENT_FOR)
        .execute(&mut *transaction)
        .await?;
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assistant_clients")
            .fetch_one(&mut *transaction)
            .await?;
        if count >= MOST_CLIENTS {
            let made_room = sqlx::query(
                "DELETE FROM assistant_clients WHERE id = (SELECT id FROM assistant_clients
                     WHERE id NOT IN (SELECT client_id FROM assistant_connections
                                      WHERE client_id IS NOT NULL)
                         AND id NOT IN (SELECT client_id FROM assistant_codes)
                     ORDER BY created_at, id LIMIT 1)",
            )
            .execute(&mut *transaction)
            .await?;
            if made_room.rows_affected() == 0 {
                return Ok(false);
            }
        }
        sqlx::query(
            "INSERT INTO assistant_clients (client_id, name, redirect_uris, created_at)
             VALUES (?, ?, ?, ?)",
        )
        .bind(&client_id)
        .bind(&name)
        .bind(serde_json::to_string(&form.redirect_uris).unwrap_or_else(|_| "[]".to_owned()))
        .bind(at)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        Ok::<bool, sqlx::Error>(true)
    }
    .await;
    match stored {
        Ok(true) => (
            StatusCode::CREATED,
            [(header::CACHE_CONTROL, "no-store")],
            Json(json!({
                "client_id": client_id,
                "client_id_issued_at": at,
                "client_name": name,
                "redirect_uris": form.redirect_uris,
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
            })),
        )
            .into_response(),
        Ok(false) => oauth_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "temporarily_unavailable",
            "Too many assistants are waiting to connect. Try again tomorrow.",
        ),
        Err(error) => database_problem("registering an assistant", &error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn return_addresses_are_https_or_this_computer() {
        assert!(allowed_redirect("https://claude.ai/api/mcp/auth_callback"));
        assert!(allowed_redirect(
            "https://chatgpt.com/connector_platform_oauth_redirect"
        ));
        assert!(allowed_redirect("http://localhost:33418/callback"));
        assert!(allowed_redirect("http://127.0.0.1:6274/oauth/callback"));
        assert!(!allowed_redirect("http://example.com/callback"));
        assert!(!allowed_redirect("https://example.com/callback#part"));
        assert!(!allowed_redirect("javascript:alert(1)"));
        assert!(allowed_redirect(
            "cursor://anysphere.cursor-retrieval/oauth/callback"
        ));
        assert!(!allowed_redirect("data:text/html,hello"));
        assert!(!allowed_redirect("file:///etc/passwd"));
    }

    #[test]
    fn names_are_plain_and_short() {
        assert_eq!(clean_name(Some("  Claude\n ")), "Claude");
        assert_eq!(clean_name(None), "An assistant");
        assert_eq!(
            clean_name(Some(&"x".repeat(500))).chars().count(),
            LONGEST_NAME
        );
    }
}
