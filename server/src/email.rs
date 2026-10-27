//! Sending email (decision 0088): the links that set a new password, sign
//! in, and confirm a changed address, and the
//! note that tells an old address it changed.
//!
//! nine turtles speaks plain SMTP (with `lettre`), so any email provider
//! works: Brevo to start with, chosen by the five `NINE_TURTLES_SMTP_*`
//! settings alone (docs/operations/email.md). Without them nothing is sent,
//! and what needs email says so calmly (signing up needs none, decision 0115).
//!
//! Emails are short plain text: no images, no tracking, no links but the
//! one the reader asked for. Sending happens behind the answer, so how long
//! a request takes never tells a stranger whether an email went out; a
//! failure is written to the log, never the address.
//!
//! The tests swap the SMTP connection for an `Outbox` that keeps each email
//! in memory (`Mailer::outbox`), so they read the links without a network.

use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use lettre::{
    Address, AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, header::ContentType},
    transport::smtp::authentication::Credentials,
};

use crate::log;

/// How long one email may take to hand over before nine turtles gives up.
const SEND_TIME_LIMIT: Duration = Duration::from_secs(20);

/// The SMTP settings (`NINE_TURTLES_SMTP_*`, read in `config`).
#[derive(Clone, PartialEq, Eq)]
pub struct Settings {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    /// Who emails come from, such as `nine turtles <hello@nineturtles.app>`.
    pub from: String,
}

/// Never shows the SMTP password, even in a debugging print of the settings.
impl std::fmt::Debug for Settings {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Settings")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("username", &self.username)
            .field("password", &"(hidden)")
            .field("from", &self.from)
            .finish()
    }
}

/// `text` as an address email can go to, if it's one and nothing more
/// (no name before it): what's parsed must be exactly what was typed.
pub fn address(text: &str) -> Option<Address> {
    text.parse::<Address>()
        .ok()
        .filter(|address| AsRef::<str>::as_ref(address) == text)
}

/// Whether a host is this computer. Only there may email go unencrypted
/// (the browser tests' made-up mail server), as with backups.
pub fn is_this_computer(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "::1" | "[::1]")
}

/// One email as the tests' outbox keeps it.
#[derive(Clone, Debug)]
pub struct Sent {
    pub to: String,
    pub subject: String,
    pub body: String,
}

/// Every email "sent" while the tests' outbox stands in for SMTP.
pub type Outbox = Arc<Mutex<Vec<Sent>>>;

/// Sends nine turtles' emails. Cheap to copy: the connection pool is shared.
#[derive(Clone)]
pub struct Mailer {
    from: Mailbox,
    /// nine turtles' own address (`NINE_TURTLES_PUBLIC_URL`), which every
    /// link starts with. Never taken from a request, so a stranger can't
    /// make a link point elsewhere.
    base: reqwest::Url,
    way: Way,
}

#[derive(Clone)]
enum Way {
    Smtp(AsyncSmtpTransport<Tokio1Executor>),
    Outbox(Outbox),
}

impl Mailer {
    /// Over SMTP: encrypted from the start on port 465, otherwise upgraded
    /// with STARTTLS before the password is sent (and refused if the
    /// server can't). Unencrypted only to this computer.
    pub fn smtp(settings: &Settings, base: reqwest::Url) -> Result<Self, String> {
        let from = parse_from(&settings.from)?;
        let builder = if is_this_computer(&settings.host) {
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&settings.host)
        } else if settings.port == 465 {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&settings.host)
                .map_err(|error| format!("NINE_TURTLES_SMTP_HOST can't be used: {error}"))?
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&settings.host)
                .map_err(|error| format!("NINE_TURTLES_SMTP_HOST can't be used: {error}"))?
        };
        let transport = builder
            .port(settings.port)
            .credentials(Credentials::new(
                settings.username.clone(),
                settings.password.clone(),
            ))
            .timeout(Some(SEND_TIME_LIMIT))
            .build();
        Ok(Self {
            from,
            base,
            way: Way::Smtp(transport),
        })
    }

    /// For tests: emails are kept in the returned outbox instead of sent.
    pub fn outbox(base: reqwest::Url) -> (Self, Outbox) {
        let outbox = Outbox::default();
        let mailer = Self {
            from: parse_from("nine turtles <hello@nineturtles.test>").unwrap_or_else(|_| {
                Mailbox::new(None, "hello@nineturtles.test".parse().expect("an address"))
            }),
            base,
            way: Way::Outbox(outbox.clone()),
        };
        (mailer, outbox)
    }

    /// A page of nine turtles with a ticket, such as
    /// `https://app.nineturtles.app/reset-password#ticket=…`.
    pub fn link(&self, page: &str, ticket: &str) -> String {
        let mut url = self.base.clone();
        url.set_path(page);
        url.set_query(None);
        // After the #, which browsers never send to a server, so the ticket
        // never reaches a log; the page sends it in a POST body.
        url.set_fragment(Some(&format!("ticket={ticket}")));
        url.to_string()
    }

    /// Sends one plain-text email behind the answer. `what` names it in the
    /// log if it fails ("a password link"); the address never goes there.
    pub fn send_later(&self, to: &str, subject: &str, body: String, what: &'static str) {
        let to_text = to.to_owned();
        let message = match self.message(to, subject, body.clone()) {
            Ok(message) => message,
            Err(error) => {
                log::problem(&format!("couldn't write {what}: {error}"));
                return;
            }
        };
        match &self.way {
            Way::Outbox(outbox) => {
                if let Ok(mut sent) = outbox.lock() {
                    sent.push(Sent {
                        to: to_text,
                        subject: subject.to_owned(),
                        body,
                    });
                }
            }
            Way::Smtp(transport) => {
                let transport = transport.clone();
                tokio::spawn(async move {
                    match transport.send(message).await {
                        Ok(_) => log::info(&format!("sent {what}")),
                        // Never the mail server's own words: they often
                        // repeat the address ("550 <x@y>: rejected").
                        Err(error) => {
                            log::problem(&format!("couldn't send {what}: {}", why_not_sent(&error)))
                        }
                    }
                });
            }
        }
    }

    fn message(&self, to: &str, subject: &str, body: String) -> Result<Message, String> {
        // A bare address only, never a name with one inside it.
        let to = Mailbox::new(
            None,
            address(to).ok_or_else(|| "the address isn't one email can go to".to_owned())?,
        );
        Message::builder()
            .from(self.from.clone())
            .to(to)
            .subject(subject)
            .header(ContentType::TEXT_PLAIN)
            .body(body)
            .map_err(|error| error.to_string())
    }
}

