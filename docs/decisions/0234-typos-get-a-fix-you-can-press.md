# 0234: Typos get a fix you can press

*10 November 2026.*

Rohit's "Implement every suggestion from round 1. From round 2, implement
10, 11, 12, 13, 14" (10 November 2026), suggestions 7 and 14 of the
critique through the principle "Forgive mistakes"
(`critique-24/principle-04-forgive-mistakes.html` and its round 2, in the
project's files). Settled with him in that thread: nine turtles only
suggests and never changes what was typed; on sign-up and Change email it
suggests up front, on sign-in only after a failure.

**Decision.**

- **A mistyped web address in Add** gets its one obvious repair, said in
  the problem line and offered as an edged button, **Use …**: a comma,
  semicolon or space where the dot goes, a mistyped `https://`, doubled
  dots, punctuation left at the end, pasted quotes or brackets, an ending no
  site has (`.con` → `.com`, `.ogr` → `.org`…), and an email address pasted
  in ("Did you mean their website, …?"). No repair: "An address looks like
  example.com." (SPEC section 3).
- **A mistyped email provider** (one slip from gmail.com, outlook.com,
  hotmail.com, icloud.com, yahoo.com or proton.me) gets "Did you mean …?
  Use that" under the field: on sign-up and Change email on leaving the
  field or at the first press of the button, on sign-in only after a
  failed sign-in (SPEC sections 1 and 18).
- **Never blocking:** the first press with a likely slip only offers the
  fix; pressing again sends what was typed.

**Why.** A mistake caught before it costs anything is the cheapest kind.
A mistyped address cost a retype on a small keyboard; a mistyped email
cost a wait for a link that never comes.

**How.** `web/src/lib/typos.ts` works it all out on the device: nothing is
looked up and no site is visited to guess (the "never fetch" rule stands).
A "slip" is one letter missing, added or doubled, two letters swapped, or
a key hit for one beside it on the keyboard; only these, against a short
list, so an unusual provider is never second-guessed. Real providers one
slip from the list (ymail.com, mail.com, email.com, gmx.com, aol.com) and
every provider the inbox links know (decision 0195) are left alone.
`EmailFix.svelte` is the one line shared by the three email fields.
