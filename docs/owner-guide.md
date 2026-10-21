# How slowfeed is built: a guide for the owner

This guide explains, in plain language, what slowfeed is made of and how a
change goes from an idea to the live app. Agents keep it accurate whenever
tools, hosting or the workflow change.

---

## 1. The big picture

slowfeed has two halves:

- The **backend** runs on a server (a computer at Render that's always on).
  It fetches feeds, stores articles, handles sign-in, and answers the
  browser's requests.
- The **frontend** is the screens you see and use: the sidebar, the list, the
  article. It runs in your browser or phone.

When the app is built, the frontend is packed *inside* the backend, so the
whole of slowfeed is **one program file plus one database file**. That's what
makes it easy to back up and easy to move to another host.

```
 Your browser / phone                 Render (the server)
 ┌──────────────────┐   internet   ┌──────────────────────────────┐
 │  frontend        │ ◄──────────► │  slowfeed program (backend,  │
 │  (the screens)   │              │  with the frontend inside)   │
 └──────────────────┘              │  slowfeed database file      │
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
| **PWA** ("progressive web app") | A web standard that lets you add slowfeed to your phone's home screen, so it opens full-screen with its own icon | No app store needed; works on iPhone and Android |

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

**Who creates pull requests?** The agents do. You don't need to create one.
Your part is to read the summary, look at the screenshots, ask questions,
and then merge (or not).

## 5. Tests, checks, CI and CD

**Tests** are small programs that use slowfeed automatically and check the
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
- only approved libraries.

"**A feature isn't done until it has tests and the checks pass**" means an
agent can't call something finished just because it seems to work. It must
come with tests that prove it works, and every check must be green.

**GitHub Actions** is GitHub's own service for running these checks. Each time
a pull request is opened or updated, GitHub starts a fresh computer, builds
slowfeed, runs every check, and shows the results on the pull request: a
green tick ✓ if everything passed, a red cross ✗ if anything failed (with
details). Private repositories get a monthly allowance of free running time,
which a project this size shouldn't exceed.

**CI** ("continuous integration") is that whole practice: every change is
automatically checked before it's allowed into main. In slowfeed, GitHub
Actions does the CI.

**CD** ("continuous deployment") means that once a change is in main, it's put
live automatically. In slowfeed, Render does the CD: it watches main, and
when it changes, Render builds the new version and replaces the running one.

## 6. "The owner deploys by merging a pull request"

**Deploying** means putting a new version on the live app. Agents have no
access to Render, so they can't deploy. Instead:

1. An agent opens a pull request.
2. GitHub Actions runs the checks.
3. You review and press **Merge**.
4. The change is now in main. Render notices, builds the new version and
   switches to it. The app may be unavailable for a minute while it switches.
5. You try the change on the live app.

So pressing Merge *is* deploying. Nothing reaches the live app without you.
(Render's automatic deploy from main is something you'll switch on once,
following the guide in Milestone 2.)

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

**If a merged change turns out to be bad:** the merged pull request has a
**Revert** button. It creates a new pull request that undoes the change;
merging that puts the previous version back. Or ask an agent to do it.

## 8. Glossary

| Term | Meaning |
|---|---|
| Backend / frontend | The server half / the screens half of the app |
| Branch | A separate copy of the code for working on a change |
| CI / CD | Automatically checking every change / automatically putting merged changes live |
| Commit | One saved step of work, with a message |
| Compiler | The tool that turns written code into a working program, refusing code with certain mistakes |
| Database | Where slowfeed keeps feeds, articles, read/star state and settings (one SQLite file) |
| Deploy | Put a new version on the live app |
| Environment variable | A setting given to the app by the host (Render), e.g. the scrambled password, kept outside the code |
| GitHub Actions | GitHub's service that runs the checks on every pull request |
| Library / dependency | Ready-made code from others that slowfeed uses |
| Lint | An automatic check for likely mistakes and sloppy code |
| Main | The official version of the code; what runs live |
| Merge | Bring a pull request's changes into main (and so, live) |
| Migration | A careful, scripted change to the database's structure |
| Pull request (PR) | A proposed change, with summary, checks and discussion |
| Repository (repo) | The project folder on GitHub, with full history |
| Test | A small program that checks part of slowfeed works, automatically |
