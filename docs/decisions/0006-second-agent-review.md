# 0006: The second-agent review is written instructions, not an app

*October 2026, Milestone 1. Chosen by the owner.*

**Decision.** The review in step 5 of "How a change happens" (AGENTS.md) is
done by following `docs/operations/second-agent-review.md`. The agent that
built a change starts a fresh reviewer agent, which sees only the pull request
and the documents, and posts its findings on the pull request.

**Why.** No keys, no extra cost, and it works with any agent tool
(ENGINEERING.md → "No vendor lock-in"). An automatic AI reviewer app on GitHub
would tie the review to one company's app and might need a paid key.

*Since decision 0021, documents-only changes and tiny fixes get no review.*

**Revisit if** reviews get skipped in practice. Then an automatic reviewer
could be added on top, with the owner's approval.
