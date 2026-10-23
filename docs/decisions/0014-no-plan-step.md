# 0014: No separate plan to approve before building

*23 October 2026, after Milestone 4. Decided by the owner.*

**Decision.** "How a change happens" (AGENTS.md) used to start with the
agent proposing a plan and waiting for the owner's yes before building
anything. That step is gone. When the owner asks for the next milestone (or
any change), the agent starts building from `docs/PLAN.md` and
`docs/SPEC.md` straight away.

**Why.** The owner asked for it: the plan and the spec already say what to
build, so a fresh plan to read and approve repeated them and slowed every
milestone down. `docs/PLAN.md` and `docs/SPEC.md` no longer say "Draft for
the owner's approval": they are what agents build from.

**What still needs the owner.** The agent asks when the documents don't
settle something or another rule says to ask: for example a real choice
(offered plainly, with a suggestion), a new library, a feature or behavior
not yet in `docs/SPEC.md`, a change to `docs/DESIGN.md` or to what a check
enforces, anything that could lose data, or anything it's unsure of. It
keeps working on the parts the question doesn't touch. Everything after
building is unchanged: automatic checks, the second-agent review, and the
merge brief plus the owner's yes before anything reaches the live app
(decision 0009).
