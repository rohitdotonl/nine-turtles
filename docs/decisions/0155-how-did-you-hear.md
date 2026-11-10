# 0155: "How did you hear about nine turtles?"

**In one line:** "How did you hear about nine turtles?": one optional list at sign-up (Rather not say, a blog, a friend, a search, an AI assistant, Reddit, somewhere else), kept with the account, counted only as totals in the owner report, cleared by Delete all my data

*3 November 2026. The shape was agreed with the owner (PLAN.md → V1, item
7, decision 0140); the owner gave advance permission to build and ship it
("Go on V1. Ship each one."). The smaller choices below were made by the
building agent while the owner was away, each listed for the owner's
refinement round.*

**Decision.**

- The sign-up page asks one optional question under the password, as a
  plain list: Rather not say (chosen to begin with), A blog, A friend, A
  search, An AI assistant, Reddit, Somewhere else (SPEC section 41).
- The answer is kept with the account, in one new column on `people`
  (`heard_about`, migration 0032); no answer is kept as nothing at all.
  While the address waits to be confirmed (decision 0154), the answer waits
  with the sign-up's link (the same column on `email_links`), and the link
  that makes the account carries it over.
- It's shown only as totals, in the owner report's `readers.heard_about`
  (decision 0130): every answer named, even at 0, and `no_answer`. Never
  per reader, so it's not on the Readers page or given to AI assistants.
- Delete all my data clears it, as it removes everything else of the
  reader's but their sign-in.

**Choices made while the owner was away** (each easy to reverse):

1. **A list, not a row of round marks.** Seven rows of 44px would push Sign
   up off a phone's screen, for a question that's optional. A list keeps the
   page as short as a field.
2. **"Rather not say" as the first choice** rather than a blank one, so not
   answering is a real, named choice, and the honest default.
3. **"Somewhere else"** rather than "Other", in the app's plain voice; with
   no box to type in, so nothing a reader writes is ever kept here.
4. **The helper line** "Optional. Only ever counted, never shown with your
   name.", saying plainly what happens to it (honest by default).
5. **An answer the page doesn't offer is kept as no answer,** never refused,
   so the question can never stand between someone and an account.
6. **No way to answer later,** in Settings or elsewhere: asked once, as the
   plan says, so it never becomes a nag.

**Why.** The owner wants to know which ways of telling people about nine
turtles work, without watching any one reader (DESIGN.md: honest by
default; nothing pulls).
