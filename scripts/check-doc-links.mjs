// Broken links between documents: fails if a document links to a file that
// doesn't exist, so a moved or renamed document never leaves agents (or the
// owner) at a dead end. Checks Markdown links like [text](path) and file
// paths in backticks like `docs/SPEC.md`. Web addresses aren't checked.
// The marketing research (docs/RnD) and the changelog, a record of the past,
// are left out. Not checked: reference-style links ([ref]: path), links
// with a title or spaces ([a](path "title"), [a](<a b.md>)), backtick paths
// relative to the document, and anchors inside a file.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const skip = ["docs/RnD/", "docs/CHANGELOG.md"];
const problems = [];

const documents = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  ...readdirSync(join(root, "docs"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => relative(root, join(entry.parentPath, entry.name))),
].filter((file) => existsSync(join(root, file)) && !skip.some((s) => file.startsWith(s)));

// Folders a backtick path may start with, from the repository's top.
const tops = ["docs/", "server/", "web/", "scripts/", "website/", "cloudflare/", ".github/"];
// What a build makes, which isn't in the repository until something is built.
const built = ["web/dist", "web/screenshots", "server/target", "website/_site"];

for (const file of documents) {
  // Code blocks (fences that begin a line, maybe indented inside a list) are
  // blanked, keeping lines. A closing fence is at least as long as the opening.
  const text = readFileSync(join(root, file), "utf8").replace(
    /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[`~]*[ \t]*$/gm,
    (block) => block.replace(/[^\n]/g, " "),
  );
  const report = (index, target) => {
    const line = text.slice(0, index).split("\n").length;
    problems.push(`${file} line ${line}: ${target} doesn't exist`);
  };

  for (const match of text.matchAll(/\]\(<?([^)\s>]+)>?\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const from = target.startsWith("/") ? root : dirname(join(root, file));
    let path;
    try {
      path = decodeURI(target);
    } catch {
      problems.push(`${file} line ${text.slice(0, match.index).split("\n").length}: ${match[1]} has a broken % code`);
      continue;
    }
    if (!existsSync(join(from, path))) report(match.index, match[1]);
  }

  for (const match of text.matchAll(/`([^`\s]+)`/g)) {
    const target = match[1].split("#")[0].replace(/[.,:;]$/, "").replace(/(:\d+)+$/, "");
    if (!tops.some((top) => target.startsWith(top))) continue;
    if (/[*<>{}$…]|\.\.\./.test(target)) continue; // a pattern or placeholder, not a file
    if (built.some((b) => target.startsWith(b))) continue;
    if (!existsSync(join(root, target))) report(match.index, target);
  }
}

if (problems.length) {
  console.error(`Broken links between documents (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`Links between documents: ${documents.length} documents, no broken links.`);
