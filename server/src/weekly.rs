//! The weekly email (SPEC section 39, decision 0150): the one thing nine
//! turtles sends that the reader didn't just ask for, so it's theirs to
//! choose. Off until they turn it on in Settings: once a week, Saturday
//! morning at 08:00 where they are (twice a week went, decision 0184); off
//! in one press from the link at its foot.
//!
//! It names the people the reader follows who wrote something they haven't
//! read since the last one, their titles and a line each (`letter`), never a
//! count. When there's nothing new, nothing is sent.
//!
//! It goes only to a confirmed address (`people.email_confirmed_at`,
//! decision 0154), so nobody can have it sent to a stranger.
//!
//! Its state is a few `person_settings` rows, which turning it off removes:
//! `weekly` ("weekly"), `weekly_offset` (the reader's minutes
//! ahead of UTC, from their browser when they chose), `weekly_since` (when
//! they chose), `weekly_sent_at` (the last time nine turtles looked for
//! them) and `weekly_stop` (the BLAKE2s scrambles of the last few stop
//! links' tickets, as hex; a ticket itself is only ever in its email), and
//! `weekly_moved` for a reader who had chosen twice a week, until their next
//! email tells them it's weekly now (structure change 43).

use std::{collections::HashMap, time::Duration};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

use crate::{
    AppState,
    auth::{SignedIn, database_problem, new_token, scramble},
    email::Mailer,
    encoding::hex,
    log, now, refused,
};

mod letter;

/// The page the stop link opens (`/weekly-email#ticket=…`).
pub const STOP_PAGE: &str = "/weekly-email";
/// How often nine turtles looks for readers whose email is due.
const LOOK_EVERY: Duration = Duration::from_secs(10 * 60);
/// The hour, where the reader is, the email goes out.
const HOUR: i64 = 8;
const DAY: i64 = 86_400;
const WEEK: i64 = 7 * DAY;
/// Saturday, counting Monday as 0.
const SATURDAY: i64 = 5;
/// How many emails back a stop link still works.
const STOP_LINKS_KEPT: usize = 10;
/// The furthest from UTC any place's clock is, in minutes.
const MOST_OFFSET: i64 = 14 * 60;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/weekly-email", get(read).post(change))
        .route("/api/weekly-email/stop", post(stop))
}

/// Whether the email comes: once a week, or not at all.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Often {
    Off,
    Weekly,
}

impl Often {
    fn stored(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::Weekly => "weekly",
        }
    }

    fn from_stored(text: Option<&str>) -> Self {
        match text {
            Some("weekly") => Self::Weekly,
            _ => Self::Off,
        }
    }

    /// The days it comes on, Monday being 0.
    fn days(self) -> &'static [i64] {
        match self {
            Self::Off => &[],
            Self::Weekly => &[SATURDAY],
        }
    }
}

/// The newest time at or before `at` the email was due for a reader whose
/// clock is `offset` minutes ahead of UTC, or `None` when it's off.
pub fn latest_due(often: Often, offset: i64, at: i64) -> Option<i64> {
    let shift = offset.clamp(-MOST_OFFSET, MOST_OFFSET) * 60;
    let local = at + shift;
    let today = local.div_euclid(DAY);
    (0..=7).find_map(|back| {
        let day = today - back;
        // 1 January 1970 was a Thursday: day 3, counting Monday as 0.
        let weekday = (day + 3).rem_euclid(7);
        let due = day * DAY + HOUR * 3600;
        (often.days().contains(&weekday) && due <= local).then_some(due - shift)
    })
}

async fn setting(db: &SqlitePool, person: i64, name: &str) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT value FROM person_settings WHERE person_id = ? AND name = ?")
        .bind(person)
        .bind(name)
        .fetch_optional(db)
        .await
}

async fn answer(db: &SqlitePool, person: i64) -> Result<Response, sqlx::Error> {
    let often = Often::from_stored(setting(db, person, "weekly").await?.as_deref());
    Ok(Json(json!({ "often": often.stored() })).into_response())
}

async fn read(SignedIn(person): SignedIn, State(state): State<AppState>) -> Response {
    match answer(&state.db, person).await {
        Ok(response) => response,
        Err(error) => database_problem("reading the weekly email", &error),
    }
}

