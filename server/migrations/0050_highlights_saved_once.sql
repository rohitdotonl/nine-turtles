-- A new highlight is saved once, however many times it's sent (decision
-- 0255). The web app makes a key of its own for each highlight (random, on
-- the reader's device) and sends it with the highlight. When the page is
-- reloaded or closed the instant a highlight is being saved, the browser
-- never hears the answer, so the app keeps the highlight on the device and
-- sends it again; the server finds its key already saved and answers that
-- highlight instead of making a second one.
--
-- This only adds a column, empty for everything already stored, so every
-- highlight and note carries on exactly as before. Highlights made by an
-- assistant, and any sent without a key, have none.
ALTER TABLE notes ADD COLUMN made_key TEXT;
CREATE UNIQUE INDEX notes_made_once ON notes (person_id, made_key) WHERE made_key IS NOT NULL;
