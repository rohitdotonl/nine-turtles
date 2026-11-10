-- Search in Chinese, Japanese, Arabic and Hebrew (decision 0228, SPEC
-- section 14). The index now gives each Chinese character and kana a word
-- of its own, and leaves out Arabic and Hebrew vowel marks
-- (src/search/words.rs), so it is emptied here and filled again the new way
-- in the background when nine turtles starts (search::index_missing). Only
-- the index changes: no article, note or mark is touched. Until it's full
-- again, a search may miss older articles for a few minutes.
INSERT INTO articles_search (articles_search) VALUES ('delete-all');
