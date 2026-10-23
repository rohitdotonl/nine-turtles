//! Search settings shared by the search table (Milestone 10) and its tests.

/// How SQLite's FTS5 search engine splits text into words.
///
/// FTS5's standard `unicode61` splitter treats combining marks as spaces, so
/// Hindi words would be cut apart at every vowel sign (मात्रा). Adding the mark
/// categories (`M*`) to the word characters keeps them whole. `remove_diacritics
/// 2` lets "cafe" find "café". See docs/decisions/0004-search-hindi.md.
pub const FTS5_TOKENIZER: &str = "unicode61 remove_diacritics 2 categories 'L* N* Co M*'";
