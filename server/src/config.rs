//! slowfeed's settings. They come from environment variables only (never from
//! the code or a file in the repository), so secrets stay with the host.
//! Every variable is listed in docs/operations/settings.md.

use std::{net::SocketAddr, path::PathBuf};

use argon2::password_hash::phc::PasswordHash;

/// Where slowfeed listens when `SLOWFEED_LISTEN` isn't set. Only this computer
/// can reach it; the container image sets the variable for hosting.
const DEFAULT_LISTEN: &str = "127.0.0.1:8080";
/// Where the database lives when `SLOWFEED_DATA_DIR` isn't set.
const DEFAULT_DATA_DIR: &str = "data";

#[derive(Clone, Debug)]
pub struct Config {
    pub listen: SocketAddr,
    /// The folder holding the database file. On Render, the 1 GB disk.
    pub data_dir: PathBuf,
    pub password: PasswordSetting,
    /// The read-only key for the diagnostics page. Without it the page is off.
    pub diagnostics_key: Option<String>,
}

/// The scrambled password (`SLOWFEED_PASSWORD_HASH`), made by
/// `slowfeed set-password`. Until it's set, every sign-in is refused.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum PasswordSetting {
    Missing,
    /// Set, but not something `slowfeed set-password` made (a copy-paste slip).
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
        let var = |name: &str| {
            std::env::var(name)
                .ok()
                .filter(|value| !value.trim().is_empty())
        };

        let listen_text = var("SLOWFEED_LISTEN").unwrap_or_else(|| DEFAULT_LISTEN.to_owned());
        let listen = listen_text.parse().map_err(|_| {
            format!("SLOWFEED_LISTEN must look like 127.0.0.1:8080, got {listen_text:?}")
        })?;

        Ok(Self {
            listen,
            data_dir: var("SLOWFEED_DATA_DIR")
                .unwrap_or_else(|| DEFAULT_DATA_DIR.to_owned())
                .into(),
            password: PasswordSetting::from_value(var("SLOWFEED_PASSWORD_HASH")),
            diagnostics_key: var("SLOWFEED_DIAGNOSTICS_KEY").map(|key| key.trim().to_owned()),
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
