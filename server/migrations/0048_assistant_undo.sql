-- Undo for disconnecting an assistant (decision 0236). A disconnected
-- connection keeps its line here, with when it was disconnected, in
-- seconds since 1970: every ticket of it is refused from that moment, and
-- Undo can clear this to bring the same connection back for ten minutes.
-- After that (or once the reader disconnects another) the line goes for
-- good, with its tickets. Null, as for every connection made before, is
-- connected.
ALTER TABLE assistant_connections ADD COLUMN disconnected_at INTEGER;
