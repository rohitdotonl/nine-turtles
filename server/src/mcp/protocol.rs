//! Which version of MCP a message speaks, and the checks that version asks
//! for (decision 0256).
//!
//! MCP has two eras. Up to 2025-11-25 an assistant opens with `initialize`
//! and its later messages carry the version it agreed in the
//! `MCP-Protocol-Version` header ("legacy"). From 2026-07-28 there's no
//! opening: every message says its own version and what the assistant can
//! do in `params._meta`, repeats the version, the method and (for a tool
//! call) the tool's name in headers, and every answer says it's complete
//! and who answered ("modern"). nine turtles never kept a session, so both
//! eras are served at the same `/mcp`, each message on its own.

use axum::http::{HeaderMap, StatusCode};
use serde_json::{Value, json};

use crate::encoding::from_base64;

/// The stateless versions, newest first.
pub const MODERN: &[&str] = &["2026-07-28"];
/// The versions that open with `initialize`, newest first. An assistant
/// asking `initialize` for another is answered with the newest, as those
/// versions say.
pub const LEGACY: &[&str] = &["2025-11-25", "2025-06-18", "2025-03-26"];

/// Every version nine turtles speaks, newest first.
pub fn supported() -> Vec<&'static str> {
    MODERN.iter().chain(LEGACY).copied().collect()
}

const VERSION_KEY: &str = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_KEY: &str = "io.modelcontextprotocol/clientCapabilities";
const SERVER_INFO_KEY: &str = "io.modelcontextprotocol/serverInfo";

/// The JSON-RPC error codes the 2026-07-28 version adds.
const HEADER_MISMATCH: i64 = -32020;
const UNSUPPORTED_VERSION: i64 = -32022;
const INVALID_PARAMS: i64 = -32602;

/// How a message is to be answered.
#[derive(Debug, PartialEq, Eq)]
pub enum Era {
    /// Stateless (2026-07-28 on): answers carry `resultType` and `_meta`.
    Modern,
    /// `initialize` first (2025-11-25 and before): answered as before.
    Legacy,
}

/// A message refused before it's read: an HTTP status and a JSON-RPC error.
#[derive(Debug)]
pub struct Refusal {
    pub status: StatusCode,
    pub code: i64,
    pub message: String,
    pub data: Option<Value>,
}

fn refusal(code: i64, message: String, data: Option<Value>) -> Refusal {
    Refusal {
        status: StatusCode::BAD_REQUEST,
        code,
        message,
        data,
    }
}

fn unsupported(requested: &str) -> Refusal {
    refusal(
        UNSUPPORTED_VERSION,
        "Unsupported protocol version".to_owned(),
        Some(json!({ "supported": supported(), "requested": requested })),
    )
}

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

/// A header value as the assistant meant it: one that didn't fit in a
/// header comes as `=?base64?…?=`.
fn decoded(value: &str) -> Option<String> {
    match value
        .strip_prefix("=?base64?")
        .and_then(|rest| rest.strip_suffix("?="))
    {
        Some(encoded) => String::from_utf8(from_base64(encoded)?).ok(),
        None => Some(value.to_owned()),
    }
}

/// Which era a request (a message with an id) speaks, or why it's refused.
pub fn era(headers: &HeaderMap, message: &Value) -> Result<Era, Refusal> {
    let method = message["method"].as_str().unwrap_or_default();
    let meta = &message["params"]["_meta"];
    let said = header(headers, "mcp-protocol-version");
    // `initialize` opens the old way, before any version is agreed.
    if method == "initialize" {
        return Ok(Era::Legacy);
    }
    let Some(version) = meta[VERSION_KEY].as_str() else {
        return match said {
            // A version without `initialize` must say it in `_meta`.
            Some(said) if MODERN.contains(&said) => Err(refusal(
                INVALID_PARAMS,
                format!(
                    "A {said} request carries params._meta[\"{VERSION_KEY}\"] and [\"{CAPABILITIES_KEY}\"]."
                ),
                None,
            )),
            Some(said) if LEGACY.contains(&said) => Ok(Era::Legacy),
            Some(said) => Err(unsupported(said)),
            // Before 2025-06-18 there was no header: such a request is 2025-03-26.
            None => Ok(Era::Legacy),
        };
    };
    if said != Some(version) {
        return Err(refusal(
            HEADER_MISMATCH,
            format!(
                "Header mismatch: MCP-Protocol-Version is {said:?}, the request's _meta says {version:?}."
            ),
            None,
        ));
    }
    if LEGACY.contains(&version) {
        return Ok(Era::Legacy);
    }
    if !MODERN.contains(&version) {
        return Err(unsupported(version));
    }
    let named = header(headers, "mcp-method");
    if named != Some(method) {
        return Err(refusal(
            HEADER_MISMATCH,
            format!("Header mismatch: Mcp-Method is {named:?}, the body's method is {method:?}."),
            None,
        ));
    }
    let name = match method {
        "tools/call" | "prompts/get" => Some(&message["params"]["name"]),
        "resources/read" => Some(&message["params"]["uri"]),
        _ => None,
    };
    if let Some(name) = name {
        let given = header(headers, "mcp-name").and_then(decoded);
        if name.as_str().is_none() || given.as_deref() != name.as_str() {
            return Err(refusal(
                HEADER_MISMATCH,
                format!("Header mismatch: Mcp-Name is {given:?}, the body's is {name}."),
                None,
            ));
        }
    }
    if !meta[CAPABILITIES_KEY].is_object() {
        return Err(refusal(
            INVALID_PARAMS,
            format!("A {version} request carries params._meta[\"{CAPABILITIES_KEY}\"]."),
            None,
        ));
    }
    Ok(Era::Modern)
}

