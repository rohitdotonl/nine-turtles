-- Folders in the reader's own order (decision 0207, SPEC section 5): each
-- folder keeps a place, 1 at the top. Every reader's folders start in the
-- A to Z order they had, so nothing moves until the reader moves it; a new
-- folder joins at the bottom, and renaming one leaves it where it is.
ALTER TABLE folders ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
UPDATE folders SET position = (
    SELECT ranked.place FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY name COLLATE NOCASE, id) AS place
        FROM folders
    ) AS ranked WHERE ranked.id = folders.id
);
