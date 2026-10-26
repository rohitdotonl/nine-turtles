//! nine turtles' settings. They come from environment variables only (never from
//! the code or a file in the repository), so secrets stay with the host.
//! Every variable is listed in docs/operations/settings.md.

use std::{net::SocketAddr, path::PathBuf};

use argon2::password_hash::phc::PasswordHash;

/// Where nine turtles listens when `NINE_TURTLES_LISTEN` isn't set. Only this computer
/// can reach it; the container image sets the variable for hosting.
const DEFAULT_LISTEN: &str = "127.0.0.1:8080";
/// Where the database lives when `NINE_TURTLES_DATA_DIR` isn't set.
const DEFAULT_DATA_DIR: &str = "data";

#[derive(Clone, Debug)]
pub struct Config {
    pub listen: SocketAddr,
    /// The folder holding the database file. On Render, the 1 GB disk.
    pub data_dir: PathBuf,
    pub password: PasswordSetting,
    /// The read-only key for the diagnostics page. Without it the page is off.
    pub diagnostics_key: Option<String>,
    /// Lets nine turtles fetch feeds from this computer and private networks.
    /// Only the browser tests set it, to serve made-up feeds; never on Render.
    pub local_feeds_allowed: bool,
    /// Checks every feed this many seconds apart, ignoring its rhythm and
    /// the 30-minute minimum, so a browser test needn't wait half an hour.
    /// Only honored together with `local_feeds_allowed`, so it can never
    /// make the live app impolite to real publishers.
    pub test_check_seconds: Option<i64>,
    /// The address the world reaches nine turtles at, such as
    /// `https://app.nineturtles.app`. WebSub hubs deliver new articles there;
    /// without it, nine turtles doesn't sign up with hubs (SPEC section 12).
    pub public_url: Option<reqwest::Url>,
    /// Where backups go (`NINE_TURTLES_BACKUP_*`). Without it, no backups.
    pub backup: Option<crate::storage::Settings>,
    /// A stored backup to bring back when there's no database yet, such as
    /// `nightly/2026-10-25.sqlite` (`NINE_TURTLES_RESTORE_FROM`).
    pub restore_from: Option<String>,
    /// How emails are sent (`NINE_TURTLES_SMTP_*`, decision 0088). Without
    /// it, nothing is sent: no confirmation or password emails, and Open
    /// sign-up stays refused.
    pub smtp: Option<crate::email::Settings>,
    /// The shared secret mail services post newsletter emails with
    /// (`NINE_TURTLES_NEWSLETTER_SECRET`). Without it, newsletters are off.
    pub newsletter_secret: Option<String>,
}

/// The scrambled password (`NINE_TURTLES_PASSWORD_HASH`), made by
/// `nine-turtles set-password`. Until it's set, every sign-in is refused.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PasswordSetting {
    Missing,
    /// Set, but not something `nine-turtles set-password` made (a copy-paste slip).
    Invalid,
    Set(String),
}

impl PasswordSetting {
    pub fn from_value(value: Option<String>) -> Self {
        match value.map(|value| value.trim().to_owned()) {
            None => Self::Missing,
            Some(value) if value.is_empty() => Self::Missing,
            Some(value) if PasswordHash::new(&value).is_ok() => Self::Set(value),
            Some(_) => Self::Invalid,
        }
    }

