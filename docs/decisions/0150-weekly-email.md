# 0150: The weekly email

*3 November 2026. V1 item 5 (decision 0140), built while the owner was away
under his "Go on V1. Ship each one." The smaller choices below are for the
refinement round.*

## Decision

- Off by default; **Off / Weekly / Twice a week** in Settings › Account,
  right under Email, shown only while nine turtles can send email and the
  reader has an address. Shared across their devices.
- **Saturday 08:00** where the reader is (twice a week: Wednesday and
  Saturday), by the device's clock when they chose.
- It lists people with something unread that arrived since the last one,
  A to Z, at most 30 people and three titles each, a line and the
  publisher's link under each title, and "The rest is in nine turtles."
  when cut. Never a count. Nothing new: nothing sent.
- **Started from the address:** sign-up never checks an address (decision
  0115), so the first time it's turned on for an address, one email asks
  the reader to press Start there, and nothing else goes to it until they
  do. Without this, anyone could sign up with a stranger's address and
  send them weekly mail, written by feeds they choose, from
  hello@nineturtles.app (found by the second-agent review).
- Off in one press: a stop link to a page with one button, working signed
  out. Its ticket is kept only as a scramble; the last ten emails' links
  work, and one that no longer does says so rather than claim it stopped.
- **No structure change:** the setting lives in `person_settings` rows
  named `weekly…`; turning it off removes those that send it.

## Smaller choices made while the owner was away

1. Its place: Settings › Account under Email, rather than Reading.
2. Its icon: the envelope, the same as Email's (the icon set is locked;
   no new drawing).
3. The days and hour: Saturday 08:00; twice a week adds Wednesday.
4. The words: subject "New from the people you read"; "Here's what the
   people you read wrote this week."
5. The limits: 30 people, three titles each, a line of about 140
   characters.
6. "Unread and arrived since the last one", so what was already read in
   the app isn't repeated.
7. "The rest is in nine turtles." when the email is cut short, flat rather
   than "waiting for you".
8. The Start email's words: "You chose the weekly email in nine turtles. To
   start it at this address, open this link and press Start", then "If it
   wasn't you, ignore this email: nothing more will come."
9. The publisher's link under each title, rather than links into nine
   turtles: the reader can open the writing straight away, and the
   publisher is credited and linked (the floor).

## Why

Principle 1, "nothing pulls", allows one thing that reaches out only if the
reader chose it, it ends, and it stops in one press. A count would turn it
into a pull ("12 new!"), so there is none; an empty week sends nothing.
Keeping it in `person_settings` avoids a structure change, and Brevo's free
tier (300 emails a day) covers 100 to 200 readers on one morning.
