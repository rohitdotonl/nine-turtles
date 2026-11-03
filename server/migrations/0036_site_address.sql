-- Looking on a writer's site for their address (owner's plan, step 4,
-- decision 0168): when the reader presses Write back and no address is
-- known, nine turtles visits the writer's site once (the home page, and one
-- contact or about page it links to) and keeps what it found here, so it
-- never visits that site for an address again. Shared by everyone who
-- follows the feed, as its own address is.
--
-- This change only adds two empty columns, so every feed, subscription,
-- article and mark carries on exactly as before.

-- When the site was looked on; empty until then.
ALTER TABLE feeds ADD COLUMN site_looked_at INTEGER;

-- The address it gave, if it gave one. It only fills in the reader's field:
-- the reader checks it and keeps it (subscriptions.write_to) themselves.
ALTER TABLE feeds ADD COLUMN site_email TEXT;
