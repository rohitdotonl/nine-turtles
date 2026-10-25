//! Talks to the storage that holds backups: any service that speaks "S3",
//! the common language of file storage (Cloudflare R2, Backblaze B2, Amazon
//! S3, MinIO and many more). Only the four things backups need: put a file,
//! fetch it back, list what's there and delete. Every request is signed with
//! the account's key the standard way ("Signature Version 4"), using the
//! hmac and sha2 libraries nine turtles already has, so no storage company's
//! own library is needed and the service can be swapped through settings
//! alone (decision 0076).

use std::{fmt, path::Path, time::Duration};

use hmac::{Hmac, KeyInit, Mac};
use reqwest::{Client, Method, Url};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// How long one upload or download may take. Generous: a big database over
/// a slow line can take minutes.
const TIME_LIMIT: Duration = Duration::from_secs(30 * 60);
const CONNECT_LIMIT: Duration = Duration::from_secs(30);

/// Where backups go, from the `NINE_TURTLES_BACKUP_*` settings.
#[derive(Clone, PartialEq, Eq)]
pub struct Settings {
    /// The service's address, such as `https://<account>.r2.cloudflarestorage.com`.
    pub endpoint: Url,
    pub bucket: String,
    /// `auto` for Cloudflare R2; the service's region name elsewhere.
    pub region: String,
    pub key_id: String,
    pub secret: String,
}

/// Never shows the secret, so settings can be logged safely.
impl fmt::Debug for Settings {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Settings")
            .field("endpoint", &self.endpoint.as_str())
            .field("bucket", &self.bucket)
            .field("region", &self.region)
            .field("key_id", &self.key_id)
            .field("secret", &"(hidden)")
            .finish()
    }
}

#[derive(Clone, Debug)]
pub struct Storage {
    settings: Settings,
    http: Client,
}

/// One stored file, as a listing shows it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Stored {
    pub name: String,
    pub bytes: u64,
}

impl Storage {
    pub fn new(settings: Settings) -> Result<Self, String> {
        let http = Client::builder()
            .user_agent(concat!("nine-turtles/", env!("CARGO_PKG_VERSION")))
            .timeout(TIME_LIMIT)
            .connect_timeout(CONNECT_LIMIT)
            .build()
            .map_err(|error| format!("can't set up the backup uploader: {error}"))?;
        Ok(Self { settings, http })
    }

    /// Uploads the file at `from` as `name`, without holding it all in memory.
    pub async fn put(&self, name: &str, from: &Path) -> Result<(), String> {
        let (bytes, hash) = hash_file(from).await?;
        let file = tokio::fs::File::open(from)
            .await
            .map_err(|error| format!("can't read {}: {error}", from.display()))?;
        let response = self
            .request(Method::PUT, name, &[], &hash)
            .header(reqwest::header::CONTENT_LENGTH, bytes)
            .header(reqwest::header::CONTENT_TYPE, "application/vnd.sqlite3")
            .body(reqwest::Body::from(file))
            .send()
            .await
            .map_err(|error| format!("couldn't upload {name}: {}", plain(error)))?;
        expect_success(response, &format!("upload {name}"))
            .await
            .map(drop)
    }

