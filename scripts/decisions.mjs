// The list of decisions, one line each, built from the notes themselves
// (docs/decisions/NNNN-name.md, each with an "In one line:" under its title).
// No shared list to edit, so two changes made at once never clash over it.
//
//   node scripts/decisions.mjs            every decision, oldest first
//   node scripts/decisions.mjs passkey    only those whose line mentions it
//   node scripts/decisions.mjs --check    fails on a note with no line, or two notes with one number

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const folder = join(import.meta.dirname, "..", "docs", "decisions");
const marker = "**In one line:** ";
const notes = readdirSync(folder)
  .filter((name) => /^\d{4}-.+\.md$/.test(name))
  .sort()
  .map((name) => {
    const line = readFileSync(join(folder, name), "utf8")
      .split("\n")
      .find((each) => each.startsWith(marker));
    return { number: name.slice(0, 4), name, line: line?.slice(marker.length) };
  });

const [argument] = process.argv.slice(2);
if (argument === "--check") {
  const problems = [];
  const seen = new Map();
  for (const note of notes) {
    if (!note.line) problems.push(`docs/decisions/${note.name} has no "In one line:" under its title.`);
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
} else {
  const wanted = argument?.toLowerCase();
  for (const note of notes) {
    if (wanted && !`${note.name} ${note.line}`.toLowerCase().includes(wanted)) continue;
    console.log(`${note.number}  ${note.line ?? "(no line yet)"}`);
  }
}
