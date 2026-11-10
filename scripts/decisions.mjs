// The list of decisions, one line each, built from the notes themselves
// (docs/decisions/NNNN-name.md, each with an "In one line:" under its title).
// No shared list to edit, so two changes made at once never clash over it.
//
//   node scripts/decisions.mjs            every decision, oldest first
//   node scripts/decisions.mjs passkey    only those whose line mentions it
//   node scripts/decisions.mjs --check    fails on a note with no line, or two notes with one number
//   node scripts/decisions.mjs --free     fails if main (fetched first) has since given one of
//                                         this branch's numbers to another note: run it just
//                                         before merging, since each change's checks ran
//                                         before the other was merged

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const folder = join(import.meta.dirname, "..", "docs", "decisions");
const marker = "**In one line:** ";
const notes = readdirSync(folder)
  .filter((name) => /^\d{4}-.+\.md$/.test(name))
  .sort()
  .map((name) => {
    // The line sits right under the title: line 3, after one blank line.
    const third = readFileSync(join(folder, name), "utf8").split("\n")[2] ?? "";
    const line = third.startsWith(marker) ? third.slice(marker.length).trim() : "";
    return { number: name.slice(0, 4), name, line };
  });

const [argument] = process.argv.slice(2);
if (argument === "--check") {
  const problems = [];
  const seen = new Map();
  for (const note of notes) {
    if (!note.line) problems.push(`docs/decisions/${note.name} needs "${marker}…" on its third line, under its title.`);
    if (seen.has(note.number)) {
      problems.push(`${seen.get(note.number)} and ${note.name} share number ${note.number}: give the newer one the next free number.`);
    }
    seen.set(note.number, note.name);
  }
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`Decisions: ${notes.length} notes, each with its one line and its own number.`);
} else if (argument === "--free") {
  // From the repository's top folder, wherever this is run from.
  const git = (...words) => execFileSync("git", words, { encoding: "utf8", cwd: join(folder, "..", "..") });
  git("fetch", "--quiet", "origin", "main");
  const onMain = git("ls-tree", "--full-tree", "--name-only", "origin/main", "docs/decisions/")
    .split("\n")
    .map((path) => path.replace("docs/decisions/", ""))
    .filter((name) => /^\d{4}-.+\.md$/.test(name));
  // An empty list means git couldn't read main's notes: never say "free" without having looked.
  if (onMain.length === 0) {
    console.error("Couldn't read main's decision notes (git ls-tree origin/main docs/decisions/), so nothing was checked.");
    process.exit(1);
  }
  const mainNames = new Set(onMain);
  const taken = new Map(onMain.map((name) => [name.slice(0, 4), name]));
  const highest = Math.max(...[...onMain, ...notes.map((note) => note.name)].map((name) => Number(name.slice(0, 4))));
  const clashes = notes.filter((note) => !mainNames.has(note.name) && taken.has(note.number));
  clashes.forEach((note, index) => {
    const next = String(highest + 1 + index).padStart(4, "0");
    console.error(`${note.name}: main now has ${taken.get(note.number)}. Renumber it to ${next} (and every mention of decision ${note.number} this change made).`);
  });
  if (clashes.length > 0) process.exit(1);
  console.log("Decisions: this branch's numbers are still free on main.");
} else {
  const wanted = argument?.toLowerCase();
  for (const note of notes) {
    if (wanted && !`${note.name} ${note.line}`.toLowerCase().includes(wanted)) continue;
    console.log(`${note.number}  ${note.line || "(no line yet)"}`);
  }
}
