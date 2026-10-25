// "No motion" (DESIGN.md): fails if any animation or transition appears in
// the built styles, or if the frontend code uses Svelte's or the browser's
// animation tools. Views switch instantly.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const problems = [];

function files(dir, extensions) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => join(entry.parentPath, entry.name));
}

function scan(file, rules) {
  const text = readFileSync(file, "utf8");
  for (const [pattern, what] of rules) {
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      problems.push(`${relative(root, file)} line ${line}: ${what} (${match[0].trim()})`);
    }
  }
}

// The built styles: what the browser actually receives.
const cssRules = [
  [/@(-webkit-)?keyframes\b/g, "an animation"],
  [/(?<![\w-])(-webkit-)?(animation|transition)(-[a-z-]+)?\s*:/g, "an animation or transition"],
  [/scroll-behavior\s*:\s*smooth/g, "smooth scrolling"],
];
for (const file of files(join(root, "web/dist"), [".css", ".html"])) scan(file, cssRules);
// The website's styles and pages (decision 0066).
for (const file of files(join(root, "website/src"), [".css", ".html", ".njk", ".md"])) scan(file, cssRules);

// The source: Svelte's animation helpers and the browser's animation API.
const sourceRules = [
  [/from\s+["']svelte\/(transition|animate|motion|easing)["']/g, "a Svelte animation tool"],
  [/\b(transition|in|out|animate):[a-zA-Z]/g, "a Svelte transition"],
  [/\.animate\(/g, "the browser's animation tool"],
  [/behavior:\s*["']smooth["']/g, "smooth scrolling"],
  [/\b(animate|transition)-[a-z0-9-[\]]+/g, "a Tailwind animation or transition class"],
];
for (const file of files(join(root, "web/src"), [".svelte", ".ts", ".js", ".css", ".html"])) {
  if (file.endsWith(".test.ts")) continue;
  scan(file, sourceRules);
  // Also name the source file a built style came from, so it's easy to find.
  if (file.endsWith(".css") || file.endsWith(".svelte")) scan(file, cssRules);
}

if (problems.length > 0) {
  console.error("No-motion check failed. nine turtles never animates:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("No-motion check passed.");
