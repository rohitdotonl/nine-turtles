// Fails if the code uses a library that isn't on the approved list in
// docs/libraries.md, or a GitHub Actions building block that isn't from
// GitHub's own `actions/` collection and pinned to an exact version.
// Uses only what comes with Node, so the check itself needs no libraries.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const problems = [];

// 1. The approved list: first column of every table row whose status says
//    "Approved". "serde, serde_json" approves both names.
const approved = new Set();
for (const line of read("docs/libraries.md").split("\n")) {
  const cells = line.split("|").map((cell) => cell.trim());
  if (cells.length < 4 || !/\bApproved\b/.test(cells.at(-2))) continue;
  for (const name of cells[1].split(",")) approved.add(name.trim().replaceAll("`", ""));
}

// 2. Rust: every way server/Cargo.toml can name a library:
//    [dependencies] with one line per library, [dependencies.foo] with one
//    section per library, the same under [target.'…'.dependencies] (for one
//    kind of computer only), and the dev- and build- variants of each. A
//    `package = "…"` setting means the real library has that other name.
const dependencyTable = /^(target\..+\.)?(dev-|build-)?dependencies(\.(.+))?$/;
const unquote = (name) => name.trim().replace(/^["']|["']$/g, "");
const rustLibraries = [];
let inTable = false; // Inside a table that lists one library per line.
let sectionLibrary = null; // Inside a [dependencies.foo] section: the library.
for (const line of read("server/Cargo.toml").split("\n")) {
  const header = line.match(/^\s*\[([^\]]+)\]/);
  if (header) {
    const table = header[1].trim().match(dependencyTable);
    inTable = Boolean(table) && !table[4];
    sectionLibrary = table?.[4] ? { name: unquote(table[4]) } : null;
    if (sectionLibrary) rustLibraries.push(sectionLibrary);
    continue;
  }
  const renamed = line.match(/package\s*=\s*["']([^"']+)["']/)?.[1];
  if (sectionLibrary && renamed) sectionLibrary.name = renamed;
  if (!inTable) continue;
  // `foo = …`, `"foo" = …` and the dotted form `foo.version = …`.
  const name = line.match(/^\s*["']?([A-Za-z0-9_-]+)["']?\s*(\.[\w.-]+\s*)?=/)?.[1];
  if (name) rustLibraries.push({ name: renamed ?? name });
}
for (const { name } of rustLibraries) {
  if (!approved.has(name)) {
    problems.push(`server/Cargo.toml uses "${name}", which isn't approved in docs/libraries.md`);
  }
}

// 3. Frontend and website: every library named in web/package.json and
//    website/package.json.
for (const file of ["web/package.json", "website/package.json"]) {
  const pkg = JSON.parse(read(file));
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (!approved.has(name)) {
        problems.push(`${file} uses "${name}", which isn't approved in docs/libraries.md`);
      }
    }
  }
}

// 4. GitHub Actions: only GitHub's own building blocks, pinned to an exact
//    version (a full commit fingerprint), so nothing changes without us.
const workflows = ".github/workflows";
for (const file of readdirSync(join(root, workflows))) {
  for (const [index, line] of read(`${workflows}/${file}`).split("\n").entries()) {
    const uses = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/)?.[1];
    if (!uses || uses.startsWith("./")) continue;
    const where = `${workflows}/${file} line ${index + 1}`;
    if (!uses.startsWith("actions/")) {
      problems.push(`${where} uses "${uses}"; only GitHub's own actions/ building blocks are approved`);
    } else if (!/@[0-9a-f]{40}$/.test(uses)) {
      problems.push(`${where} uses "${uses}"; it must be pinned to a full commit fingerprint`);
    }
  }
}

if (problems.length > 0) {
  console.error("Library check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  console.error("\nAsk the owner first; once they approve, add the library to docs/libraries.md.");
  process.exit(1);
}
console.log(`Library check passed (${approved.size} approved libraries).`);
