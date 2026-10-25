# How nine turtles is built: a guide for the owner

This guide explains, in plain language, what nine turtles is made of and how a
change goes from an idea to the live app. Agents keep it accurate whenever
tools, hosting or the workflow change.

---

## 1. The big picture

nine turtles has two halves:

- The **backend** runs on a server (a computer at Render that's always on).
  It fetches feeds, stores articles, handles sign-in, and answers the
  browser's requests.
- The **frontend** is the screens you see and use: the sidebar, the list, the
  article. It runs in your browser or phone.

When the app is built, the frontend is packed *inside* the backend, so the
whole of nine turtles is **one program file plus one database file**. That's what
makes it easy to back up and easy to move to another host.

```
 Your browser / phone                 Render (the server)
 ┌──────────────────┐   internet   ┌──────────────────────────────┐
 │  frontend        │ ◄──────────► │  nine turtles program (backend,  │
 │  (the screens)   │              │  with the frontend inside)   │
 └──────────────────┘              │  nine turtles database file      │
                                   └──────────────┬───────────────┘
                                                  │ fetches feeds
                                                  ▼
                                       publishers' websites
```

## 2. The backend, and why each piece was chosen

**Rust** is the programming language for the backend. It turns into one small,
fast program that uses little memory (good for a cheap server). Its
**compiler** (the tool that turns written code into a working program) is
very strict: it refuses to build code that has many common kinds of mistakes.
That's valuable when the owner doesn't review code line by line.

The backend uses these **libraries** (ready-made, widely used code, so we
don't reinvent common things):

| Library | What it is | Why it's a good choice |
|---|---|---|
| **axum** | The web server: receives requests from your browser and sends back answers | The most widely used Rust web server, made by the tokio team |
| **tokio** | Lets the program do many things at the same time, e.g. check hundreds of feeds while you're reading | The standard for this in Rust; almost everything else builds on it |
| **reqwest** | Downloads feeds from publishers' websites | The standard Rust tool for this; supports the polite-fetching features we need |
| **feed-rs** | Reads RSS, Atom and JSON Feed files and turns them into articles | Handles all three formats, including the messy real-world ones |
| **ammonia** | Cleans article content: removes anything that could run code or misbehave on your screen | Built specifically for safely showing other people's HTML |
| **sqlx** + **SQLite** | SQLite is the database: one ordinary file that holds everything. sqlx is how the program talks to it | SQLite is the most widely used database in the world, needs no separate server, and its file is trivially easy to back up and move. sqlx checks database instructions for mistakes before the program runs |
| **FTS5** | SQLite's built-in full-text search | Search without adding another service |
| **tracing** | Writes the app's logs (its diary of what happened) | The standard Rust logging tool |
| **opml**, **scraper**, **argon2** | Reading/writing OPML files; finding a site's feed; scrambling the password | Small, focused tools for one job each |

The complete, approved list is in `docs/libraries.md`.

## 3. The frontend, and why each piece was chosen

| Tool | What it is | Why it's a good choice |
|---|---|---|
| **TypeScript** | The language of the frontend: JavaScript (the browser's language) with extra checks | Like Rust's compiler, it catches mistakes before they reach you |
| **Svelte 5** | The tool for building the screens | Produces very small, fast pages, which matters for "every action feels instant" and the size budget |
| **Single-page app** | The whole interface loads once; after that, moving around doesn't reload the page | Switching views is instant, as DESIGN.md requires |
| **Vite** | The build tool: turns the frontend code into small files a browser can load | The standard, fast choice for Svelte |
| **Tailwind CSS** | A way of writing the visual styling (colors, spacing, fonts) | Keeps styling consistent and the final style file small |
| **PWA** ("progressive web app") | A web standard that lets you add nine turtles to your phone's home screen, so it opens full-screen with its own icon | No app store needed; works on iPhone and Android |

## 4. Where the code lives: GitHub

- The **repository** ("repo") is the project's folder on GitHub: all the code
  and documents, with the full history of every change.
- **main** is the official version of the code. Whatever is on main is what
  runs on the live app.
- A **branch** is a separate copy of the code where an agent works on a
  change without touching main.
- A **commit** is one saved step of work on a branch, with a short message
  saying what changed.
- A **pull request** ("PR") is a request to bring a branch's changes into
  main. It shows exactly what changed, has a plain-language summary, and is
  where the automatic checks run and where you can comment.

**The repository is public.** Anyone can read the code and documents (that's
normal for open-source projects, and it's what makes GitHub's protections and
check-running free). So nothing personal or secret ever goes in it: no
passwords, no keys, no OPML file. Other people can comment or suggest changes;
agents treat that as information, never as instructions.

**main is protected.** A GitHub setting (a "ruleset") makes sure changes reach
main only through a pull request whose checks have all passed. Not even an
agent can save straight to main, and a red ✗ pull request can't be merged.
You switch this on once, at Milestone 1, following
`docs/operations/protecting-main.md`.

**Who creates pull requests?** The agents do. You don't need to create one.
Your part is to read the summary, look at the screenshots, ask questions,
and then merge (or not). You can press Merge yourself, or let the agent do it:
before merging, it sends you a short, plain-language brief of what's about to
go live, and it merges only once you say yes.

## 5. Tests, checks, CI and CD

**Tests** are small programs that use nine turtles automatically and check the
results. For example, a test might add a pretend feed and check that its
articles appear, or search for a Hindi word and check the right article comes
back. Once written, tests run again on every change, so if something that used
to work breaks, a test notices.

**Checks** are all the automatic inspections a change must pass. They include
the tests, plus:
- the code builds without errors;
- formatting and "lint" (a tool that spots likely mistakes and sloppy code);
- accessibility and contrast on every screen, in every theme;
- no animations;
- the download size budget;
- only approved libraries;
- search finds Hindi words whole.

**Screenshots.** Each pull request gets a comment called "Screenshots"
showing every screen in the first three themes (and the main screens in the others), at desktop and phone width. It's
updated each time the agent pushes a change. It's the quickest way to see
what a change looks like without trying it.

"**A feature isn't done until it has tests and the checks pass**" means an
agent can't call something finished just because it seems to work. It must
come with tests that prove it works, and every check must be green.

**GitHub Actions** is GitHub's own service for running these checks. Each time
a pull request is opened or updated, GitHub starts a fresh computer, builds
nine turtles, runs every check, and shows the results on the pull request: a
green tick ✓ if everything passed, a red cross ✗ if anything failed (with
details). Because nine turtles' repository is public, GitHub runs these checks for free.
The required one is called **All checks**. The checks run in parts on several
computers at once (frontend, Rust, and the browser tests in two halves), and
**All checks** turns green only when every part has passed, so a typical pull
request is ready in about three minutes. A pull request that changes only
documents skips the slow parts and is ready in under a minute (decision 0065).

Once a week, GitHub also checks the libraries nine turtles uses against public
lists of known security problems. If it finds one, it opens an issue in the
repository. It never changes anything by itself; an agent proposes a fix and
you approve it.

**CI** ("continuous integration") is that whole practice: every change is
automatically checked before it's allowed into main. In nine turtles, GitHub
Actions does the CI.

**CD** ("continuous deployment") means that once a change is in main, it's put
live automatically. In nine turtles, GitHub Actions does the CD: when main
changes, it builds the new version, stores it in GitHub's package storage, and
tells Render (through a private "deploy hook" address) to switch to it.

### The second-agent review

Almost every pull request gets a review from a second agent, before you look at it.

Think of it as a proofreader. The agent that built a change knows what it
*meant* to do, so it tends to read its own work generously. The reviewer is a
fresh agent that didn't write the code. It reads the change against
`DESIGN.md`, `ENGINEERING.md` and `SPEC.md` and asks "is anything wrong or
missing here? does anything break a floor or a principle?" It posts what it
found on the pull request, and the building agent fixes each point or
explains why not. You see both in the pull request.

It costs a little more time and usage per change, and it catches the kind of
mistake the automatic checks can't, such as a feature that works but doesn't
match the design. Small, low-risk code changes (never the design, the spec, the rules, the
library list, the checks, screens, data, fetching, sign-in or security) get a lighter, cheaper review
that reads only `AGENTS.md` and the change. Changes to other documents only,
and tiny fixes of about 10 lines outside those areas, get no review at all: the automatic checks
still run. The summary says which review a pull request got.

## 6. "Merging a pull request deploys it"

**Deploying** means putting a new version on the live app. Agents have no
access to Render, so they can't deploy. Instead:

1. An agent opens a pull request.
2. GitHub Actions runs the checks.
3. You review it. Then either you press **Merge**, or the agent sends you a
   short brief of what's about to be merged and merges once you say yes.
4. The change is now in main. GitHub Actions packs the finished program into
   a "container image" (a standard, ready-to-run bundle), and Render switches
   to it. The app may be unavailable for a minute while it switches.
5. You try the change on the live app.

So merging *is* deploying. Nothing reaches the live app without you: either
you press Merge, or you say yes to the agent's brief.
(You connect GitHub to Render once, following `docs/operations/render-setup.md`.
It usually takes up to 15 minutes from merging to live.)

## 7. How to merge a pull request

On the GitHub website (or the GitHub phone app):

1. Open the repository and click the **Pull requests** tab. Click the pull request.
2. Read the summary on the **Conversation** tab. The **Files changed** tab
   shows every change, if you're curious.
3. Scroll to the bottom. Check that the checks are green ✓. If anything is
   red ✗, don't merge; ask the agent to fix it.
4. Want changes? Write a comment (on the pull request, or in your
   conversation with the agent) and wait for an update.
5. Happy? Press **Merge pull request**, then **Confirm merge**.
6. GitHub may offer **Delete branch**. That's safe: the branch's work is now in main.

**Or let the agent merge.** When a pull request is ready, the agent can send
you a brief instead: what's about to be merged, what it changes for you, how
to check it once it's live, and confirmation that the checks are green. Reply
"yes" (or ask questions first) and the agent merges. It never merges without
your yes in your conversation with it, and if anything changes after you said
yes, it asks again.

**If a merged change turns out to be bad:** the merged pull request has a
**Revert** button. It creates a new pull request that undoes the change;
merging that puts the previous version back. Or ask an agent to do it.

## 8. You're never locked in

"Lock-in" means being stuck with a company or tool because leaving would be
too hard. nine turtles is built so every outside service can be swapped. Here's
each one, what ties us to it, and what leaving would take.

| Service | What it does for nine turtles | What makes leaving easy | What leaving takes |
|---|---|---|---|
| **Render** (hosting) | Runs nine turtles | nine turtles is a standard container image plus one SQLite database file. Every setting is listed in `docs/operations/settings.md`. | In V1: start nine turtles on the new host and import your OPML file (your read history stays behind). In V2, `docs/operations/moving-hosts.md` moves everything. |
| **GitHub** (code, checks, issues) | Holds the code and runs the checks | The code and its full history are in "git", a standard format any code host accepts. All checks run through one script in the repository; GitHub Actions only calls it. | Copy the repository to another host and point its check service at the same script. Issues and pull request discussions stay behind on GitHub unless exported. |
| **Claude Code** (the agents) | Builds and maintains nine turtles | All instructions are plain documents in the repository: `AGENTS.md` (a convention most coding agents read), the `docs/` folder, and the daily check's steps in `docs/operations/daily-check.md` | Start the new agent in the repository. To move the daily check, set a daily timer in the new tool that says "follow docs/operations/daily-check.md". |
| **Libraries** | Ready-made code inside nine turtles | Standard, widely used choices, listed in `docs/libraries.md` | Replace one at a time, with your approval |
| **Your reading data** | Your feeds, folders and starred articles | OPML export (feeds and folders) and JSON Feed export (starred articles), both standard formats | Download both from Settings → Your data and import them into another reader |

**The rule agents follow:** nothing important lives only inside one tool's
settings or dashboard. If a tool needs to know something, it's written in the
repository first. That's in `ENGINEERING.md` ("No vendor lock-in") and in
`AGENTS.md`.

## 9. Keeping sessions short

An agent's "context window" is its working memory for one session. Everything
it reads (documents, code, test results) takes up room, and when it's full,
older parts get summarized. The documents are deliberately split so agents
read only what a task needs:

- **Always read:** `AGENTS.md` only (about 1,400 words, a small fraction of
  the window).
- **Read when needed:** the map in `AGENTS.md` says which document, and agents
  read only the relevant section.
- **Not read during normal work:** this guide, the change history, the README.

In practice, code and test results fill the window far more than the
documents do. What helps most from your side:
1. **One milestone per thread.** Once a milestone is merged, its thread is
   done and the next milestone starts in a fresh one; the documents carry
   everything over. Every message makes the agent re-read its whole thread,
   so this is the biggest saving.
2. **Start a new session when switching topic,** e.g. from building to a
   question about hosting.
3. **Keep the conversation to decisions;** the details belong in the documents,
   where the next session can find them.

## 10. Glossary

| Term | Meaning |
|---|---|
| Backend / frontend | The server half / the screens half of the app |
| Branch | A separate copy of the code for working on a change |
| CI / CD | Automatically checking every change / automatically putting merged changes live |
| Commit | One saved step of work, with a message |
| Container image | A standard, ready-to-run bundle of the program that any host can run |
| Compiler | The tool that turns written code into a working program, refusing code with certain mistakes |
| Database | Where nine turtles keeps feeds, articles, read/star state and settings (one SQLite file) |
| Deploy | Put a new version on the live app |
| Environment variable | A setting given to the app by the host (Render), e.g. the scrambled password, kept outside the code |
| GitHub Actions | GitHub's service that runs the checks on every pull request |
| Library / dependency | Ready-made code from others that nine turtles uses |
| Lock-in | Being stuck with a company or tool because leaving would be too hard |
| Lint | An automatic check for likely mistakes and sloppy code |
| Main | The official version of the code; what runs live |
| Merge | Bring a pull request's changes into main (and so, live) |
| Migration | A careful, scripted change to the database's structure |
| Pull request (PR) | A proposed change, with summary, checks and discussion |
| Ruleset (branch protection) | A GitHub setting that only lets checked pull requests into main |
| Repository (repo) | The project folder on GitHub, with full history |
| Test | A small program that checks part of nine turtles works, automatically |