    /// How the diagnostics page and the logs describe it. Never the value.
    pub fn describe(&self) -> &'static str {
        match self {
            Self::Missing => "missing",
            Self::Invalid => "invalid",
            Self::Set(_) => "set",
        }
    }
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        // Each setting is read by its name, or by the name it had before the
        // rename (SLOWFEED_…), so a host that still uses the old names keeps working.
        let var = |name: &str| {
            let read = |name: &str| {
                std::env::var(name)
                    .ok()
                    .filter(|value| !value.trim().is_empty())
            };
            read(name).or_else(|| read(&name.replacen("NINE_TURTLES_", "SLOWFEED_", 1)))
        };

        let listen_text = var("NINE_TURTLES_LISTEN").unwrap_or_else(|| DEFAULT_LISTEN.to_owned());
        let listen = listen_text.parse().map_err(|_| {
            format!("NINE_TURTLES_LISTEN must look like 127.0.0.1:8080, got {listen_text:?}")
        })?;

        let local_feeds_allowed =
            var("NINE_TURTLES_ALLOW_LOCAL_FEEDS").is_some_and(|value| value.trim() == "yes");
        let test_check_seconds = var("NINE_TURTLES_TEST_CHECK_SECONDS")
            .filter(|_| local_feeds_allowed)
            .map(|value| {
                value
                    .trim()
                    .parse::<i64>()
                    .ok()
                    .filter(|seconds| *seconds > 0)
                    .ok_or_else(|| {
                        format!(
                            "NINE_TURTLES_TEST_CHECK_SECONDS must be a number of seconds, got {value:?}"
                        )
                    })
            })
            .transpose()?;

        let public_url = var("NINE_TURTLES_PUBLIC_URL")
            .map(|value| {
                reqwest::Url::parse(value.trim())
                    .ok()
                    .filter(|url| matches!(url.scheme(), "http" | "https") && url.has_host())
                    .ok_or_else(|| {
                        format!(
                            "NINE_TURTLES_PUBLIC_URL must look like https://app.nineturtles.app, got {value:?}"
                        )
                    })
            })
            .transpose()?;

        let backup = backup_settings(&var)?;
        let restore_from = var("NINE_TURTLES_RESTORE_FROM").map(|name| name.trim().to_owned());
        let smtp = smtp_settings(&var)?;
        if smtp.is_some() && public_url.is_none() {
            return Err("the email settings (NINE_TURTLES_SMTP_*) are set but \
                 NINE_TURTLES_PUBLIC_URL isn't: every link in an email starts with that address, \
                 so set it too (docs/operations/email.md)"
                .to_owned());
        }

        let newsletter_secret = newsletter_secret(var("NINE_TURTLES_NEWSLETTER_SECRET"))?;

        Ok(Self {
            listen,
            data_dir: var("NINE_TURTLES_DATA_DIR")
                .unwrap_or_else(|| DEFAULT_DATA_DIR.to_owned())
                .into(),
            password: PasswordSetting::from_value(var("NINE_TURTLES_PASSWORD_HASH")),
            diagnostics_key: var("NINE_TURTLES_DIAGNOSTICS_KEY").map(|key| key.trim().to_owned()),
            local_feeds_allowed,
            test_check_seconds,
            public_url,
            backup,
            restore_from,
            smtp,
            newsletter_secret,
        })
    }
}

/// The newsletter secret, if set: long enough that nobody can guess it.
fn newsletter_secret(value: Option<String>) -> Result<Option<String>, String> {
    let Some(secret) = value.map(|secret| secret.trim().to_owned()) else {
        return Ok(None);
    };
    if secret.chars().count() < crate::newsletters::SHORTEST_SECRET {
        return Err(format!(
            "NINE_TURTLES_NEWSLETTER_SECRET must be at least {} characters long, so nobody can \
             guess it; Render's Generate button makes one",
            crate::newsletters::SHORTEST_SECRET
        ));
    }
    Ok(Some(secret))
}

