//! Backups (SPEC section 23, decision 0076): every night, a consistent copy
//! of the database goes to S3-compatible storage outside the host (`storage`),
//! and another just before each change to the database's structure. Kept:
//! the last 30 nightly copies, one a month for a year, and the last 10 taken
//! before a structure change. A copy can be brought back on a fresh disk with
//! `NINE_TURTLES_RESTORE_FROM` (docs/operations/backups.md).
//!
//! Each copy is a whole, ordinary SQLite file that any SQLite tool opens, made
//! with `VACUUM INTO` while nine turtles keeps running. The copy is made in
//! the computer's temporary folder, never on the data disk, so backups never
//! need spare room there, and it's checked before it's uploaded.

use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicU32, Ordering},
    time::Duration,
};

use sqlx::{
    Connection, SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteConnection},
};

use crate::{AppState, db, log, now, storage::Storage};

/// Nightly copies are kept for this many nights.
pub const NIGHTLY_KEPT: usize = 30;
/// The first copy of each month is also kept as the month's copy, for a year.
pub const MONTHLY_KEPT: usize = 12;
/// Copies taken just before a structure change.
pub const BEFORE_CHANGE_KEPT: usize = 10;
/// The nightly copy is taken in the first hour after this (UTC): 04:00 in
/// London in winter, a quiet time for publishers and the reader.
const NIGHTLY_HOUR: i64 = 3;
/// How often nine turtles looks whether tonight's copy is due, and how soon a
/// failed copy is tried again.
const LOOK_EVERY: Duration = Duration::from_secs(60 * 60);

const NIGHTLY: &str = "nightly/";
const MONTHLY: &str = "monthly/";
const BEFORE_CHANGE: &str = "before-change/";

/// Takes tonight's copy when it's due, for as long as nine turtles runs.
/// `main` starts it; without backup settings it says so once and stops.
pub async fn run(state: AppState) {
    let Some(storage) = state.storage.clone() else {
        log::problem(
            "backups are off: the NINE_TURTLES_BACKUP_* settings aren't set \
             (docs/operations/backups.md)",
        );
        return;
    };
    // After a restart, carry on from the newest copy already stored, so a
    // night's copy isn't taken twice.
    match storage.list(NIGHTLY).await {
        Ok(stored) => {
            if let Some(newest) = stored.last() {
                remember(&state, &newest.name);
            }
        }
        Err(error) => log::problem(&format!("couldn't look at the stored backups: {error}")),
    }
    loop {
        let at = now();
        let latest = state
            .latest_backup
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone();
        if nightly_due(latest.as_deref(), at) {
            match nightly(&state.db, &storage, at).await {
                Ok(name) => {
                    log::info(&format!("backed up the database as {name}"));
                    remember(&state, &name);
                }
                Err(error) => log::problem(&format!(
                    "tonight's backup failed; trying again in an hour: {error}"
                )),
            }
        }
        tokio::time::sleep(LOOK_EVERY).await;
    }
}

fn remember(state: &AppState, name: &str) {
    *state
        .latest_backup
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(name.to_owned());
}

/// Whether tonight's copy should be taken now, given the newest nightly copy
/// stored (its name). Due after 03:00 UTC once a day; at once if there's no
/// copy at all, or a night was missed (nine turtles was off, or it failed).
pub fn nightly_due(latest: Option<&str>, at: i64) -> bool {
    let Some(latest) = latest.and_then(|name| name.strip_prefix(NIGHTLY)) else {
        return true;
    };
    let today = day_name(at);
    let yesterday = day_name(at - 86_400);
    let latest_day = latest.trim_end_matches(".sqlite");
    if latest_day >= today.as_str() {
        false
    } else if latest_day < yesterday.as_str() {
        true
    } else {
        at.rem_euclid(86_400) >= NIGHTLY_HOUR * 3_600
    }
}

/// Takes and uploads tonight's copy (and this month's, if it's the month's
/// first), then deletes copies older than the keeping rules. Returns the
/// nightly copy's name.
pub async fn nightly(db: &SqlitePool, storage: &Storage, at: i64) -> Result<String, String> {
    let copy = snapshot(db).await?;
    let name = format!("{NIGHTLY}{}.sqlite", day_name(at));
    storage.put(&name, copy.path()).await?;

    let month = format!("{MONTHLY}{}.sqlite", &day_name(at)[..7]);
    let months = storage.list(MONTHLY).await?;
    if !months.iter().any(|stored| stored.name == month) {
        storage.put(&month, copy.path()).await?;
    }
    drop(copy);

    prune(storage, NIGHTLY, NIGHTLY_KEPT).await;
    prune(storage, MONTHLY, MONTHLY_KEPT).await;
    Ok(name)
}

