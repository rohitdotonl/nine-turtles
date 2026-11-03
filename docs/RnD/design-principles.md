# nine turtles: design principles, where they came from, and what's next

The ten ranked principles were adopted with Rohit on 1 November 2026
(decisions 0133 and 0134); their wording lives in `docs/DESIGN.md` Part 1. This note
keeps where each came from and what is still to be decided. The full
discussion is in Rohit's working doc "Brand and design language: a
proposal to argue with".

## Where each principle comes from

From Rohit's design field guide ("Less, but better": Norman, Rams, Victor,
Reichenstein, Brichter, Matas, Rizzi, Tufte, Vignelli, Fukasawa, Hara) and
Rams' ten principles in their updated form. Every chapter and every one of
Rams' ten is placed (decision 0134).

| # | Principle | From |
|---|---|---|
| 1 | Nothing pulls | Be honest (Rams); Reeder dropping unread counts (Rizzi) |
| 2 | The writer comes first | Get out of the way; typography is the interface (guide 6, 9) |
| 3 | Clear at a glance | Show what's possible; fit what people already do; show the information (guide 1, 3, 11); Rams' intuitive |
| 4 | Forgiving | Forgive mistakes (guide 4) |
| 5 | Honest by default | Be honest (guide 7); Rams' honest |
| 6 | Cohesive | Structure and discipline (guide 10); Rams' cohesive |
| 7 | Made by a person, to the last detail | Thorough to the last detail (guide 13); Rams' thorough and elegant |
| 8 | Instant and still | Answer every action; close the loop (guide 2, 12), without motion |
| 9 | Power is findable, never in the way | Show what's possible; less, but better (guide 1, 5) |
| 10 | Less, but better, and built to last | Less, but better; design for decades (guide 5, 8); Rams' timeless, sustainable, as little design as possible |

Rams' "challenges the status quo" and "useful" are checks every new
feature passes (DESIGN.md → "Rules about the rules"), not ranked
principles.

**Where we part from the guide:** Matas and Brichter teach feedback through
motion (springs, pull-to-refresh). nine turtles keeps no motion: feedback is
instant and visible without moving.

**Why "Clear at a glance" ranks below "Nothing pulls":** when they clash
(how much is waiting from the people you read), clarity finds a way that
doesn't pull, such as names instead of numbers.

## Agreed, to do through mockups

- **A command menu:** type an action's name, see its key beside it, so
  every key is findable (principle 7).
- **An every-state check** of every screen: empty, loading, offline,
  error, long names, other scripts, 200% text (principle 5).
- **The zero-tap question** (Bret Victor): the reader opens nine turtles to
  learn whether anyone they like wrote something. The three panes stay
  (decision 0134); the answer is tried inside the third pane, for example
  its empty state before an article is open.
- **Icon-only tools around the article** (Aa, star, More): judged by the
  principles; any break is written in the Exceptions log.

## Still open, decided only after mockups

- The new tiebreaker (its candidate is in `docs/DESIGN.md`).
- The brand idea (candidate: "letters from people": warm, personal,
  correspondence).
- How far nine turtles helps a reader leave social media without
  preaching.

Decided since, and kept elsewhere: colors, typefaces, the accent and the
turtles' role (`docs/BRAND.md`), and the weekly email (SPEC section 39).
