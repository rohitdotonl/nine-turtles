# 0273: A failing YouTube feed is asked again within hours, at a random time

**In one line:** A YouTube feed that fails (the kind decision 0159 asks again) waits at most 3 to 6 hours, at random, before its next check, instead of backing off to a day, so it stops landing in the same daily spell of YouTube refusing.

*14 November 2026.*

**What happened.** Since late October, YouTube has answered "not found"
to the live nine turtles for more and more channel feeds, for weeks at a
time, while the same addresses load from any other computer (decision
0272). Other feed readers report YouTube's feeds failing in spells of a
few minutes, often at much the same hour each day, since December 2025.
Every stuck feed here first failed between about 05:30 and 08:00 UTC. A
failing feed backs off to once a day, and that wait is exact, so each
stuck feed was asked again at the same time of day, inside the same spell,
day after day. The four quick asks of decision 0159 come a second apart,
so they fall inside the same spell too.

**Decision.** In `checking::failed_wait`, a feed `youtube::addresses::asks_again`
covers waits as usual after its first failures, but never longer than
3 to 6 hours, chosen at random each time, so its asks move around the
day. It's four to eight checks a day for a stuck feed, still polite. A
feed whose followers are all away keeps its daily wait. Nothing else
changes: other sites back off to a day as before, and "dead" is judged as
before.

**Not done.** A Google key or reading YouTube's pages stays out (decision
0144). YouTube's WebSub hub only says that something changed, so it would
still need this same feed. Reading each channel's uploads playlist instead
was tested for two days and YouTube refused it too (decision 0272).

**How we'll know.** This is a likely cause, not a proven one. If it's
right, channels stuck for weeks start working within a day or two of this
going live. If they don't, the cause is elsewhere, and this note says so.
