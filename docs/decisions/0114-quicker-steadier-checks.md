# 0114: Quicker, steadier checks

**In one line:** Quicker, steadier checks: libraries built optimized for the Rust tests, only the libraries remembered between runs, the browser tests in parts (four, six since November 2026) with the browser remembered between runs, agents run only the browser tests for what they changed before a pull request (GitHub runs them all), and the timing fixed in the tests that failed now and then; no automatic retries; each decision carries its own one line, listed by `scripts/decisions.mjs`, so no shared list clashes

*October 2026.*

**Decision.** Four changes make the checks on each pull request finish
sooner and stop failing for no real reason. Nothing they check changes.

- **Optimized libraries for the Rust tests.** `server/Cargo.toml` builds
  every library optimized in the "dev" build the tests use
  (`[profile.dev.package."*"] opt-level = 2`), and keeps only line numbers
  for debugging. nine turtles' own code is still built the quick way. The
  slowest tests spent their time in libraries running unoptimized: password
  scrambling (slow on purpose, and many times slower unoptimized), the
  database and HTML cleaning. On a test computer the Rust tests went from
  about 2½ minutes to under one.
- **A smaller remembered build.** GitHub's copy of the compiled libraries
  was about 4.3 GB and took over a minute to fetch, because it held nine
  turtles' own build too. It now holds only the libraries (`cargo clean
  --package nine-turtles` before it's saved), well under 1 GB. Its name
  includes `server/Cargo.toml`, so a change to how libraries are built makes
  a fresh copy.
- **The browser tests in four parts instead of two** (decision 0065 said to
  add parts when a half passed about two minutes; they had reached over
  three). Each GitHub computer can run only two browser tests at a time
  usefully: four at once was barely quicker and made a test fail. Four
  computers each running a quarter is what helps. Playwright shares out
  whole files, and the accessibility checks (about a fifth of all the
  tests, each on its own screen) used to land on one computer together, so
  that file may now be shared out test by test
  (`test.describe.configure({ mode: "parallel" })`).
- **Timing fixed in the tests that failed now and then.** A sign-in test
  expected a wait of exactly 60 seconds, though a second could pass while
  the password was checked; it now accepts 55 to 60. `tabTo` gave up after a
  fixed number of Tab presses, which the growing sidebar of the shared test
  app kept overtaking; it now stops only when Tab comes all the way round. A
  touch-target test measured an arrow, then tried it a moment later; it now
  measures at the moment it tries. A keys test pressed End before the
  article's lazily loaded picture had given it anything to scroll; it now
  waits for the picture first. The newsletter test emailed a feed into the
  first nine turtles, the one that must stay empty for the first-visit
  tests, which failed when they ran at that moment; it now uses the nine
  turtles the feed tests share.

**Not done.** Retrying failed tests automatically: it would hide tests that
fail now and then instead of fixing them, and turn real but rare problems
green. Sharing out every file test by test (Playwright's `fullyParallel`):
tests in a file sometimes build on one another, so only files whose tests
stand alone say so.

**Revisit if** a browser test part passes about two minutes (add parts), or
the Rust tests pass about two minutes (run their files side by side).

**Later (November 2026).** Six parts instead of four. On the eight pull
requests merged on 10 November, the slowest quarter took about 5 minutes of
tests and held up every pull request, while the others took 2 to 3½. The
browser the tests use is now remembered between runs too: its download
usually took under half a minute but sometimes over three. And `tabTo`
starts its walk afresh when the place the keyboard was on leaves the page
(the shared app's sidebar redrawing as new articles came in), which it had
mistaken for Tab coming all the way round. The answering tests stop
standing in for the server's lists before each test closes its page: a list
asked for as a test ended was thrown away with the page, failing a test
that had passed.

And, with the owner's yes (10 November 2026), an agent no longer runs every
browser test on its own computer before opening a pull request: it runs the
quick parts and the browser test files for what it changed
(`NINE_TURTLES_BROWSER_TESTS`). On a cloud computer the whole set took
10½ minutes, on top of building the program, and then ran again on GitHub,
which is what decides: nothing merges unless every test passes there.

The container image's build keeps the libraries too: the Dockerfile builds
them first, from `Cargo.toml` and `Cargo.lock` alone, and GitHub keeps that
step in its package storage (the image's `buildcache` tag), so a merge
rebuilds only nine turtles itself. It uses `docker buildx` with Docker's own
builder, BuildKit, at a fixed version; a host without the kept copy simply
builds everything, as before.

Nothing shared to add a line to: each decision note carries its own one
line under its title, and `scripts/decisions.mjs` lists them, instead of a
table in `docs/decisions/README.md` that nearly every change added a row
to. DESIGN.md's "Last updated" line, which repeated every decision in one
paragraph, points to that list instead, and BRAND.md's drops its list of
numbers. Two changes made at once had clashed there and had to wait for
the checks again.
