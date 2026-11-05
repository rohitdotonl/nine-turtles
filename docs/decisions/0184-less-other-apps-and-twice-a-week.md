# 0184: No syncing with other apps, and the weekly email once a week

*5 November 2026.*

**Context.** The owner's whole-app review of what to remove or simplify
(15 points, pictures at https://claude.ai/artifact/APc4tDH9pJoc8Js4q2zqVi)
judged everything against the product line: nine turtles turns the
strangers you read into people you write to. The owner chose two points to
build first: point 2 and point 12.

**Decision.**

- **Syncing with other apps ends** (point 2). Reeder, NetNewsWire and other
  feed readers no longer read a nine turtles account through the Google
  Reader API (`/api/greader`, decision 0070). Settings › Other apps, its
  app passwords and the `app_passwords` table (structure change 42) go.
  Reading in another app skipped what matters most here: the writer's page,
  notes and writing back. Leaving stays easy: Your data still exports the
  list and everything starred. Help's questions page says so, with "If you
  miss it, write to hello@nineturtles.app."
- **The weekly email is once a week or off** (point 12). Twice a week
  goes; Settings › Account › Weekly email is a switch like Unread's. The one
  thing that reaches out should be as small as it can be. Readers who had
  chosen twice a week have it on Saturday mornings (structure change 43),
  and their next email says so once: "This email now comes once a week, on
  Saturday mornings, instead of twice."

**Consequences.** SPEC section 26 is retired; sections 18 and 39 change.
Apps signed in with an app password stop syncing at once. The owner gave
standing permission (3 November 2026) to delete removed features' data; the
backup before every structure change keeps it.
