-- Paying for nine turtles (SPEC section 29, decision 0094): each reader's
-- plan with Dodo Payments, and the payment messages already handled. One
-- column and two tables are added; nothing already stored changes, except
-- that everyone with an account today is marked as free for good (the owner
-- and the testers who joined before payments). Times are seconds since 1970
-- (UTC).

-- 1 for a reader who never pays: everyone who joined before payments.
-- Readers who join later start with a free trial.
ALTER TABLE people ADD COLUMN free INTEGER NOT NULL DEFAULT 0 CHECK (free IN (0, 1));
UPDATE people SET free = 1;

-- A reader's subscription at Dodo Payments, as Dodo last described it: nine
-- turtles' own record of who pays, so moving to another payment company
-- stays possible. Goes with the reader's account.
CREATE TABLE plans (
    person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
    -- Dodo's names for the subscription and the customer (sub_…, cus_…).
    subscription_id TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    -- 'monthly' or 'yearly', from the product bought; null if unknown.
    period TEXT,
    -- Dodo's word for it: active, on_hold, cancelled, expired, failed, …
    status TEXT NOT NULL,
    -- When Dodo next charges, if it will.
    renews_at INTEGER,
    -- 1 when the reader cancelled and it ends at renews_at instead.
    ending INTEGER NOT NULL DEFAULT 0 CHECK (ending IN (0, 1)),
    -- Until when the reader has what they paid for (a few days' grace
    -- included); after it, the plan has ended.
    access_until INTEGER NOT NULL,
    -- When Dodo said the newest message kept here happened, so a late,
    -- older one changes nothing.
    message_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
) STRICT;

-- The payment messages Dodo has sent, by their own id, so one sent twice
-- changes nothing the second time. Kept for 90 days.
CREATE TABLE payment_messages (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    received_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
