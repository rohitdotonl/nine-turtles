# 0270: The app's download budget is 250 KB

**In one line:** The owner raised the budget for the app's code and styles from 200 KB to 250 KB (compressed), because the app had reached it and every change waiting adds code; the fonts' budgets are unchanged.

*14 November 2026. Replaces the 200 KB figure of decision [0136](0136-braun-themes.md).*

**What happened.** After the change that split a person's page in two
(decisions 0265 to 0267, with its review fixes), the app's code and styles
were 5 bytes under their 200 KB budget, and the changes waiting behind it
each add code. The size check (`scripts/check-size.mjs`) would have stopped
every one of them.

**Decision.** The owner raised the budget for app code and styles to
**250 KB**, measured compressed, as before. The fonts' budgets stay as they
are: 400 KB for the fonts every reader may download, and 150 KB for each
reading face for another script (decision 0227).

**Why.** The budget is there so nine turtles stays quick to open
(ENGINEERING.md → "Fast by design"), not to stop work the owner has asked
for. 250 KB is still small for an app of this size, and the check still
catches a sudden jump. Trimming unrelated code to squeeze under would have
cost more than it saves.

**Where it's said.** `scripts/check-size.mjs`, `docs/ENGINEERING.md` →
"Fast by design", `docs/spec/25-speed.md` and `docs/operations/checks.md`.
