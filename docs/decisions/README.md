# Decisions

Short notes on significant technical decisions: what was decided, why, and
what would make us revisit it. They exist so a future agent (or person)
doesn't undo a deliberate choice by accident.

One file per decision, numbered in order: `NNNN-short-name.md`. Before
taking a number, look at the open pull requests too and take the next one
none of them uses. If another change takes it first anyway, renumber in
your next push (never a push of its own: each one runs every check again),
and run `node scripts/decisions.mjs --free` just before merging, which
fails if main has since taken one of your numbers. If a
decision changes, a new note replaces it and the old one says "Replaced by …"
at the top. Notes that later ones have replaced may be folded into one
summary note, one line each (as 0061 did); their full text stays in the
repository's history.

Each note says what it decided in one line, right under its title:
`**In one line:** …`. There is no shared list to add to, so two changes
made at once never clash over one (decision 0114). To browse them, open
this folder on GitHub: the notes are listed by number and name, and each
one's first line says what it decided. An agent lists them all, one line
each, oldest first:

```sh
node scripts/decisions.mjs            # every decision
node scripts/decisions.mjs passkey    # only those that mention a word
```

`scripts/check.sh docs` fails on a note with no line, or two notes that
share a number.
