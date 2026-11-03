-- "How did you hear about nine turtles?" (V1 item 7, decision 0155): one
-- optional answer, given at sign-up and kept with the account. The owner
-- report counts the answers; nothing shows any one reader's.
--
-- This change only adds two empty columns, so every account carries on
-- exactly as before: nobody who signed up already has an answer.

-- 'blog', 'friend', 'search', 'ai' (an AI assistant), 'reddit' or 'other';
-- null when the reader chose not to say.
ALTER TABLE people ADD COLUMN heard_about TEXT
    CHECK (heard_about IN ('blog', 'friend', 'search', 'ai', 'reddit', 'other'));

-- A sign-up waiting for its email link (decision 0154) keeps the answer
-- here until the link makes the account; null for every other link.
ALTER TABLE email_links ADD COLUMN heard_about TEXT
    CHECK (heard_about IN ('blog', 'friend', 'search', 'ai', 'reddit', 'other'));
