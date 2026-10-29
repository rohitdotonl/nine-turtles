# 0126: Code stays tidy: small files and nothing unused, checked

*29 October 2026.*

**Context.** The code tidy-up of October 2026 (survey, bug fixes, then 35
small pull requests) found that the mess had come from a few habits:
files that kept growing (`Shell.svelte` reached 2,261 lines, `feeds.rs`,
`feed.rs` and `mcp.rs` were not far behind), so an agent couldn't read a
whole file at once and added a new copy of something instead of finding the
old one; and code nobody used any more staying around. The owner approved
checks that keep this from coming back (28 October 2026, "Discuss the code
tidy-up"), using only tools already in the stack.

**Decision.** A new step, "Code stays tidy" (`scripts/check-tidy.mjs`),
runs with the frontend part of `scripts/check.sh`:

1. **Small files.** A file of the app's own code (`server/src/`, `web/src/`,
   the newsletter forwarder) has at most 800 lines of code. Tests don't
   count: test files are left out, and so is a Rust file's own tests part
   (from `#[cfg(test)]` to the end), so a fix never has to split a file to
   add its test. The eleven files that were already longer are listed in
   the script with their size: they may shrink but never grow. When one
   shrinks, the check fails until its number is lowered to match, and it
   leaves the list once it fits.
2. **Nothing unused.** It fails on a file in `web/src/` that nothing
   imports, a web export that nothing uses, and a server `pub` item whose
   name appears nowhere else. The web type check now also refuses unused
   names and parameters inside a file (`noUnusedLocals`,
   `noUnusedParameters`; a parameter that must stay starts with `_`), as
   clippy already does for Rust. "Used" counts tests: code only its own
   tests use passes.

The check matches text, not meaning, so some things slip past it: a dead
file named like a live one in another folder, `export { … }` and
`export default`, and an unused server item with a common name (`new`,
`get`). It catches the common cases cheaply; the second-agent review looks
for the rest.

Turning these on found two unused things, both removed: the keyboard's
`soon()` (for shortcuts not built yet; the last one was built) with its
`ready` flag, and an unused parameter in a contrast test.

**Why these and not more.** Both are plain scripts like the no-motion
check: no new library, quick, and the message says what to do. A stricter
rule (no export used only by its own file) would have meant 45 changes
for no gain; exported types document a file's shape.

**Changing it.** Raising the limit or a file's number needs the owner's
yes (AGENTS.md → "How a change happens": what a check enforces).
