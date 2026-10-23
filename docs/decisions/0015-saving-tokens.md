# 0015: Spending fewer tokens per change

*23 October 2026, after Milestone 4. Chosen by the owner.*

**Decision.** Four changes, all to make sessions cheaper without lowering
the bar:

1. **One milestone per thread.** When a milestone's pull request is merged,
   that thread is done and the next milestone starts in a fresh one. Every
   message makes an agent re-read its whole thread, so long threads cost the
   most.
2. **A light second-agent review for small, low-risk changes**
   (`docs/operations/second-agent-review.md`). The light reviewer reads
   `AGENTS.md` and the change, not every rule document. Code that runs in the
   app, screens, stored data, sign-in, `DESIGN.md`, `SPEC.md` and the floors
   still get the full review.
3. **A shorter AGENTS.md** (read at the start of every session), with the
   same rules in fewer words. Library names moved out: `docs/libraries.md`
   has them.
4. **A tighter DESIGN.md** (read in full before any work on screens), with
   the same rules in fewer words. No rule, value or heading changed.

**Why.** The owner asked how to reduce token use. On a documents-only change,
the full review had cost about as much as the change itself.
