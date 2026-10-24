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

        Ok(Self {
            listen,
            data_dir: var("NINE_TURTLES_DATA_DIR")
                .unwrap_or_else(|| DEFAULT_DATA_DIR.to_owned())
                .into(),
            password: PasswordSetting::from_value(var("NINE_TURTLES_PASSWORD_HASH")),
            diagnostics_key: var("NINE_TURTLES_DIAGNOSTICS_KEY").map(|key| key.trim().to_owned()),
            local_feeds_allowed,
            test_check_seconds,
        })
    }
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
}