/// A modern answer: complete, and saying who answered.
pub fn complete(mut result: Value, server: &Value) -> Value {
    if let Some(fields) = result.as_object_mut() {
        fields.insert("resultType".to_owned(), json!("complete"));
        fields.insert("_meta".to_owned(), json!({ SERVER_INFO_KEY: server }));
    }
    result
}

/// The tools and what nine turtles is change only when a new version goes
/// live, and are the same for every reader: an assistant may keep them an
/// hour, and share them.
pub fn cacheable(mut result: Value) -> Value {
    if let Some(fields) = result.as_object_mut() {
        fields.insert("ttlMs".to_owned(), json!(3_600_000));
        fields.insert("cacheScope".to_owned(), json!("public"));
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(*name, HeaderValue::from_str(value).unwrap());
        }
        map
    }

    fn modern(method: &str, params: Value) -> Value {
        let mut params = params;
        params["_meta"] = json!({ VERSION_KEY: "2026-07-28", CAPABILITIES_KEY: {} });
        json!({ "jsonrpc": "2.0", "id": 1, "method": method, "params": params })
    }

    #[test]
    fn the_old_way_is_still_served() {
        let initialize = json!({ "id": 1, "method": "initialize", "params": {} });
        assert_eq!(era(&HeaderMap::new(), &initialize).unwrap(), Era::Legacy);
        let list = json!({ "id": 2, "method": "tools/list" });
        assert_eq!(era(&HeaderMap::new(), &list).unwrap(), Era::Legacy);
        let with = headers(&[("mcp-protocol-version", "2025-06-18")]);
        assert_eq!(era(&with, &list).unwrap(), Era::Legacy);
    }

    #[test]
    fn an_unknown_version_is_told_which_there_are() {
        let list = json!({ "id": 2, "method": "tools/list" });
        let refused = era(&headers(&[("mcp-protocol-version", "1900-01-01")]), &list).unwrap_err();
        assert_eq!(refused.status, StatusCode::BAD_REQUEST);
        assert_eq!(refused.code, UNSUPPORTED_VERSION);
        assert_eq!(refused.data.unwrap()["supported"][0], "2026-07-28");
    }

    #[test]
    fn a_modern_request_must_match_its_headers() {
        let call = modern("tools/call", json!({ "name": "list_feeds" }));
        let right = [
            ("mcp-protocol-version", "2026-07-28"),
            ("mcp-method", "tools/call"),
            ("mcp-name", "list_feeds"),
        ];
        assert_eq!(era(&headers(&right), &call).unwrap(), Era::Modern);
        // The name may come base64-encoded.
        let encoded = [
            ("mcp-protocol-version", "2026-07-28"),
            ("mcp-method", "tools/call"),
            ("mcp-name", "=?base64?bGlzdF9mZWVkcw==?="),
        ];
        assert_eq!(era(&headers(&encoded), &call).unwrap(), Era::Modern);
        for wrong in [
            &right[..1],
            &[right[0], right[1]][..],
            &[right[0], ("mcp-method", "tools/list"), right[2]][..],
            &[right[0], right[1], ("mcp-name", "star")][..],
            &[("mcp-protocol-version", "2025-11-25"), right[1], right[2]][..],
        ] {
            let refused = era(&headers(wrong), &call).unwrap_err();
            assert_eq!(refused.code, HEADER_MISMATCH, "{wrong:?}");
        }
    }

    #[test]
    fn a_modern_request_says_what_it_can_do() {
        let mut list = modern("tools/list", json!({}));
        list["params"]["_meta"]
            .as_object_mut()
            .unwrap()
            .remove(CAPABILITIES_KEY);
        let said = headers(&[
            ("mcp-protocol-version", "2026-07-28"),
            ("mcp-method", "tools/list"),
        ]);
        assert_eq!(era(&said, &list).unwrap_err().code, INVALID_PARAMS);
        // The header alone, with no _meta, isn't enough either.
        let bare = json!({ "id": 2, "method": "tools/list" });
        assert_eq!(era(&said, &bare).unwrap_err().code, INVALID_PARAMS);
    }
}