/// Takes and uploads a copy just before the database's structure changes,
/// named after the time and the change about to happen.
pub async fn before_structure_change(
    db: &SqlitePool,
    storage: &Storage,
    at: i64,
    next_change: i64,
) -> Result<String, String> {
    let copy = snapshot(db).await?;
    let name = format!(
        "{BEFORE_CHANGE}{}-before-change-{next_change}.sqlite",
        time_name(at)
    );
    storage.put(&name, copy.path()).await?;
    drop(copy);
    prune(storage, BEFORE_CHANGE, BEFORE_CHANGE_KEPT).await;
    Ok(name)
}

/// Deletes all but the newest `keep` copies under `prefix`. Names start
/// with the date, so name order is age order. The new copy is already
/// stored, so a failure here is only reported: it never fails the backup,
/// and the next copy tries again.
async fn prune(storage: &Storage, prefix: &str, keep: usize) {
    let result = async {
        let stored = storage.list(prefix).await?;
        let extra = stored.len().saturating_sub(keep);
        for old in &stored[..extra] {
            storage.delete(&old.name).await?;
        }
        Ok::<_, String>(())
    }
    .await;
    if let Err(error) = result {
        log::problem(&format!(
            "the backup is stored, but older copies couldn't be deleted: {error}"
        ));
    }
}

/// Brings back a stored copy when nine turtles starts on a disk with no
/// database yet (a new host, or a database moved aside on purpose). Never
/// replaces a database that holds anything. An empty database file, with no
/// structure at all, counts as none: a running nine turtles can leave one
/// behind when its database is moved aside (docs/operations/backups.md).
pub async fn restore_if_empty(
    data_dir: &Path,
    storage: Option<&Storage>,
    name: &str,
) -> Result<(), String> {
    if db::exists(data_dir)
        && !(db::has_only_new_name(data_dir) && is_empty(&db::path(data_dir)).await)
    {
        log::problem(
            "NINE_TURTLES_RESTORE_FROM is set, but a database is already here, so nothing \
             was restored; remove the setting (docs/operations/backups.md)",
        );
        return Ok(());
    }
    let storage = storage.ok_or(
        "NINE_TURTLES_RESTORE_FROM needs the NINE_TURTLES_BACKUP_* settings, to know where \
         the backups are",
    )?;
    std::fs::create_dir_all(data_dir).map_err(|error| {
        format!(
            "can't create the data folder {}: {error}",
            data_dir.display()
        )
    })?;
    // Downloaded beside the database under another name, checked, then given
    // its real name, so a broken download never looks like a database.
    let arriving = data_dir.join(format!("{}.restoring", db::FILE_NAME));
    let _ = std::fs::remove_file(&arriving);
    log::info(&format!("restoring the database from {name}"));
    let result = async {
        storage.get(name, &arriving).await?;
        check(&arriving).await?;
        // Any empty database and its logs go first: SQLite would apply a
        // leftover log (`-wal`) to the restored copy.
        for suffix in ["", "-wal", "-shm"] {
            let leftover = PathBuf::from(format!("{}{suffix}", db::path(data_dir).display()));
            if leftover.exists() {
                std::fs::remove_file(&leftover).map_err(|error| {
                    format!(
                        "can't clear {} for the restore: {error}",
                        leftover.display()
                    )
                })?;
            }
        }
        std::fs::rename(&arriving, db::path(data_dir))
            .map_err(|error| format!("can't put the restored database in place: {error}"))
    }
    .await;
    let _ = std::fs::remove_file(&arriving);
    result?;
    log::info(&format!(
        "restored the database from {name}; remove NINE_TURTLES_RESTORE_FROM now"
    ));
    Ok(())
}

/// A copy of the database in the temporary folder, deleted when dropped.
pub struct Snapshot(PathBuf);