/// Why an email wasn't sent, in words that never include the address.
fn why_not_sent(error: &lettre::transport::smtp::Error) -> &'static str {
    if error.is_timeout() {
        "the mail server took too long"
    } else if error.is_permanent() {
        "the mail server refused it"
    } else if error.is_transient() {
        "the mail server asked to try later"
    } else {
        "the mail server couldn't be reached or signed in to"
    }
}

/// `NINE_TURTLES_SMTP_FROM`: an address, with or without a name before it.
pub fn parse_from(text: &str) -> Result<Mailbox, String> {
    text.trim().parse::<Mailbox>().map_err(|_| {
        format!(
            "NINE_TURTLES_SMTP_FROM must look like \"nine turtles <hello@nineturtles.app>\", got {text:?}"
        )
    })
}

/// The words every email ends with: who sent it, and that nothing else will come.
pub const SIGN_OFF: &str = "\n\nnine turtles\n";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_start_with_nine_turtles_own_address_and_carry_the_ticket() {
        let base = reqwest::Url::parse("https://app.nineturtles.app/somewhere?x=1").unwrap();
        let (mailer, _) = Mailer::outbox(base);
        assert_eq!(
            mailer.link("/reset-password", "ab12"),
            "https://app.nineturtles.app/reset-password#ticket=ab12"
        );
    }

    #[test]
    fn the_sender_may_have_a_name_and_must_be_an_address() {
        assert!(parse_from("nine turtles <hello@nineturtles.app>").is_ok());
        assert!(parse_from("hello@nineturtles.app").is_ok());
        assert!(parse_from("nine turtles").is_err());
    }

    #[test]
    fn the_settings_never_show_the_smtp_password() {
        let settings = Settings {
            host: "smtp-relay.brevo.com".to_owned(),
            port: 587,
            username: "login@example.com".to_owned(),
            password: "the-smtp-key".to_owned(),
            from: "hello@nineturtles.app".to_owned(),
        };
        let shown = format!("{settings:?}");
        assert!(!shown.contains("the-smtp-key"), "{shown}");
        assert!(shown.contains("smtp-relay.brevo.com"), "{shown}");
    }

    #[test]
    fn only_a_bare_address_is_one_email_goes_to() {
        assert!(address("mira@example.com").is_some());
        for named in [
            "evil<victim@example.com>",
            "evil <victim@example.com>",
            "<victim@example.com>",
            " mira@example.com",
        ] {
            assert!(address(named).is_none(), "{named}");
        }
    }

    #[test]
    fn the_outbox_keeps_what_would_have_been_sent() {
        let (mailer, outbox) = Mailer::outbox(reqwest::Url::parse("http://x.test").unwrap());
        mailer.send_later("mira@example.com", "Hello", "Body".to_owned(), "a test");
        mailer.send_later("not an address", "Hello", "Body".to_owned(), "a test");
        mailer.send_later(
            "evil<mira@example.com>",
            "Hello",
            "Body".to_owned(),
            "a test",
        );
        let sent = outbox.lock().unwrap();
        assert_eq!(sent.len(), 1);
        assert_eq!(sent[0].to, "mira@example.com");
    }
}
