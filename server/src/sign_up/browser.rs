//! The browser that signed up (decision 0193, which changes decision 0154).
//!
//! Pressing Sign up leaves a random secret in that browser, in a cookie of
//! its own (`nine_turtles_sign_up`): HttpOnly, so the page's own code can't
//! read it; Secure; SameSite=Lax; sent only to `/api/sign-up`; gone after
//! the link's 24 hours. Only its scrambled copy is kept, with the waiting
//! sign-up (`email_links.browser_hash`).
//!
//! Opening the emailed link in that browser, the link shows the address is
//! the reader's and the secret shows which waiting sign-up is theirs, so no
//! password is asked. It stays safe against a stranger who signs up with
//! someone else's address: the stranger's browser holds the secret but
//! never gets the link, and the address's owner gets the link but their
//! browser holds no secret of the stranger's, so they're asked the
//! password they chose, as before.

use axum::http::{HeaderMap, HeaderValue, header};
use sqlx::SqlitePool;

use super::Waiting;
use crate::{
    accounts::CONFIRM_LIFETIME,
    auth::{new_token, scramble},
    log,
};

const COOKIE: &str = "nine_turtles_sign_up";

/// A new random secret for this browser, or nothing if the computer can't
/// give one (sign-up then answers that something went wrong).
pub(super) fn new_secret() -> Option<String> {
    match new_token() {
        Ok(secret) => Some(secret),
        Err(error) => {
            log::problem(&format!("couldn't make a sign-up secret: {error}"));
            None
        }
    }
}

/// The cookie that keeps `secret` in this browser for the link's lifetime.
pub(super) fn cookie(secret: &str) -> HeaderValue {
    let cookie = format!(
        "{COOKIE}={secret}; Path=/api/sign-up; Max-Age={CONFIRM_LIFETIME}; HttpOnly; Secure; SameSite=Lax"
    );
    HeaderValue::from_str(&cookie).unwrap_or_else(|_| HeaderValue::from_static(""))
}

/// Takes the secret out of this browser once the account is made.
pub(super) fn forget() -> HeaderValue {
    HeaderValue::from_static(
        "nine_turtles_sign_up=; Path=/api/sign-up; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    )
}

/// The waiting sign-up for `email` this browser made, if it sends its
/// secret and that sign-up is still among the address's newest
/// (`WAITING_PER_ADDRESS`, as the password is checked against).
pub(super) async fn waiting(
    db: &SqlitePool,
    email: &str,
    headers: &HeaderMap,
) -> Result<Option<Waiting>, sqlx::Error> {
    let Some(secret) = secret_in(headers) else {
        return Ok(None);
    };
    let newest = super::newest_waiting(db, email).await?;
    let scrambled = scramble(&secret);
    Ok(newest
        .into_iter()
        .find(|(_, _, _, hash)| hash.as_deref() == Some(&scrambled[..]))
        .map(|(id, line, heard_about, _)| (id, line, heard_about)))
}

/// This browser's secret, if it sends a well-formed one.
pub(super) fn secret_in(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, value)| {
            *name == COOKIE
                && value.len() == 64
                && value.bytes().all(|byte| byte.is_ascii_hexdigit())
        })
        .map(|(_, value)| value.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_a_well_formed_secret_is_read() {
        let mut headers = HeaderMap::new();
        let secret = "a".repeat(64);
        headers.insert(
            header::COOKIE,
            HeaderValue::from_str(&format!("other=1; {COOKIE}=nope; {COOKIE}={secret}")).unwrap(),
        );
        assert_eq!(secret_in(&headers), Some(secret));
        assert_eq!(secret_in(&HeaderMap::new()), None);
    }

    #[test]
    fn the_cookie_is_for_sign_up_only_and_hidden_from_the_page() {
        let cookie = cookie(&"b".repeat(64));
        let cookie = cookie.to_str().unwrap();
        for part in [
            "Path=/api/sign-up",
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Max-Age=86400",
        ] {
            assert!(cookie.contains(part), "{part}");
        }
    }
}