#[derive(Deserialize)]
struct Change {
    often: Often,
    /// The reader's minutes ahead of UTC, from their browser.
    #[serde(default)]
    offset: i64,
}

async fn change(
    SignedIn(person): SignedIn,
    State(state): State<AppState>,
    Json(change): Json<Change>,
) -> Response {
    if change.often == Often::Off {
        return match turn_off(&state.db, person).await {
            Ok(()) => Json(json!({ "often": "off" })).into_response(),
            Err(error) => database_problem("turning the weekly email off", &error),
        };
    }
    if state.mailer.is_none() {
        return refused(StatusCode::CONFLICT, "no-email");
    }
    let address: Result<Option<(Option<String>, bool)>, _> =
        sqlx::query_as("SELECT email, email_confirmed_at IS NOT NULL FROM people WHERE id = ?")
            .bind(person)
            .fetch_optional(&state.db)
            .await;
    match address {
        Ok(Some((Some(_), true))) => {}
        Ok(Some((Some(_), false))) => return refused(StatusCode::CONFLICT, "unconfirmed"),
        Ok(_) => return refused(StatusCode::CONFLICT, "no-address"),
        Err(error) => return database_problem("reading an email", &error),
    }
    let offset = change.offset.clamp(-MOST_OFFSET, MOST_OFFSET);
    let done = async {
        turn_on(&state.db, person, change.often, offset).await?;
        answer(&state.db, person).await
    };
    match done.await {
        Ok(response) => response,
        Err(error) => database_problem("turning the weekly email on", &error),
    }
}

/// Saves one of the reader's `person_settings` rows.
async fn put(db: &SqlitePool, person: i64, name: &str, value: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO person_settings (person_id, name, value) VALUES (?, ?, ?)
         ON CONFLICT (person_id, name) DO UPDATE SET value = excluded.value",
    )
    .bind(person)
    .bind(name)
    .bind(value)
    .execute(db)
    .await
    .map(|_| ())
}

async fn turn_on(
    db: &SqlitePool,
    person: i64,
    often: Often,
    offset: i64,
) -> Result<(), sqlx::Error> {
    put(db, person, "weekly", often.stored()).await?;
    put(db, person, "weekly_offset", &offset.to_string()).await?;
    put(db, person, "weekly_since", &now().to_string()).await
}

async fn turn_off(db: &SqlitePool, person: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM person_settings WHERE person_id = ?
         AND name IN ('weekly', 'weekly_offset', 'weekly_since', 'weekly_sent_at', 'weekly_stop',
             'weekly_moved')",
    )
    .bind(person)
    .execute(db)
    .await
    .map(|_| ())
}

#[derive(Deserialize)]
struct Ticket {
    ticket: String,
}

/// Whose ticket this is, among the `name` rows' scrambles.
async fn whose(db: &SqlitePool, name: &str, ticket: &str) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT person_id FROM person_settings WHERE name = ? AND instr(value, ?) > 0",
    )
    .bind(name)
    .bind(hex(&scramble(ticket.trim())))
    .fetch_optional(db)
    .await
}

/// The stop link's page, pressed: the email is off for whoever's ticket it
/// is. Works signed out, from any device. A ticket that's no longer one (an
/// older email's, or the email was already off) is said plainly, so the
/// page never claims it stopped something it didn't (a 256-bit ticket can't
/// be guessed, so saying so gives nothing away).
async fn stop(State(state): State<AppState>, Json(form): Json<Ticket>) -> Response {
    let done = async {
        let Some(person) = whose(&state.db, "weekly_stop", &form.ticket).await? else {
            return Ok(false);
        };
        turn_off(&state.db, person).await.map(|()| true)
    };
    match done.await {
        Ok(true) => Json(json!({ "often": "off" })).into_response(),
        Ok(false) => refused(StatusCode::NOT_FOUND, "unknown"),
        Err(error) => database_problem("stopping the weekly email", &error),
    }
}

/// Looks for readers whose email is due every few minutes, while nine
/// turtles can send email.
pub async fn run(state: AppState) {
    let Some(mailer) = state.mailer.clone() else {
        return;
    };
    loop {
        if let Err(error) = send_due(&state.db, &mailer, now()).await {
            log::problem(&format!("couldn't send the weekly emails: {error}"));
        }
        tokio::time::sleep(LOOK_EVERY).await;
    }
}