impl Snapshot {
    pub fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for Snapshot {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Makes a consistent, whole copy of the database in the temporary folder
/// and checks it.
pub async fn snapshot(db: &SqlitePool) -> Result<Snapshot, String> {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let path = std::env::temp_dir().join(format!(
        "nine-turtles-backup-{}-{}.sqlite",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let _ = std::fs::remove_file(&path);
    let snapshot = Snapshot(path);
    let target = snapshot
        .path()
        .to_str()
        .ok_or("the temporary folder's name isn't plain text")?;
    sqlx::query("VACUUM INTO ?")
        .bind(target)
        .execute(db)
        .await
        .map_err(|error| format!("couldn't copy the database: {error}"))?;
    check(snapshot.path()).await?;
    Ok(snapshot)
}

/// Whether the database file at `path` has no structure at all (or doesn't
/// exist): nothing in it to keep.
async fn is_empty(path: &Path) -> bool {
    if !path.exists() {
        return true;
    }
    let Ok(mut connection) =
        SqliteConnection::connect_with(&SqliteConnectOptions::new().filename(path).read_only(true))
            .await
    else {
        return false;
    };
    let tables: Result<i64, _> = sqlx::query_scalar("SELECT count(*) FROM sqlite_schema")
        .fetch_one(&mut connection)
        .await;
    let _ = connection.close().await;
    matches!(tables, Ok(0))
}

/// Opens a copy on its own and checks that SQLite finds it whole and that
/// it's a nine turtles database.
async fn check(path: &Path) -> Result<(), String> {
    let mut connection =
        SqliteConnection::connect_with(&SqliteConnectOptions::new().filename(path).read_only(true))
            .await
            .map_err(|error| format!("the copy doesn't open: {error}"))?;
    let verdict: String = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_one(&mut connection)
        .await
        .map_err(|error| format!("the copy can't be checked: {error}"))?;
    let changes: i64 = sqlx::query_scalar("SELECT count(*) FROM _sqlx_migrations")
        .fetch_one(&mut connection)
        .await
        .map_err(|_| "the copy isn't a nine turtles database".to_owned())?;
    let _ = connection.close().await;
    if verdict != "ok" {
        return Err(format!("the copy is damaged: {verdict}"));
    }
    if changes == 0 {
        return Err("the copy isn't a nine turtles database".to_owned());
    }
    Ok(())
}

/// `2026-10-25` for seconds since 1970 (UTC).
pub fn day_name(at: i64) -> String {
    let (year, month, day) = civil_date(at);
    format!("{year:04}-{month:02}-{day:02}")
}

/// `2026-10-25T030000Z`, for copies that can happen more than once a day.
fn time_name(at: i64) -> String {
    let seconds = at.rem_euclid(86_400);
    format!(
        "{}T{:02}{:02}{:02}Z",
        day_name(at),
        seconds / 3_600,
        seconds % 3_600 / 60,
        seconds % 60
    )
}

/// The calendar date (UTC) for seconds since 1970 (Howard Hinnant's
/// well-known method, the reverse of the one in `fetch`).
pub fn civil_date(at: i64) -> (i64, i64, i64) {
    let days = at.div_euclid(86_400) + 719_468;
    let era = days.div_euclid(146_097);
    let day_of_era = days - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 25 October 2026, 00:00 UTC.
    const MIDNIGHT: i64 = 1_792_886_400;

    #[test]
    fn dates_are_right_across_years_and_leap_days() {
        assert_eq!(day_name(0), "1970-01-01");
        assert_eq!(day_name(MIDNIGHT), "2026-10-25");
        assert_eq!(day_name(MIDNIGHT - 1), "2026-10-24");
        assert_eq!(day_name(951_782_400), "2000-02-29");
        assert_eq!(day_name(1_798_761_599), "2026-12-31");
        assert_eq!(time_name(MIDNIGHT + 3 * 3_600 + 61), "2026-10-25T030101Z");
    }

    #[test]
    fn one_nightly_copy_a_day_after_three_in_the_morning() {
        let at = |hour: i64| MIDNIGHT + hour * 3_600;
        // Never backed up: straight away, whatever the time.
        assert!(nightly_due(None, at(1)));
        // Yesterday's copy is there: wait for 03:00.
        let yesterday = Some("nightly/2026-10-24.sqlite");
        assert!(!nightly_due(yesterday, at(2)));
        assert!(nightly_due(yesterday, at(3)));
        // Today's is done: nothing more today.
        assert!(!nightly_due(Some("nightly/2026-10-25.sqlite"), at(23)));
        // A night was missed: catch up now.
        assert!(nightly_due(Some("nightly/2026-10-22.sqlite"), at(1)));
    }
}