    /// Downloads `name` into a new file at `to`, bit by bit.
    pub async fn get(&self, name: &str, to: &Path) -> Result<(), String> {
        let mut response = expect_success(
            self.request(Method::GET, name, &[], EMPTY_HASH)
                .send()
                .await
                .map_err(|error| format!("couldn't download {name}: {}", plain(error)))?,
            &format!("download {name}"),
        )
        .await?;
        let mut file = tokio::fs::File::create_new(to)
            .await
            .map_err(|error| format!("can't create {}: {error}", to.display()))?;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("the download of {name} broke off: {}", plain(error)))?
        {
            file.write_all(&chunk)
                .await
                .map_err(|error| format!("can't write {}: {error}", to.display()))?;
        }
        file.sync_all()
            .await
            .map_err(|error| format!("can't write {}: {error}", to.display()))
    }

    pub async fn delete(&self, name: &str) -> Result<(), String> {
        let response = self
            .request(Method::DELETE, name, &[], EMPTY_HASH)
            .send()
            .await
            .map_err(|error| format!("couldn't delete {name}: {}", plain(error)))?;
        expect_success(response, &format!("delete {name}"))
            .await
            .map(drop)
    }

    /// Every stored file whose name starts with `prefix`, in name order.
    pub async fn list(&self, prefix: &str) -> Result<Vec<Stored>, String> {
        let mut found = Vec::new();
        let mut continuation: Option<String> = None;
        loop {
            let mut query = vec![("list-type", "2".to_owned()), ("prefix", prefix.to_owned())];
            if let Some(token) = &continuation {
                query.push(("continuation-token", token.clone()));
            }
            let response = self
                .request(Method::GET, "", &query, EMPTY_HASH)
                .send()
                .await
                .map_err(|error| format!("couldn't list the backups: {}", plain(error)))?;
            let text = expect_success(response, "list the backups")
                .await?
                .text()
                .await
                .map_err(|error| format!("couldn't list the backups: {}", plain(error)))?;
            found.extend(stored_files(&text));
            continuation = (element(&text, "IsTruncated").as_deref() == Some("true"))
                .then(|| element(&text, "NextContinuationToken"))
                .flatten();
            if continuation.is_none() {
                break;
            }
        }
        found.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(found)
    }

    /// A signed request for `name` in the bucket (or the bucket itself when
    /// `name` is empty). Addresses are "path style",
    /// `https://endpoint/bucket/name`, which every S3-compatible service accepts.
    fn request(
        &self,
        method: Method,
        name: &str,
        query: &[(&str, String)],
        payload_hash: &str,
    ) -> reqwest::RequestBuilder {
        let (url, amz_date, authorization) =
            self.signed(&method, name, query, payload_hash, crate::now());
        self.http
            .request(method, url)
            .header("x-amz-content-sha256", payload_hash)
            .header("x-amz-date", amz_date)
            .header(reqwest::header::AUTHORIZATION, authorization)
    }

    /// The address, the `x-amz-date` and the `Authorization` header for a
    /// request made at `at` (seconds since 1970).
    fn signed(
        &self,
        method: &Method,
        name: &str,
        query: &[(&str, String)],
        payload_hash: &str,
        at: i64,
    ) -> (Url, String, String) {
        let mut path = self
            .settings
            .endpoint
            .path()
            .trim_end_matches('/')
            .to_owned();
        path.push('/');
        path.push_str(&encode(&self.settings.bucket, false));
        if !name.is_empty() {
            path.push('/');
            path.push_str(&encode(name, true));
        }
        let mut pairs: Vec<(String, String)> = query
            .iter()
            .map(|(key, value)| (encode(key, false), encode(value, false)))
            .collect();
        pairs.sort();
        let query_text = pairs
            .iter()
            .map(|(key, value)| format!("{key}={value}"))
            .collect::<Vec<_>>()
            .join("&");

        let mut url = self.settings.endpoint.clone();
        url.set_path(&path);
        url.set_query((!query_text.is_empty()).then_some(query_text.as_str()));
        let host = match (url.host_str(), url.port()) {
            (Some(host), Some(port)) => format!("{host}:{port}"),
            (Some(host), None) => host.to_owned(),
            (None, _) => String::new(),
        };
        let amz_date = amz_date(at);
        let headers = [
            ("host", host.as_str()),
            ("x-amz-content-sha256", payload_hash),
            ("x-amz-date", amz_date.as_str()),
        ];
        let authorization = authorization(
            &self.settings,
            method.as_str(),
            &path,
            &query_text,
            &headers,
            payload_hash,
            &amz_date,
        );
        (url, amz_date, authorization)
    }
}

