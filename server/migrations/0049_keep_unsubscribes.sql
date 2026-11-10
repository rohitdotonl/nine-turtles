-- A reader's own unsubscribes are kept 30 days too, as an assistant's
-- already were (decision 0239): every unsubscribe now sets
-- `subscriptions.kept_until`, so this marks which ones an assistant made,
-- for Settings › Everyone you follow › Recently unsubscribed to say so.
-- Every unsubscribe kept until now was an assistant's.
ALTER TABLE subscriptions ADD COLUMN by_assistant INTEGER NOT NULL DEFAULT 0;
UPDATE subscriptions SET by_assistant = 1 WHERE kept_until IS NOT NULL;
-- When "Remove them too" was done for this unsubscribe (after Undo's ten
-- minutes, though the place itself is kept 30 days), in seconds since 1970:
-- from then Undo says it's too late, and only Bring back brings the place
-- back, without what was removed. Null until then.
ALTER TABLE subscriptions ADD COLUMN removed_at INTEGER;
