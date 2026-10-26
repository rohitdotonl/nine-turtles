-- Reading offline (SPEC section 30, decision 0100): a mark made on a device
-- without a connection is sent later, when the connection is back. By then
-- another device may have marked the same article since, and the later
-- mark should stand. So each of a reader's lines now remembers when its
-- read mark and its star were last set (milliseconds since 1970, by the
-- clock of the device that set them), and an older mark arriving late
-- changes nothing. 0 means "not since this change": any mark wins over it.
-- Nothing already stored changes.
ALTER TABLE entries ADD COLUMN read_marked_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE entries ADD COLUMN starred_marked_at INTEGER NOT NULL DEFAULT 0;
