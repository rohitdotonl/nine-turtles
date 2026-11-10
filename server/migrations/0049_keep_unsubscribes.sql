-- A reader's own unsubscribes are kept 30 days too, as an assistant's
-- already were (decision 0239): every unsubscribe now sets
-- `subscriptions.kept_until`, so this marks which ones an assistant made,
-- for Settings › Everyone you follow › Recently unsubscribed to say so.
-- Every unsubscribe kept until now was an assistant's.
ALTER TABLE subscriptions ADD COLUMN by_assistant INTEGER NOT NULL DEFAULT 0;
UPDATE subscriptions SET by_assistant = 1 WHERE kept_until IS NOT NULL;
