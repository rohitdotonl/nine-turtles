# 41. "How did you hear about nine turtles?"

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.
V1 item 7 (`docs/PLAN.md`), decision 0155.*

**What it does**
- The sign-up page (section 1) asks one optional question, under the
  password: **How did you hear about nine turtles?** It's a plain list to
  choose from, starting at **Rather not say**, with **A blog**, **A
  friend**, **A search**, **An AI assistant**, **Reddit** and **Somewhere
  else**. Under it, as a field's helper line: "Optional. Only ever counted,
  never shown with your name."
- Leaving it at Rather not say signs up exactly as before. The answer never
  stops anyone signing up: an answer the page doesn't offer is kept as no
  answer.
- The answer is kept with the account. Nobody who signed up before it was
  asked has one, and there's no way to answer later: it's asked once.
- **Only totals are ever shown**, in the owner report (decision 0130,
  `docs/operations/owner-report.md`): how many readers gave each answer, and
  how many didn't say. Never whose answer is whose: not on the Readers page,
  not to AI assistants, not anywhere else.
- **Delete all my data** takes the answer too; deleting the account takes
  everything (section 18).

**How it looks**
- Built as the page's other fields (DESIGN.md → "The sign-in pages"): its
  name in small second-ink words above it, the list at the column's full
  width with the same edge, corners and focus ring as a text field, the
  helper line under it. The device's own list opens when it's pressed, so it
  works with a keyboard, a screen reader and touch as every list does.
- The keyboard goes Email, Password, How did you hear…, Sign up, Sign in.

**How to check it**
1. In a private window, open the sign-up page: the question is under the
   password, at Rather not say.
2. Sign up choosing **A friend**. Then ask the owner report (see
   `docs/operations/owner-report.md`): `readers.heard_about.friend` is one
   more than before.
3. Sign up again with another email, leaving it at Rather not say: you're
   in at once, and `no_answer` is one more.