/// The backup storage settings: all four of endpoint, bucket, key id and
/// secret, or none (backups off). Some but not all is a slip worth stopping for.
fn backup_settings(
    var: &dyn Fn(&str) -> Option<String>,
) -> Result<Option<crate::storage::Settings>, String> {
    let names = [
        "NINE_TURTLES_BACKUP_ENDPOINT",
        "NINE_TURTLES_BACKUP_BUCKET",
        "NINE_TURTLES_BACKUP_KEY_ID",
        "NINE_TURTLES_BACKUP_SECRET",
    ];
    let values: Vec<Option<String>> = names
        .iter()
        .map(|name| var(name).map(|value| value.trim().to_owned()))
        .collect();
    if values.iter().all(Option::is_none) {
        return Ok(None);
    }
    let missing: Vec<&str> = names
        .iter()
        .zip(&values)
        .filter(|(_, value)| value.is_none())
        .map(|(name, _)| *name)
        .collect();
    if !missing.is_empty() {
        return Err(format!(
            "backups need all four backup settings; missing: {}",
            missing.join(", ")
        ));
    }
    let [endpoint, bucket, key_id, secret] =
        <[Option<String>; 4]>::try_from(values).map_err(|_| "four settings".to_owned())?;
    let endpoint_text = endpoint.unwrap_or_default();
    let endpoint = reqwest::Url::parse(&endpoint_text)
        .ok()
        .filter(|url| {
            // Plain http only to this computer (MinIO for testing): the
            // database must never cross the internet unencrypted.
            url.scheme() == "https"
                || (url.scheme() == "http"
                    && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")))
        })
        .filter(|url| url.has_host())
        .ok_or_else(|| {
            format!(
                "NINE_TURTLES_BACKUP_ENDPOINT must look like \
                 https://<account>.r2.cloudflarestorage.com, got {endpoint_text:?}"
            )
        })?;
    Ok(Some(crate::storage::Settings {
        endpoint,
        bucket: bucket.unwrap_or_default(),
        region: var("NINE_TURTLES_BACKUP_REGION")
            .map(|value| value.trim().to_owned())
            .unwrap_or_else(|| "auto".to_owned()),
        key_id: key_id.unwrap_or_default(),
        secret: secret.unwrap_or_default(),
    }))
}

/// The email settings: host, username, password and sender, or none (no
/// email). Some but not all (the port alone too) is a slip worth stopping
/// for, as are these without NINE_TURTLES_PUBLIC_URL (checked in
/// `Config::from_env`). The port is 587
/// (STARTTLS) unless set; 465 means encrypted from the start.
fn smtp_settings(
    var: &dyn Fn(&str) -> Option<String>,
) -> Result<Option<crate::email::Settings>, String> {
    let names = [
        "NINE_TURTLES_SMTP_HOST",
        "NINE_TURTLES_SMTP_USERNAME",
        "NINE_TURTLES_SMTP_PASSWORD",
        "NINE_TURTLES_SMTP_FROM",
    ];
    let values: Vec<Option<String>> = names
        .iter()
        .map(|name| var(name).map(|value| value.trim().to_owned()))
        .collect();
    // The port alone counts as some: it's a slip too.
    if values.iter().all(Option::is_none) && var("NINE_TURTLES_SMTP_PORT").is_none() {
        return Ok(None);
    }
    let missing: Vec<&str> = names
        .iter()
        .zip(&values)
        .filter(|(_, value)| value.is_none())
        .map(|(name, _)| *name)
        .collect();
    if !missing.is_empty() {
        return Err(format!(
            "sending email needs all of host, username, password and sender; missing: {}",
            missing.join(", ")
        ));
    }
    let [host, username, password, from] =
        <[Option<String>; 4]>::try_from(values).map_err(|_| "four settings".to_owned())?;
    let port = match var("NINE_TURTLES_SMTP_PORT") {
        None => 587,
        Some(text) => text
            .trim()
            .parse::<u16>()
            .ok()
            .filter(|port| *port > 0)
            .ok_or_else(|| {
                format!("NINE_TURTLES_SMTP_PORT must be a number such as 587, got {text:?}")
            })?,
    };
    let from = from.unwrap_or_default();
    crate::email::parse_from(&from)?;
    Ok(Some(crate::email::Settings {
        host: host.unwrap_or_default(),
        port,
        username: username.unwrap_or_default(),
        password: password.unwrap_or_default(),
        from,
    }))
}

#[cfg(test)]
mod tests {
    use super::PasswordSetting;

    #[test]
    fn a_pasted_hash_with_stray_spaces_still_works() {
        let hash = crate::password::hash("correct horse battery staple").unwrap();
        assert_eq!(
            PasswordSetting::from_value(Some(format!("  {hash}\n"))),
            PasswordSetting::Set(hash)
        );
    }

    #[test]
    fn an_empty_or_garbled_setting_is_reported_not_trusted() {
        assert_eq!(PasswordSetting::from_value(None), PasswordSetting::Missing);
        assert_eq!(
            PasswordSetting::from_value(Some(" ".into())),
            PasswordSetting::Missing
        );
        assert_eq!(
            PasswordSetting::from_value(Some("my password".into())),
            PasswordSetting::Invalid
        );
    }

    #[test]
    fn a_newsletter_secret_must_be_long() {
        use super::newsletter_secret;
        assert_eq!(newsletter_secret(None).unwrap(), None);
        assert!(newsletter_secret(Some("short".into())).is_err());
        let long = "x".repeat(40);
        assert_eq!(
            newsletter_secret(Some(format!(" {long}\n"))).unwrap(),
            Some(long)
        );
    }

    #[test]
    fn backup_settings_are_all_or_nothing_and_never_plain_http_to_the_internet() {
        use super::backup_settings;
        let with = |pairs: &'static [(&'static str, &'static str)]| {
            move |name: &str| {
                pairs
                    .iter()
                    .find(|(key, _)| *key == name)
                    .map(|(_, value)| (*value).to_owned())
            }
        };
        assert_eq!(backup_settings(&with(&[])).unwrap(), None);

        let error = backup_settings(&with(&[("NINE_TURTLES_BACKUP_BUCKET", "b")])).unwrap_err();
        assert!(error.contains("NINE_TURTLES_BACKUP_SECRET"), "{error}");
        assert!(!error.contains("NINE_TURTLES_BACKUP_BUCKET,"), "{error}");

        let all = |endpoint: &'static str| -> &'static [(&'static str, &'static str)] {
            Box::leak(Box::new([
                ("NINE_TURTLES_BACKUP_ENDPOINT", endpoint),
                ("NINE_TURTLES_BACKUP_BUCKET", "nine-turtles-backups"),
                ("NINE_TURTLES_BACKUP_KEY_ID", "id"),
                ("NINE_TURTLES_BACKUP_SECRET", "secret"),
            ]))
        };
        let settings = backup_settings(&with(all("https://abc.r2.cloudflarestorage.com")))
            .unwrap()
            .unwrap();
        assert_eq!(settings.region, "auto");
        assert_eq!(settings.bucket, "nine-turtles-backups");
        assert!(backup_settings(&with(all("http://localhost:9000"))).is_ok());
        assert!(backup_settings(&with(all("http://abc.r2.cloudflarestorage.com"))).is_err());
        assert!(backup_settings(&with(all("not an address"))).is_err());
    }

    #[test]
    fn email_settings_are_all_or_nothing_and_the_port_is_587_unless_set() {
        use super::smtp_settings;
        let with = |pairs: Vec<(&'static str, &'static str)>| {
            move |name: &str| {
                pairs
                    .iter()
                    .find(|(key, _)| *key == name)
                    .map(|(_, value)| (*value).to_owned())
            }
        };
        assert_eq!(smtp_settings(&with(vec![])).unwrap(), None);
        let error = smtp_settings(&with(vec![(
            "NINE_TURTLES_SMTP_HOST",
            "smtp-relay.brevo.com",
        )]))
        .unwrap_err();
        assert!(error.contains("NINE_TURTLES_SMTP_FROM"), "{error}");
        assert!(!error.contains("NINE_TURTLES_SMTP_HOST"), "{error}");
        // The port alone is a slip too, and names all four missing.
        let error = smtp_settings(&with(vec![("NINE_TURTLES_SMTP_PORT", "465")])).unwrap_err();
        assert!(error.contains("NINE_TURTLES_SMTP_HOST"), "{error}");
        assert!(error.contains("NINE_TURTLES_SMTP_FROM"), "{error}");

        let all = vec![
            ("NINE_TURTLES_SMTP_HOST", "smtp-relay.brevo.com"),
            ("NINE_TURTLES_SMTP_USERNAME", "login@example.com"),
            ("NINE_TURTLES_SMTP_PASSWORD", "key"),
            (
                "NINE_TURTLES_SMTP_FROM",
                "nine turtles <hello@nineturtles.app>",
            ),
        ];
        let settings = smtp_settings(&with(all.clone())).unwrap().unwrap();
        assert_eq!(settings.port, 587);
        let mut on_465 = all.clone();
        on_465.push(("NINE_TURTLES_SMTP_PORT", "465"));
        assert_eq!(smtp_settings(&with(on_465)).unwrap().unwrap().port, 465);
        let mut bad_port = all.clone();
        bad_port.push(("NINE_TURTLES_SMTP_PORT", "smtp"));
        assert!(smtp_settings(&with(bad_port)).is_err());
        let mut bad_from = all;
        bad_from[3] = ("NINE_TURTLES_SMTP_FROM", "nine turtles");
        assert!(smtp_settings(&with(bad_from)).is_err());
    }
}
