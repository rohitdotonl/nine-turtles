// "Code stays tidy" (decision 0126): the two habits that let the code grow
// messy before the 2026 tidy-up, checked so they can't creep back.
//
// 1. No giant files. A file of the app's own code (server/src, web/src and
//    the newsletter forwarder) has at most LIMIT lines, about what an agent
//    can read and hold in mind at once. Files that were already longer when
//    this check began are listed in CEILINGS with their size then: they may
//    shrink but never grow: when one shrinks, its number is lowered in the
//    same change, and it leaves the list once it fits under LIMIT. Tests are
//    left out (test files, and a Rust file's `#[cfg(test)]` part at its end):
//    a long test file is a list of cases, read one at a time, and a fix
//    should never have to split a file to add its test.
// 2. Nothing unused. A file in web/src that nothing imports, a name a web
//    file exports that nothing uses (exporting a name its own file uses is
//    fine: it documents the shape), or a `pub` item in the server
//    whose name appears nowhere else. (Unused names inside a file are already
//    caught: clippy for Rust, `noUnusedLocals` in web/tsconfig.json for the
//    web app.) "Used" counts tests: code only its own tests use passes.
//
// What it can't see: it matches text, not meaning. A dead file named like a
// live one elsewhere, `export { … }` and `export default`, and an unused
// server item with a common name (`new`, `get`) all pass. It catches the
// common cases cheaply; the second-agent review looks for the rest.

import { readFileSync, readdirSync } from "node:fs";
import { basename, join, relative } from "node:path";

const LIMIT = 800;

// Lines of code (tests left out) each long file has. The check fails until a
// number is lowered to match a file that shrank; never raise one. Splitting
// a file by concept is the way down (docs/ENGINEERING.md → "Keeping the code
// tidy").
const CEILINGS = {
  "web/src/app.css": 1921,
  "web/src/lib/Shell.svelte": 1525,
  "server/src/greader.rs": 1004,
  "web/src/lib/ItemList.svelte": 954,
  "server/src/assistants.rs": 948,
  "server/src/accounts.rs": 934,
  "web/src/lib/Settings.svelte": 913,
  "server/src/payments.rs": 841,
  "server/src/auth.rs": 819,
};

const root = join(import.meta.dirname, "..");
const problems = [];

function files(dir, extensions) {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

const text = new Map();
const read = (file) => {
  if (!text.has(file)) text.set(file, readFileSync(join(root, file), "utf8"));
  return text.get(file);
};
// Lines of code: a Rust file's own tests (from `#[cfg(test)]` on) don't count.
const lines = (file) => {
  const all = read(file).split("\n");
  if (all.at(-1) === "") all.pop();
  const tests = file.endsWith(".rs") ? all.findIndex((line) => line.startsWith("#[cfg(test)]")) : -1;
  return tests === -1 ? all.length : tests;
};
const isTest = (file) => /\.test\.ts$/.test(file);

// 1. No giant files.
const appCode = [
  ...files("server/src", [".rs"]),
  ...files("web/src", [".ts", ".svelte", ".css", ".js"]).filter((file) => !isTest(file)),
  ...files("cloudflare", [".js"]),
];
for (const file of appCode) {
  const count = lines(file);
  const ceiling = CEILINGS[file];
  if (ceiling === undefined && count > LIMIT) {
    problems.push(`${file} has ${count} lines, over the limit of ${LIMIT}. Split it by concept.`);
  } else if (ceiling !== undefined && count > ceiling) {
    problems.push(`${file} grew to ${count} lines; it may not grow past ${ceiling}. Move something out first.`);
  } else if (ceiling !== undefined && count <= LIMIT) {
    problems.push(`${file} is down to ${count} lines: take it off CEILINGS in scripts/check-tidy.mjs.`);
  } else if (ceiling !== undefined && count < ceiling) {
    problems.push(`${file} shrank to ${count} lines: lower its number in CEILINGS (${ceiling}) to ${count}.`);
  }
}
for (const file of Object.keys(CEILINGS)) {
  if (!appCode.includes(file)) problems.push(`${file} is on CEILINGS but doesn't exist: take it off.`);
}

// 2. Nothing unused: the web app.
const webCode = files("web/src", [".ts", ".svelte", ".js"]);
const webAll = [...webCode, ...files("web/tests", [".ts"]), "web/vite.config.ts", "web/playwright.config.ts"];
const word = (name) => new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}(?![\\w$])`);
const elsewhere = (name, file, among) => among.some((other) => other !== file && word(name).test(read(other)));

for (const file of webCode.filter((file) => !isTest(file))) {
  for (const match of read(file).matchAll(
    /^\s*export\s+(?:async\s+)?(?:const|let|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
  )) {
    const inside = read(file).split(word(match[1])).length - 1;
    if (inside <= 1 && !elsewhere(match[1], file, webAll)) {
      problems.push(`${file} exports ${match[1]}, which nothing uses. Delete it.`);
    }
  }
  if (file === "web/src/main.ts") continue; // where the app starts
  const name = basename(file).replace(/\.(ts|js)$/, "");
  // `from "./name"`, `import "./name"` or `import("./name")`.
  const imported = new RegExp(`(?:from|import)\\s*\\(?\\s*["'][^"']*/${name.replace(/\./g, "\\.")}(\\.(ts|js))?["']`);
  if (!webAll.some((other) => other !== file && imported.test(read(other)))) {
    problems.push(`${file} isn't imported by any other file. Delete it.`);
  }
}

// 2. Nothing unused: the server. A `pub` item is used if its name appears
// anywhere else in the server's code or tests.
const serverAll = [...files("server/src", [".rs"]), ...files("server/tests", [".rs"])];
const pubItem = /^\s*pub(?:\([^)]*\))?\s+(?:async\s+)?(?:const\s+|unsafe\s+)?(?:fn|struct|enum|const|static|type|trait)\s+([A-Za-z_]\w*)/gm;
for (const file of serverAll.filter((file) => file.startsWith("server/src/"))) {
  for (const match of read(file).matchAll(pubItem)) {
    const name = new RegExp(`\\b${match[1]}\\b`, "g");
    const uses = serverAll.reduce((sum, other) => sum + (read(other).match(name)?.length ?? 0), 0);
    if (uses <= 1) problems.push(`${file}: pub ${match[1]} is used nowhere. Delete it.`);
  }
}

if (problems.length > 0) {
  console.error("Tidy-code check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Tidy-code check passed (${appCode.length} files of app code, none over its limit; nothing unused).`);
