-- Connecting an AI assistant over MCP (SPEC section 33, decision 0111). A
-- reader's own assistant (any that speaks the open MCP standard) signs in
-- with OAuth: it registers itself, the reader approves it on the "Connect
-- this assistant?" page, and it gets tickets to act for that reader only.
-- Assistants that can't show that page use an assistant key made in
-- Settings instead. Every ticket, code and key is kept only scrambled
-- (BLAKE2s), like a signed-in device's.

-- An assistant program that registered itself (OAuth "dynamic client
-- registration"). It belongs to nobody until a reader connects it, and is
-- forgotten after a day if nobody does. It has no secret: it proves itself
-- with PKCE, as OAuth 2.1 asks of programs that can't keep one.
CREATE TABLE assistant_clients (
    id INTEGER PRIMARY KEY,
    -- The name it gave the client: random, public.
    client_id TEXT NOT NULL UNIQUE,
    -- The name it gave itself ("Claude"), shown to the reader as plain text.
    name TEXT NOT NULL,
    -- Where the reader's browser goes back to after approving: a JSON list.
    redirect_uris TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- One assistant a reader connected: by approving it, or as an assistant key
-- (`client_id` NULL). Disconnecting deletes it, and its tickets with it.
CREATE TABLE assistant_connections (
    id INTEGER PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES assistant_clients (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
);
CREATE INDEX assistant_connections_by_person ON assistant_connections (person_id);

-- What an assistant may use for a while: 'access' (an hour), 'refresh'
-- (swapped for new tickets; 90 days), or 'key' (an assistant key: until
-- it's turned off).
CREATE TABLE assistant_tokens (
    token_hash BLOB PRIMARY KEY,
    connection_id INTEGER NOT NULL REFERENCES assistant_connections (id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh', 'key')),
    expires_at INTEGER
);
CREATE INDEX assistant_tokens_by_connection ON assistant_tokens (connection_id);

-- The one-time code the reader's approval sends back to the assistant,
-- swapped within ten minutes for its first tickets.
CREATE TABLE assistant_codes (
    code_hash BLOB PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people (id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES assistant_clients (id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    -- PKCE: the code's owner must show the secret this was made from.
    code_challenge TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

-- A feed an assistant unsubscribed from is kept, hidden, until this time (30
-- days on), so the reader can bring it back from Settings; then it's cleared
-- as any unsubscribed feed is. NULL for every other subscription.
ALTER TABLE subscriptions ADD COLUMN kept_until INTEGER;
