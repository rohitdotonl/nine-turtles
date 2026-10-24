//! SQLite's FTS5 search engine is built in, and finds Hindi words whole.
//! The real search table arrives in Milestone 10 and uses the same setting.

use nine_turtles::search::FTS5_TOKENIZER;
use sqlx::{AssertSqlSafe, Connection, SqliteConnection};

async fn database_with(tokenizer: &str) -> SqliteConnection {
    let mut db = SqliteConnection::connect("sqlite::memory:").await.unwrap();
    // Safe: the tokenizer is always a fixed setting written in this file or in
    // src/search.rs, never anything a user typed.
    sqlx::query(AssertSqlSafe(format!(
        "CREATE VIRTUAL TABLE articles USING fts5(title, body, tokenize = \"{tokenizer}\")"
    )))
    .execute(&mut db)
    .await
    .unwrap();

    for (title, body) in [
        ("हिंदी कविता", "आज मौसम बहुत सुहावना है और किताबें पढ़ने का मन है।"),
        ("A quiet café", "Reading slowly, one chapter at a time."),
        ("पुस्तकालय", "शहर के पुराने पुस्तकालय में नई किताबें आई हैं।"),
    ] {
        sqlx::query("INSERT INTO articles (title, body) VALUES (?, ?)")
            .bind(title)
            .bind(body)
            .execute(&mut db)
            .await
            .unwrap();
    }
    db
}

async fn titles_matching(db: &mut SqliteConnection, query: &str) -> Vec<String> {
    sqlx::query_scalar("SELECT title FROM articles WHERE articles MATCH ? ORDER BY rowid")
        .bind(query)
        .fetch_all(db)
        .await
        .unwrap()
}

#[tokio::test]
async fn finds_hindi_words_with_vowel_signs() {
    let mut db = database_with(FTS5_TOKENIZER).await;

    assert_eq!(
        titles_matching(&mut db, "किताबें").await,
        ["हिंदी कविता", "पुस्तकालय"]
    );
    assert_eq!(titles_matching(&mut db, "पुस्तकालय").await, ["पुस्तकालय"]);
    assert_eq!(titles_matching(&mut db, "सुहावना").await, ["हिंदी कविता"]);
}

#[tokio::test]
async fn a_word_fragment_is_not_a_match() {
    let mut db = database_with(FTS5_TOKENIZER).await;

    // "कि" is only the start of "किताबें". The standard splitter would cut
    // "किताबें" into pieces and wrongly find it.
    assert!(titles_matching(&mut db, "कि").await.is_empty());
}

#[tokio::test]
async fn the_standard_setting_would_split_hindi_words() {
    // Shows why FTS5_TOKENIZER exists: the default cuts at vowel signs.
    let mut db = database_with("unicode61").await;

    assert_eq!(
        titles_matching(&mut db, "कि").await,
        ["हिंदी कविता", "पुस्तकालय"]
    );
}

#[tokio::test]
async fn english_still_works_including_accents() {
    let mut db = database_with(FTS5_TOKENIZER).await;

    assert_eq!(titles_matching(&mut db, "cafe").await, ["A quiet café"]);
    assert_eq!(titles_matching(&mut db, "chapter").await, ["A quiet café"]);
}
