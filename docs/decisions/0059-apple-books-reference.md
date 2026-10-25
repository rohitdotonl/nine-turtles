# 0059: Apple Books is the design reference, written down

*25 October 2026. The owner's request: bring the documents in line with
the Apple Books direction the app has followed since 24 October, and make
them shorter.*

**Why.** Since 24 October the owner has steered the look by one reference,
Apple Books on the Mac and the iPhone, with "taste first, good UI/UX
principles second, my own rules last". That rule lived only in a handoff
note outside the repository, so an agent reading `DESIGN.md` couldn't know
it, and a few of DESIGN.md's principles had come to contradict the app.

**What changed.**

- **DESIGN.md → "Design reference".** Apple Books is the one reference. The
  floors win first, then Apple Books, then the rest of DESIGN.md. Only the
  three-pane structure is fixed.
- **Who may change what.** Agents may change DESIGN.md Part 2 and SPEC.md
  to follow Apple Books, in the same pull request as the code, with a
  decision note. The mission, floors, ranked principles and "Never" list
  still need the owner's yes. AGENTS.md says the same.
- **Principles brought up to date.** "Words beside icons" became icons only
  where the convention is an icon; "no redesigns that rearrange learned
  things" now names the October redesign as the one deliberate exception;
  "no shadows" allows the soft shadow under things that float.
- **Lines and shadows are rules, not exceptions.** The seven line and
  shadow entries in the Exceptions log moved into Visual language → Rules,
  since they are now how the app is drawn.
- **Each screen is described once.** DESIGN.md's per-screen sections
  (Layout through Settings) were removed; SPEC.md already described each
  screen in full, and the few details only DESIGN.md had were moved into
  it. DESIGN.md went from about 58 KB to about 31 KB.
- **ENGINEERING.md Part 1** now points to AGENTS.md instead of keeping a
  second copy of the working agreements.

**Revisit if** the owner chooses a different reference, or the floors and
Apple Books ever pull in different directions often enough to need a
written rule for it.
