# 0322: One fast round of checks, and threads side by side

**In one line:** The test browser's system pieces are remembered between runs, a pull request opens as soon as the change is built (GitHub runs every browser test while the second reviewer reads it, and every fix goes in one push), and threads work side by side instead of waiting for each other.

*20 November 2026. The owner asked how to build faster now that only agents write the code; this follows the measurement of pull requests #400 to #423, and the owner said "implement both".*

**What was slow.**
1. **Threads waiting for each other.** On 18 and 19 November three threads waited behind one another for about 7 hours in all: the accessibility fixes took 3 h 44 min from the owner's yes to live, 2 hours of it waiting.
2. **Two or three rounds of checks per change.** 19 of 20 changes needed two or more; half failed the first round, nearly always a browser test in a file the agent hadn't run itself. Before opening the pull request the agent also spent about 25 minutes running browser tests on its own computer, then GitHub ran them all again.
3. **A slower round.** One round went from about 7 minutes to about 14, mostly because `playwright install --with-deps` downloaded about 30 MB of fonts and libraries from Ubuntu's servers every run, at times at 110 kB/s (almost 5 minutes on one computer).

**What changes.**
1. **The system pieces are remembered** (`.github/install-browser.sh`): the first run on a GitHub computer image saves the packages Playwright installs, keyed on that image and `web/package-lock.json`, and later runs install them from the saved copies without asking Ubuntu. If they don't install, it falls back to Playwright's own install, so a run is never slower than before.
2. **Open the pull request once built** (AGENTS.md, `docs/operations/second-agent-review.md`, `docs/operations/building-and-running.md`): the agent runs the quick checks, not the browser tests, then opens the pull request; GitHub's six computers run every browser test while the fresh reviewer reads it, and the fixes for both go in one push. A browser test is run locally only while writing or fixing it.
3. **Threads side by side** (AGENTS.md, working agreement 2): a thread never waits for another to merge first, even when they touch the same files. Whichever merges second brings in the latest main first, as it always must, and settles any clash then.

**What stays.** Every check still runs on every pull request and must pass; the second-agent review stays; backups, the status-page check and merging rules are unchanged.

**Expected.** About 30 to 40 minutes less per change between "built" and "live", and no hours lost queued.
