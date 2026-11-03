-- YouTube as a first-class citizen (V1 item 4, decision 0144): a channel's
-- Shorts and live streams are marked, and each reader leaves them out
-- unless they switch them on for that channel.
--
-- This change only adds three columns, so every feed, subscription,
-- article and mark carries on exactly as before. Videos already stored are
-- ordinary videos (nothing marks them), and every reader already following
-- a channel starts with both switches off: from now on, new Shorts and live
-- streams are left out, and the ones already in their lists stay.

-- 'short' or 'live' once YouTube's own lists name the video; null for any
-- other video or article. Shared by everyone, as the article is.
ALTER TABLE articles ADD COLUMN video_kind TEXT CHECK (video_kind IN ('short', 'live'));

-- Each reader's switches on the channel's screen: "Include Shorts" and
-- "Include live streams". Off by default.
ALTER TABLE subscriptions ADD COLUMN shorts INTEGER NOT NULL DEFAULT 0 CHECK (shorts IN (0, 1));
ALTER TABLE subscriptions ADD COLUMN live_streams INTEGER NOT NULL DEFAULT 0
    CHECK (live_streams IN (0, 1));
