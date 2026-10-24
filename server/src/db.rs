//! The SQLite database: one file in the data folder.

use std::path::{Path, PathBuf};

use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
};

pub const FILE_NAME: &str = "nine-turtles.sqlite";
/// The database's name before the rename; `open` renames an old one in place.
const OLD_FILE_NAME: &str = "slowfeed.sqlite";

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
    rename_old_database(data_dir)?;

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

/// Moves a database made before the rename (and its `-wal` and `-shm` files)
/// to the new name, once, so nothing is lost. Nothing happens if there's no
/// old one, or a new one already exists.
fn rename_old_database(data_dir: &Path) -> Result<(), String> {
    let old = data_dir.join(OLD_FILE_NAME);
    if !old.exists() || path(data_dir).exists() {
        return Ok(());
    }
    for suffix in ["", "-wal", "-shm"] {
        let from = data_dir.join(format!("{OLD_FILE_NAME}{suffix}"));
        if from.exists() {
            let to = data_dir.join(format!("{FILE_NAME}{suffix}"));
            std::fs::rename(&from, &to).map_err(|error| {
                format!(
                    "can't rename {} to {}: {error}",
                    from.display(),
                    to.display()
                )
            })?;
        }
    }
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_database_from_before_the_rename_is_kept() {
        let dir = std::env::temp_dir().join(format!("nine-turtles-rename-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        // A database made under the old name, with one feed in it.
        let old = SqlitePoolOptions::new()
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(dir.join(OLD_FILE_NAME))
                    .create_if_missing(true),
            )
            .await
            .unwrap();
        sqlx::query("CREATE TABLE kept (word TEXT)")
            .execute(&old)
            .await
            .unwrap();
        sqlx::query("INSERT INTO kept VALUES ('turtle')")
            .execute(&old)
            .await
            .unwrap();
        old.close().await;

        let pool = open(&dir).await.unwrap();
        let word: String = sqlx::query_scalar("SELECT word FROM kept")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(word, "turtle");
        assert!(dir.join(FILE_NAME).exists());
        assert!(!dir.join(OLD_FILE_NAME).exists());
        pool.close().await;
        let _ = std::fs::remove_dir_all(&dir);
    }
}
