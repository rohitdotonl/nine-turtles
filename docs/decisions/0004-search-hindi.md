# 0004: Search splits words so Hindi stays whole

*October 2026, Milestone 1.*

**Decision.** The search table (built in Milestone 10) uses SQLite FTS5 with
this word-splitting setting, kept in one place, `server/src/search.rs`:

    unicode61 remove_diacritics 2 categories 'L* N* Co M*'

**Why.** FTS5's standard splitter (`unicode61`) treats "combining marks" as
spaces. Hindi writes most vowels as combining marks (मात्राएँ), so किताबें
would be stored as broken pieces, and searching for a fragment like कि would
wrongly match it. Adding the mark categories (`M*`) to the characters that
make up words keeps Hindi words whole. `remove_diacritics 2` lets "cafe" find
"café" in Latin-script languages.

**Proof.** `server/tests/search_hindi.rs` searches Hindi and English text with
this setting, and also shows the standard setting getting Hindi wrong, so
the reason for the setting is tested, not just remembered.

**Not covered.** Chinese and Japanese, which don't put spaces between words,
need a different approach; they're not in V1 (DESIGN.md → "Languages").
