# The second-agent review

Every pull request is reviewed by an agent that didn't write it, before the
owner looks at it (AGENTS.md → "How a change happens", step 5; decision 0006),
except documents-only changes and tiny fixes (see "Which review" below;
decision 0021).

## For the agent that built the change

If the change needs no review (see "Which review" below), skip steps 2 to 4.

1. Open the pull request and let the automatic checks run.
2. Start a **fresh** reviewer: a new agent or session with none of your
   conversation. In Claude Code that's a subagent; in another tool, a new
   session. Give it only the matching prompt below (full or light), with
   the pull request's address filled in. Don't tell it what you think is right or wrong.
3. Wait for its findings on the pull request.
4. For each finding: fix it and push, or reply on the pull request explaining
   why not. Then tell the owner the review is done and what changed.

If the change is large, a second round of review after the fixes is
worthwhile; say so to the owner if you skip it.

## Which review: full, light or none

A full review re-reads the rules and costs about as much as a small change
itself, so small, low-risk changes get a **light review** instead
(decision 0015), and the smallest get **no review** (decision 0021).

- **Full review** whenever the change touches any of these: `docs/DESIGN.md`,
  `docs/SPEC.md`, `docs/ENGINEERING.md`, `AGENTS.md`, this file, the checks
  (`scripts/`, `.github/`), a screen, stored data, fetching feeds, sign-in or
  security, or more than about 50 lines of code. Also whenever you're unsure.
- **No review** for changes outside that list that are only other
  documents (the changelog, the plan's status, the owner guide, concepts,
  decision notes, operations notes, questions), or a tiny fix of about 10
  lines of code or fewer. The automatic checks still run and must pass.
- **Light review** for everything else: code changes outside that list
  bigger than a tiny fix. Use the light prompt below.

Say in the pull request summary which review it got, and for no review, why
it qualifies.

## The light reviewer's prompt

> You are reviewing pull request <ADDRESS> in the slowfeed repository. You
> didn't write it. Read `AGENTS.md`, the "Which review: full, light or
> none" section of `docs/operations/second-agent-review.md`, and the whole
> change. If the change needs a full review by those rules, say so in your
> comment and do the full review instead. Otherwise read another document only to check
> something the change refers to. Look for: anything
> that breaks a floor or a hard rule, mistakes, documents the change
> affects but didn't update, and wording a future agent would misread.
> Check each finding before reporting it. Post one comment titled
> "Second-agent review (light)", listing each finding with how serious it is
> (must fix / should fix / minor), where, and why, in plain language. If you
> find nothing, say so. Don't change any code.

## The full reviewer's prompt

> You are reviewing pull request <ADDRESS> in the slowfeed repository. You
> didn't write it. Read `AGENTS.md`, then `docs/DESIGN.md`,
> `docs/ENGINEERING.md` and the sections of `docs/SPEC.md` the change touches.
> Then read the whole change.
>
> Look for, in this order:
> 1. Anything that breaks a floor (accessibility, respect for the publisher,
>    the reader's data and safety) or a "Never" rule.
> 2. Bugs: wrong behavior, missing error handling, security problems.
> 3. A principle broken without an entry in DESIGN.md's Exceptions log.
> 4. Missing tests (every feature needs them, including keyboard-only ones).
> 5. Documents the change affects but didn't update (AGENTS.md → "Keeping
>    the docs true"), and whether the summary lists them.
> 6. Libraries added without approval in `docs/libraries.md`.
> 7. Anything a future agent would misunderstand without a comment or a
>    note in `docs/decisions/`.
>
> Check each finding against the code before reporting it; don't report
> guesses. Post one comment on the pull request titled "Second-agent review",
> listing each finding with: how serious it is (must fix / should fix /
> minor), where it is, what's wrong, and why it matters, in plain language.
> If you find nothing, say so and say what you checked. Don't change any code.