/// One reader with the email on, as stored.
struct Chosen {
    person: i64,
    address: String,
    often: Often,
    offset: i64,
    since: i64,
    sent_at: Option<i64>,
    stop: String,
    /// Had chosen twice a week: the next email says it's weekly now.
    moved: bool,
}

/// Sends the email to each reader it's due for at `at`, and answers how
/// many were sent. Each reader is noted as done before their email goes, so
/// a restart never sends one twice.
pub async fn send_due(db: &SqlitePool, mailer: &Mailer, at: i64) -> Result<usize, sqlx::Error> {
    let rows: Vec<(i64, String, String, String)> = sqlx::query_as(
        "SELECT person_settings.person_id, people.email, person_settings.name, person_settings.value
         FROM person_settings JOIN people ON people.id = person_settings.person_id
         WHERE person_settings.name LIKE 'weekly%' AND people.email IS NOT NULL
             AND people.email_confirmed_at IS NOT NULL",
    )
    .fetch_all(db)
    .await?;
    let mut readers: HashMap<i64, (String, HashMap<String, String>)> = HashMap::new();
    for (person, address, name, value) in rows {
        readers
            .entry(person)
            .or_insert_with(|| (address, HashMap::new()))
            .1
            .insert(name, value);
    }
    let mut sent = 0;
    for (person, (address, values)) in readers {
        let number = |name: &str| values.get(name).and_then(|value| value.parse::<i64>().ok());
        let chosen = Chosen {
            person,
            often: Often::from_stored(values.get("weekly").map(String::as_str)),
            offset: number("weekly_offset").unwrap_or(0),
            since: number("weekly_since").unwrap_or(at),
            sent_at: number("weekly_sent_at"),
            stop: values.get("weekly_stop").cloned().unwrap_or_default(),
            moved: values.contains_key("weekly_moved"),
            address,
        };
        // One reader's trouble never keeps the others' emails back.
        match send_one(db, mailer, &chosen, at).await {
            Ok(true) => sent += 1,
            Ok(false) => {}
            Err(error) => log::problem(&format!("couldn't send a weekly email: {error}")),
        }
    }
    Ok(sent)
}

async fn send_one(
    db: &SqlitePool,
    mailer: &Mailer,
    chosen: &Chosen,
    at: i64,
) -> Result<bool, sqlx::Error> {
    let Some(due) = latest_due(chosen.often, chosen.offset, at) else {
        return Ok(false);
    };
    if due <= chosen.since.max(chosen.sent_at.unwrap_or(i64::MIN)) {
        return Ok(false);
    }
    // What arrived since the last look, and never more than a week back.
    let from = chosen.sent_at.unwrap_or(at - WEEK).max(at - WEEK);
    put(db, chosen.person, "weekly_sent_at", &at.to_string()).await?;
    let people = new_since(db, chosen.person, from).await?;
    if people.is_empty() {
        return Ok(false);
    }
    // The stop link carries a fresh ticket each time; only its scramble is
    // kept (`keep_stop`).
    let ticket = match new_token() {
        Ok(ticket) => ticket,
        Err(error) => {
            log::problem(&format!(
                "couldn't make a ticket to stop the weekly email: {error}"
            ));
            return Ok(false);
        }
    };
    keep_stop(db, chosen, &ticket).await?;
    let body = letter::compose(
        &people,
        chosen.moved,
        &mailer.home(),
        &mailer.link(STOP_PAGE, &ticket),
    );
    // The one-time line is spent once the email is handed to the mailer:
    // a delivery that later fails loses it, which is fine for a courtesy
    // note (the switch in Settings says when it comes).
    if chosen.moved {
        sqlx::query("DELETE FROM person_settings WHERE person_id = ? AND name = 'weekly_moved'")
            .bind(chosen.person)
            .execute(db)
            .await?;
    }
    mailer.send_later(&chosen.address, letter::SUBJECT, body, "a weekly email");
    Ok(true)
}