/// The SHA-256 of nothing, for requests without a body.
const EMPTY_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/// The `Authorization` header for one request (AWS Signature Version 4).
/// `headers` are lowercase names with their values, all of them signed.
fn authorization(
    settings: &Settings,
    method: &str,
    path: &str,
    query: &str,
    headers: &[(&str, &str)],
    payload_hash: &str,
    amz_date: &str,
) -> String {
    let mut headers = headers.to_vec();
    headers.sort();
    let canonical_headers: String = headers
        .iter()
        .map(|(name, value)| format!("{name}:{}\n", value.trim()))
        .collect();
    let signed_headers = headers
        .iter()
        .map(|(name, _)| *name)
        .collect::<Vec<_>>()
        .join(";");
    let canonical_request =
        format!("{method}\n{path}\n{query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}");
    let day = &amz_date[..8];
    let scope = format!("{day}/{}/s3/aws4_request", settings.region);
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{}",
        hex(&Sha256::digest(canonical_request.as_bytes()))
    );
    let mut key = hmac(
        format!("AWS4{}", settings.secret).as_bytes(),
        day.as_bytes(),
    );
    for part in [settings.region.as_str(), "s3", "aws4_request"] {
        key = hmac(&key, part.as_bytes());
    }
    let signature = hex(&hmac(&key, string_to_sign.as_bytes()));
    format!(
        "AWS4-HMAC-SHA256 Credential={}/{scope}, SignedHeaders={signed_headers}, Signature={signature}",
        settings.key_id
    )
}

