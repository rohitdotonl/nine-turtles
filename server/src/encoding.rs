//! Writing bytes as text and back: hex, base64 and web forms, one copy
//! each. Small enough to keep here rather than add a library.

use std::fmt::Write as _;

/// Bytes as lowercase hex: `[0, 255]` is `00ff`.
pub fn hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut text, byte| {
            let _ = write!(text, "{byte:02x}");
            text
        })
}

/// Hex back to bytes (either case, spaces around it ignored); `None` if it isn't.
pub fn from_hex(text: &str) -> Option<Vec<u8>> {
    let text = text.trim();
    if text.is_empty() || !text.len().is_multiple_of(2) {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(text.get(at..at + 2)?, 16).ok())
        .collect()
}

/// `count` random bytes from the operating system, written as hex.
pub fn random_hex(count: usize) -> Result<String, getrandom::Error> {
    let mut random = vec![0u8; count];
    getrandom::fill(&mut random)?;
    Ok(hex(&random))
}

const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64URL: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// Standard base64, with `=` at the end.
pub fn base64(bytes: &[u8]) -> String {
    base64_with(bytes, BASE64, true)
}

/// base64url without padding, as PKCE and web tokens write it.
pub fn base64url(bytes: &[u8]) -> String {
    base64_with(bytes, BASE64URL, false)
}

fn base64_with(bytes: &[u8], alphabet: &[u8; 64], pad: bool) -> String {
    let mut text = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let joined = chunk.iter().enumerate().fold(0u32, |all, (at, byte)| {
            all | (u32::from(*byte) << (16 - 8 * at))
        });
        for at in 0..4 {
            if at <= chunk.len() {
                let index = (joined >> (18 - 6 * at)) & 0x3f;
                text.push(char::from(alphabet[index as usize]));
            } else if pad {
                text.push('=');
            }
        }
    }
    text
}

/// Standard base64 (with or without `=` at the end) back to bytes; `None` if it isn't.
pub fn from_base64(text: &str) -> Option<Vec<u8>> {
    let text = text.trim().trim_end_matches('=');
    let mut bytes = Vec::with_capacity(text.len() * 3 / 4);
    let mut buffer: u32 = 0;
    let mut bits = 0;
    for character in text.bytes() {
        let value = BASE64.iter().position(|&known| known == character)?;
        buffer = (buffer << 6) | u32::try_from(value).ok()?;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            bytes.push(u8::try_from((buffer >> bits) & 0xff).ok()?);
        }
    }
    Some(bytes)
}

/// A web form or query string (`a=1&b=two+words&c=%2F`) as its pairs, in order.
pub fn form_pairs(text: &str) -> Vec<(String, String)> {
    let Ok(mut url) = reqwest::Url::parse("http://form.invalid/") else {
        return Vec::new();
    };
    // Set rather than parsed, so a `#` is part of a value, not the end. The
    // URL parser drops raw tabs and line breaks; forms send them as `%0A`.
    url.set_query(Some(text.trim_start_matches('?')));
    url.query_pairs()
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_goes_both_ways() {
        assert_eq!(hex(&[0, 255, 16]), "00ff10");
        assert_eq!(from_hex("00ff10"), Some(vec![0, 255, 16]));
        assert_eq!(from_hex(" 00FF10 "), Some(vec![0, 255, 16]));
        assert_eq!(from_hex("abc"), None);
        assert_eq!(from_hex("zz"), None);
        assert_eq!(from_hex(""), None);
        let one = random_hex(32).unwrap();
        assert_eq!(one.len(), 64);
        assert_ne!(one, random_hex(32).unwrap());
    }

    #[test]
    fn base64_goes_both_ways() {
        for bytes in [&b""[..], b"f", b"fo", b"foo", b"foob", b"fooba", b"foobar"] {
            assert_eq!(from_base64(&base64(bytes)).unwrap(), bytes);
        }
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(&[0xfb, 0xff]), "+/8=");
        assert_eq!(from_base64("Zm8").unwrap(), b"fo");
        assert_eq!(from_base64("not base64!"), None);
    }

    #[test]
    fn base64url_has_no_padding() {
        assert_eq!(base64url(b"f"), "Zg");
        assert_eq!(base64url(b"fo"), "Zm8");
        assert_eq!(base64url(b"foo"), "Zm9v");
        assert_eq!(base64url(&[0xfb, 0xff]), "-_8");
    }

    #[test]
    fn forms_are_decoded() {
        assert_eq!(
            form_pairs("i=1&i=2&a=user%2F-%2Fstate%2Fcom.google%2Fread&T=x+y&bad=%zz&end=%&&lone"),
            vec![
                ("i".to_owned(), "1".to_owned()),
                ("i".to_owned(), "2".to_owned()),
                ("a".to_owned(), "user/-/state/com.google/read".to_owned()),
                ("T".to_owned(), "x y".to_owned()),
                ("bad".to_owned(), "%zz".to_owned()),
                ("end".to_owned(), "%".to_owned()),
                ("lone".to_owned(), String::new()),
            ]
        );
        assert_eq!(form_pairs("?a=1"), vec![("a".to_owned(), "1".to_owned())]);
        assert_eq!(
            form_pairs("t=one#two&u=%23"),
            vec![
                ("t".to_owned(), "one#two".to_owned()),
                ("u".to_owned(), "#".to_owned()),
            ]
        );
        assert_eq!(form_pairs(""), Vec::new());
    }
}
