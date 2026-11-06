-- Confirming a sign-up in the browser that signed up asks no password
-- (decision 0193, which changes decision 0154). Pressing Sign up leaves a
-- random secret in that browser's cookie; only its scrambled copy is kept
-- here, with the waiting sign-up. The emailed link plus that secret is
-- proof enough: the link shows the address is the reader's, the secret
-- that this waiting sign-up is theirs. Empty for every other link, and for
-- sign-ups from before this change (their links ask the password).
ALTER TABLE email_links ADD COLUMN browser_hash BLOB;