fn hmac(key: &[u8], data: &[u8]) -> Vec<u8> {
    // HMAC takes a key of any length, so this can't fail.
    let mut mac = <Hmac<Sha256> as KeyInit>::new_from_slice(key).expect("any key length works");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Percent-encodes everything but letters, digits and `-_.~` (and `/` when
/// `keep_slash`), the way the signature expects.
fn encode(text: &str, keep_slash: bool) -> String {
    let mut encoded = String::new();
    for byte in text.bytes() {
        if byte.is_ascii_alphanumeric()
            || matches!(byte, b'-' | b'_' | b'.' | b'~')
            || (keep_slash && byte == b'/')
        {
            encoded.push(char::from(byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

/// `20261025T030000Z` for seconds since 1970.
fn amz_date(at: i64) -> String {
    let (year, month, day) = crate::backup::civil_date(at);
    let seconds = at.rem_euclid(86_400);
    format!(
        "{year:04}{month:02}{day:02}T{:02}{:02}{:02}Z",
        seconds / 3_600,
        seconds % 3_600 / 60,
        seconds % 60
    )
}

/// The size and SHA-256 of a file, read in pieces.
async fn hash_file(path: &Path) -> Result<(u64, String), String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|error| format!("can't read {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0; 256 * 1024];
    let mut bytes = 0_u64;
    loop {
        let read = file
            .read(&mut buffer)
            .await
            .map_err(|error| format!("can't read {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        bytes += read as u64;
    }
    Ok((bytes, hex(&hasher.finalize())))
}

/// Passes a successful answer through; turns any other into a plain message
/// with the service's own short explanation (its `<Code>`), never the key.
async fn expect_success(
    response: reqwest::Response,
    what: &str,
) -> Result<reqwest::Response, String> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    let body = response.text().await.unwrap_or_default();
    let code = element(&body, "Code").unwrap_or_default();
    Err(
        format!("the backup storage refused to {what}: {status} {code}")
            .trim_end()
            .to_owned(),
    )
}

/// A network error without the address, which can hold the account id.
fn plain(error: reqwest::Error) -> String {
    error.without_url().to_string()
}

/// The files in a ListObjectsV2 answer (each `<Contents>` holds a `<Key>`
/// and a `<Size>`). The answer is small and regular, so a few string
/// searches read it; no XML library is needed.
fn stored_files(xml: &str) -> Vec<Stored> {
    xml.split("<Contents>")
        .skip(1)
        .filter_map(|contents| {
            let contents = contents.split("</Contents>").next()?;
            Some(Stored {
                name: element(contents, "Key")?,
                bytes: element(contents, "Size")?.parse().ok()?,
            })
        })
        .collect()
}

/// The text of the first `<tag>…</tag>` in `xml`, with XML's escapes undone.
fn element(xml: &str, tag: &str) -> Option<String> {
    let start = xml.find(&format!("<{tag}>"))? + tag.len() + 2;
    let length = xml[start..].find(&format!("</{tag}>"))?;
    Some(
        xml[start..start + length]
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&amp;", "&"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The worked example in Amazon's S3 documentation ("Example: GET
    /// Object", Signature Version 4): if this matches, real services accept
    /// our signatures.
    #[test]
    fn signs_exactly_like_amazons_documented_example() {
        let settings = Settings {
            endpoint: Url::parse("https://examplebucket.s3.amazonaws.com").unwrap(),
            bucket: "examplebucket".into(),
            region: "us-east-1".into(),
            key_id: "AKIAIOSFODNN7EXAMPLE".into(),
            secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY".into(),
        };
        let header = authorization(
            &settings,
            "GET",
            "/test.txt",
            "",
            &[
                ("host", "examplebucket.s3.amazonaws.com"),
                ("range", "bytes=0-9"),
                ("x-amz-content-sha256", EMPTY_HASH),
                ("x-amz-date", "20130524T000000Z"),
            ],
            EMPTY_HASH,
            "20130524T000000Z",
        );
        assert_eq!(
            header,
            "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, \
             SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, \
             Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
        );
    }

    /// A listing request with a continuation token, signed as Amazon's own
    /// library (botocore 1.x) signs the same request: checks the address,
    /// the sorted and encoded query, and the header list.
    #[test]
    fn signs_a_listing_exactly_like_amazons_library() {
        let storage = Storage::new(Settings {
            endpoint: Url::parse("https://abc.r2.cloudflarestorage.com").unwrap(),
            bucket: "nine-turtles-backups".into(),
            region: "auto".into(),
            key_id: "test-key-id".into(),
            secret: "test-secret".into(),
        })
        .unwrap();
        let (url, amz_date, authorization) = storage.signed(
            &Method::GET,
            "",
            &[
                ("list-type", "2".to_owned()),
                ("prefix", "nightly/".to_owned()),
                ("continuation-token", "abc==".to_owned()),
            ],
            EMPTY_HASH,
            1_792_900_800,
        );
        assert_eq!(
            url.as_str(),
            "https://abc.r2.cloudflarestorage.com/nine-turtles-backups\
             ?continuation-token=abc%3D%3D&list-type=2&prefix=nightly%2F"
        );
        assert_eq!(amz_date, "20261025T040000Z");
        assert_eq!(
            authorization,
            "AWS4-HMAC-SHA256 Credential=test-key-id/20261025/auto/s3/aws4_request, \
             SignedHeaders=host;x-amz-content-sha256;x-amz-date, \
             Signature=890e7dc3f4874ff1d653e3ac975d37d033081f94716adef32bbb7d08bd8cb828"
        );
    }

    #[test]
    fn the_secret_never_shows_in_logs() {
        let settings = Settings {
            endpoint: Url::parse("https://example.r2.cloudflarestorage.com").unwrap(),
            bucket: "backups".into(),
            region: "auto".into(),
            key_id: "id".into(),
            secret: "very-secret-value".into(),
        };
        assert!(!format!("{settings:?}").contains("very-secret-value"));
    }

    #[test]
    fn reads_a_listing() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult><Name>b</Name><IsTruncated>true</IsTruncated>
<Contents><Key>nightly/2026-10-24.sqlite</Key><Size>1024</Size></Contents>
<Contents><Key>a&amp;b</Key><Size>7</Size></Contents>
<NextContinuationToken>abc==</NextContinuationToken></ListBucketResult>"#;
        assert_eq!(
            stored_files(xml),
            vec![
                Stored {
                    name: "nightly/2026-10-24.sqlite".into(),
                    bytes: 1024
                },
                Stored {
                    name: "a&b".into(),
                    bytes: 7
                },
            ]
        );
        assert_eq!(element(xml, "IsTruncated").as_deref(), Some("true"));
        assert_eq!(
            element(xml, "NextContinuationToken").as_deref(),
            Some("abc==")
        );
    }

    #[test]
    fn dates_and_names_are_written_the_way_signatures_need() {
        assert_eq!(amz_date(0), "19700101T000000Z");
        assert_eq!(amz_date(1_792_900_800), "20261025T040000Z");
        assert_eq!(encode("nightly/2026 a+b", true), "nightly/2026%20a%2Bb");
        assert_eq!(encode("abc==", false), "abc%3D%3D");
    }
}