/// The stop links of the last `STOP_LINKS_KEPT` emails all work: their
/// tickets' scrambles are kept, newest first, separated by commas.
async fn keep_stop(db: &SqlitePool, chosen: &Chosen, ticket: &str) -> Result<(), sqlx::Error> {
    let kept: Vec<String> = std::iter::once(hex(&scramble(ticket)))
        .chain(
            chosen
                .stop
                .split(',')
                .filter(|each| each.len() == 64)
                .map(str::to_owned),
        )
        .take(STOP_LINKS_KEPT)
        .collect();
    put(db, chosen.person, "weekly_stop", &kept.join(",")).await
}

/// The people with something unread that arrived after `from`, by name,
/// each with their newest articles first.
async fn new_since(
    db: &SqlitePool,
    person: i64,
    from: i64,
) -> Result<Vec<letter::Person>, sqlx::Error> {
    type Row = (
        i64,
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
    );
    let rows: Vec<Row> = sqlx::query_as(concat!(
        "SELECT ",
        crate::feeds::whose!(),
        ", COALESCE(writers.name, subscriptions.title),
                articles.title, articles.link, articles.summary, articles.content
         FROM entries
         JOIN articles ON articles.id = entries.article_id
         JOIN subscriptions ON subscriptions.person_id = entries.person_id
             AND subscriptions.feed_id = entries.feed_id
         LEFT JOIN writers ON writers.id = subscriptions.writer_id
         WHERE entries.person_id = ? AND entries.read = 0 AND entries.muted = 0
             AND subscriptions.unsubscribed_at IS NULL AND articles.received_at > ?
         ORDER BY articles.sort_at DESC, articles.id DESC
         LIMIT 2000"
    ))
    .bind(person)
    .bind(from)
    .fetch_all(db)
    .await?;
    let mut people: Vec<(i64, letter::Person)> = Vec::new();
    for (key, name, title, link, summary, content) in rows {
        // A person with several places is one; a place on its own is its own
        // (`feeds::whose!`, as Unread lists them).
        let index = match people.iter().position(|(each, _)| *each == key) {
            Some(index) => index,
            None => {
                people.push((
                    key,
                    letter::Person {
                        name,
                        articles: Vec::new(),
                    },
                ));
                people.len() - 1
            }
        };
        let articles = &mut people[index].1.articles;
        // One past the most shown is enough to say there's more.
        if articles.len() <= letter::MOST_TITLES {
            articles.push(letter::Article {
                line: letter::line_from(summary.as_deref(), content.as_deref()),
                title,
                link: link
                    .filter(|link| link.starts_with("https://") || link.starts_with("http://")),
            });
        }
    }
    let mut people: Vec<letter::Person> = people.into_iter().map(|(_, person)| person).collect();
    people.sort_by_key(|person| person.name.to_lowercase());
    Ok(people)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Saturday 31 October 2026, 08:00 UTC.
    const SATURDAY_EIGHT: i64 = 1_793_433_600;

    #[test]
    fn saturday_eight_is_a_saturday_at_eight() {
        assert_eq!(SATURDAY_EIGHT.rem_euclid(DAY), 8 * 3600);
        assert_eq!((SATURDAY_EIGHT.div_euclid(DAY) + 3).rem_euclid(7), SATURDAY);
    }

    #[test]
    fn it_is_due_at_eight_on_saturday_where_the_reader_is() {
        assert_eq!(
            latest_due(Often::Weekly, 0, SATURDAY_EIGHT),
            Some(SATURDAY_EIGHT)
        );
        assert_eq!(
            latest_due(Often::Weekly, 0, SATURDAY_EIGHT - 1),
            Some(SATURDAY_EIGHT - WEEK)
        );
        // In India (UTC+5:30), eight o'clock comes 5½ hours sooner.
        assert_eq!(
            latest_due(Often::Weekly, 330, SATURDAY_EIGHT),
            Some(SATURDAY_EIGHT - 330 * 60)
        );
        // In New York (UTC−5), later.
        assert_eq!(
            latest_due(Often::Weekly, -300, SATURDAY_EIGHT),
            Some(SATURDAY_EIGHT - WEEK + 300 * 60)
        );
        assert_eq!(latest_due(Often::Off, 0, SATURDAY_EIGHT), None);
    }
}
