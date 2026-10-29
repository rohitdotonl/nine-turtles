//! nine turtles' log: plain lines on standard error, which every host collects
//! (Render shows them in its Logs tab). Problems are also remembered, the
//! last few, so the diagnostics page and the daily check can see them.

use std::{
    collections::VecDeque,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
};

use serde::Serialize;

/// How many recent problems the diagnostics page shows.
const REMEMBERED: usize = 20;

static PROBLEMS: Mutex<VecDeque<Problem>> = Mutex::new(VecDeque::new());
/// Every problem since nine turtles started, not only the remembered ones.
static COUNTED: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, Serialize)]
pub struct Problem {
    /// Seconds since 1970 (UTC).
    pub at: i64,
    pub message: String,
}

pub fn info(message: &str) {
    eprintln!("nine-turtles: {message}");
}

/// Something went wrong that the owner or the daily check should know about.
/// Never pass anything secret or personal (passwords, keys, article text).
pub fn problem(message: &str) {
    eprintln!("nine-turtles: problem: {message}");
    COUNTED.fetch_add(1, Ordering::Relaxed);
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

/// How many problems were logged since nine turtles started (the owner
/// report shows the count, never the text).
pub fn problems_since_start() -> u64 {
    COUNTED.load(Ordering::Relaxed)
}
