//! The password: scrambling it with argon2 (argon2id), checking it, and the
//! `nine-turtles set-password` command the owner runs in Render's Shell tab.
//! See docs/decisions/0010-sign-in.md.

use std::io::{BufRead, Write};

use argon2::{
    Argon2,
    password_hash::{PasswordHasher, PasswordVerifier, phc::PasswordHash},
};

/// Long enough to be hard to guess, short enough to type on a phone.
pub const MINIMUM_LENGTH: usize = 12;
/// Anything longer is refused before scrambling, so nobody can make the
/// server do a lot of work by sending an enormous "password".
pub const MAXIMUM_LENGTH: usize = 1024;

/// Scrambles a password into the line stored in `NINE_TURTLES_PASSWORD_HASH`.
/// Each call uses a fresh random salt, so the same password gives a
/// different line every time.
pub fn hash(password: &str) -> Result<String, String> {
    Argon2::default()
        .hash_password(password.as_bytes())
        .map(|hash| hash.to_string())
        .map_err(|error| format!("couldn't scramble the password: {error}"))
}

/// Deliberately slow (a fraction of a second): run it off the async threads.
pub fn matches(password: &str, stored: &str) -> bool {
    if password.len() > MAXIMUM_LENGTH {
        return false;
    }
    PasswordHash::new(stored).is_ok_and(|stored| {
        Argon2::default()
            .verify_password(password.as_bytes(), &stored)
            .is_ok()
    })
}

/// `nine-turtles set-password`: asks for the password twice and prints the
/// scrambled line to paste into the host's settings. The readable password
/// is never written anywhere.
pub fn set_password_command() -> Result<(), String> {
    eprintln!("Choose nine turtles' password (at least {MINIMUM_LENGTH} characters).");
    eprintln!("What you type isn't shown.");
    let first = ask("Password: ")?;
    if first.chars().count() < MINIMUM_LENGTH {
        return Err(format!(
            "that's shorter than {MINIMUM_LENGTH} characters; nothing was changed"
        ));
    }
    if first.len() > MAXIMUM_LENGTH {
        return Err(format!(
            "that's longer than {MAXIMUM_LENGTH} bytes; nothing was changed"
        ));
    }
    let second = ask("Type it again: ")?;
    if first != second {
        return Err("the two didn't match; nothing was changed".to_owned());
    }

    let line = hash(&first)?;
    eprintln!();
    eprintln!("Copy the whole line below into the NINE_TURTLES_PASSWORD_HASH setting,");
    eprintln!("save, and let nine turtles restart. It's the scrambled form, not your password.");
    eprintln!();
    println!("{line}");
    Ok(())
}

/// Reads one line with typing hidden. Hiding uses the standard `stty`
/// command, so no extra library is needed; if it isn't available the
/// password is read anyway, just visibly.
fn ask(prompt: &str) -> Result<String, String> {
    eprint!("{prompt}");
    let _ = std::io::stderr().flush();

    let hidden = stty("-echo");
    let mut line = String::new();
    let read = std::io::stdin().lock().read_line(&mut line);
    if hidden {
        stty("echo");
        eprintln!();
    }
    read.map_err(|error| format!("couldn't read what was typed: {error}"))?;

    Ok(line.trim_end_matches(['\r', '\n']).to_owned())
}

/// Turns typing display back on, for when `set-password` is cancelled with
/// Ctrl+C while it's hidden.
pub fn show_typing() {
    stty("echo");
}

fn stty(setting: &str) -> bool {
    std::process::Command::new("stty")
        .arg(setting)
        .stdin(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

#[cfg(test)]
mod tests {
    use super::{MAXIMUM_LENGTH, hash, matches};

    #[test]
    fn the_right_password_matches_and_others_dont() {
        let stored = hash("a quiet place to read").unwrap();
        assert!(stored.starts_with("$argon2id$"));
        assert!(matches("a quiet place to read", &stored));
        assert!(!matches("a quiet place to read ", &stored));
        assert!(!matches("A quiet place to read", &stored));
        assert!(!matches("", &stored));
    }

    #[test]
    fn the_same_password_scrambles_differently_each_time() {
        assert_ne!(
            hash("same password").unwrap(),
            hash("same password").unwrap()
        );
    }

    #[test]
    fn enormous_input_is_refused_without_scrambling() {
        let stored = hash("short").unwrap();
        assert!(!matches(&"x".repeat(MAXIMUM_LENGTH + 1), &stored));
    }
}
