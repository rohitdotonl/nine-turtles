//! Rules sent to the browser with every page, and protection against other
//! websites sending actions on the reader's behalf ("cross-site request
//! forgery"). See docs/ENGINEERING.md → "Sign-in and security".

use axum::{
    Router,
    extract::Request,
    http::{HeaderMap, HeaderName, HeaderValue, Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
};
use tower_http::set_header::SetResponseHeaderLayer;

/// The browser refuses any script, style, font or connection that doesn't
/// come from nine turtles itself, and no other site may show nine turtles in a frame.
/// Images are an exception: an article's images load from the
/// publisher's own site (SPEC.md section 7), so any web address may
/// serve an image. An image can't run code. The one frame allowed is
/// YouTube's own player, in its privacy-enhanced form, which an article about
/// a YouTube video loads only when the reader presses Play (decision 0072).
/// Audio is the other exception: a podcast's episode plays straight from the
/// publisher's own address, in the browser's own audio element (decision
/// 0113). Audio can't run code either.
pub const CONTENT_SECURITY_POLICY: &str = "default-src 'self'; script-src 'self'; \
    style-src 'self'; img-src 'self' data: https: http:; media-src 'self' https: http:; \
    font-src 'self'; connect-src 'self'; \
    frame-src https://www.youtube-nocookie.com; \
    object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

pub fn apply<S: Clone + Send + Sync + 'static>(router: Router<S>) -> Router<S> {
    let always = |name: HeaderName, value: &'static str| {
        SetResponseHeaderLayer::overriding(name, HeaderValue::from_static(value))
    };
    router
        .layer(middleware::from_fn(same_site_actions_only))
        .layer(always(
            header::CONTENT_SECURITY_POLICY,
            CONTENT_SECURITY_POLICY,
        ))
        .layer(always(header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
        .layer(always(header::REFERRER_POLICY, "no-referrer"))
        .layer(always(header::X_FRAME_OPTIONS, "DENY"))
        .layer(always(
            header::STRICT_TRANSPORT_SECURITY,
            "max-age=31536000",
        ))
}

/// Anything that changes something (sign in, sign out, and later marking
/// read or unsubscribing) must come from nine turtles' own pages. The cookie is
/// already `SameSite=Strict`; this is the second lock on the same door.
///
/// Assistants' addresses (`/mcp`, `/oauth/token`, `/oauth/register`) are
/// the exception: they never use the cookie, only tickets the assistant
/// holds, so another website can't act through them, and an assistant may
/// say where it comes from.
async fn same_site_actions_only(request: Request, next: Next) -> Response {
    let reading = matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    );
    let for_assistants = matches!(
        request.uri().path(),
        "/mcp" | "/oauth/token" | "/oauth/register"
    );
    if reading || for_assistants || from_this_site(request.headers()) {
        next.run(request).await
    } else {
        (
            StatusCode::FORBIDDEN,
            "nine turtles only accepts actions from its own pages.",
        )
            .into_response()
    }
}

fn from_this_site(headers: &HeaderMap) -> bool {
    let text = |name| {
        headers
            .get(name)
            .and_then(|value: &HeaderValue| value.to_str().ok())
    };

    // Modern browsers say outright where a request came from.
    if let Some(site) = text(HeaderName::from_static("sec-fetch-site")) {
        return site == "same-origin" || site == "none";
    }
    // Older ones send the page's origin; it must name this same host.
    if let Some(origin) = text(header::ORIGIN) {
        let origin_host = origin.split_once("://").map(|(_, host)| host);
        return origin_host.is_some() && origin_host == text(header::HOST);
    }
    // No browser information at all: not a browser, so it can't carry the
    // reader's cookie on another site's behalf.
    true
}

#[cfg(test)]
mod tests {
    use super::from_this_site;
    use axum::http::{HeaderMap, HeaderValue};

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(*name, HeaderValue::from_static(value));
        }
        map
    }

    #[test]
    fn nine_turtles_own_pages_are_trusted() {
        assert!(from_this_site(&headers(&[(
            "sec-fetch-site",
            "same-origin"
        )])));
        assert!(from_this_site(&headers(&[
            ("origin", "https://nine-turtles.example"),
            ("host", "nine-turtles.example"),
        ])));
    }

    #[test]
    fn other_websites_are_refused() {
        assert!(!from_this_site(&headers(&[(
            "sec-fetch-site",
            "cross-site"
        )])));
        assert!(!from_this_site(&headers(&[(
            "sec-fetch-site",
            "same-site"
        )])));
        assert!(!from_this_site(&headers(&[
            ("origin", "https://evil.example"),
            ("host", "nine-turtles.example"),
        ])));
        assert!(!from_this_site(&headers(&[
            ("origin", "null"),
            ("host", "nine-turtles.example"),
        ])));
    }
}
