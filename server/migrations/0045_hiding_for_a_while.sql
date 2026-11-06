-- Hiding for a week, a month or for good (decision 0201). A word hidden for
-- a while keeps its end here, in seconds since 1970; once it has passed the
-- word stops hiding and leaves Settings › Hiding (what it hid stays
-- hidden). Null, as for every rule made before, is for good.
ALTER TABLE rules ADD COLUMN until INTEGER;
