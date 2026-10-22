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

// 2. Rust: the [dependencies], [dev-dependencies] and [build-dependencies]
//    tables of server/Cargo.toml.
let section = "";
for (const line of read("server/Cargo.toml").split("\n")) {
  const header = line.match(/^\s*\[([^\]]+)\]/);
  if (header) {
    section = header[1].trim();
    continue;
  }
  if (!/^(dev-|build-)?dependencies$/.test(section)) continue;
  const name = line.match(/^\s*([A-Za-z0-9_-]+)\s*=/)?.[1];
  if (name && !approved.has(name)) {
    problems.push(`server/Cargo.toml uses "${name}", which isn't approved in docs/libraries.md`);
  }
}

// 3. Frontend: every library named in web/package.json.
const pkg = JSON.parse(read("web/package.json"));
for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
  for (const name of Object.keys(pkg[field] ?? {})) {
    if (!approved.has(name)) {
      problems.push(`web/package.json uses "${name}", which isn't approved in docs/libraries.md`);
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
