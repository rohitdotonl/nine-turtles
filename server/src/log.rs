//! slowfeed's log: plain lines on standard error, which every host collects
//! (Render shows them in its Logs tab). Problems are also remembered, the
//! last few, so the diagnostics page and the daily check can see them.

use std::{collections::VecDeque, sync::Mutex};

use serde::Serialize;

/// How many recent problems the diagnostics page shows.
const REMEMBERED: usize = 20;

static PROBLEMS: Mutex<VecDeque<Problem>> = Mutex::new(VecDeque::new());

#[derive(Clone, Debug, Serialize)]
pub struct Problem {
    /// Seconds since 1970 (UTC).
    pub at: i64,
    pub message: String,
}

pub fn info(message: &str) {
    eprintln!("slowfeed: {message}");
}

/// Something went wrong that the owner or the daily check should know about.
/// Never pass anything secret or personal (passwords, keys, article text).
pub fn problem(message: &str) {
    eprintln!("slowfeed: problem: {message}");
    let mut problems = PROBLEMS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if problems.len() == REMEMBERED {
        problems.pop_front();
    }
    problems.push_back(Problem {
        at: crate::now(),
        message: message.to_owned(),
    });
}

/// The most recent problems, oldest first.
pub fn recent_problems() -> Vec<Problem> {
    PROBLEMS
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .iter()
        .cloned()
        .collect()
}
