//! The SQLite database: one file in the data folder.

use std::path::{Path, PathBuf};

use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
};

pub const FILE_NAME: &str = "slowfeed.sqlite";

/// Opens (or creates) the database and brings its structure up to date.
///
/// V1 has no backups (the owner's decision, docs/decisions/0012-v1-for-one-reader.md),
/// so a structure change that could lose data is raised with the owner first.
/// Backups before every structure change come in V2.
pub async fn open(data_dir: &Path) -> Result<SqlitePool, String> {
    std::fs::create_dir_all(data_dir).map_err(|error| {
        format!(
            "can't create the data folder {}: {error}",
            data_dir.display()
        )
    })?;

    let options = SqliteConnectOptions::new()
        .filename(path(data_dir))
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .connect_with(options)
        .await
        .map_err(|error| format!("can't open the database: {error}"))?;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|error| format!("can't update the database's structure: {error}"))?;
    Ok(pool)
}

pub fn path(data_dir: &Path) -> PathBuf {
    data_dir.join(FILE_NAME)
}

/// Bytes used by the database, including its write-ahead log (`-wal`), the
/// file SQLite writes changes to before folding them into the main file.
pub fn size_in_bytes(data_dir: &Path) -> u64 {
    let main = path(data_dir);
    let mut wal = main.clone().into_os_string();
    wal.push("-wal");
    [main, PathBuf::from(wal)]
        .iter()
        .filter_map(|file| std::fs::metadata(file).ok())
        .map(|metadata| metadata.len())
        .sum()
}
