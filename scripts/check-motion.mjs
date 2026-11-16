// "No motion" (DESIGN.md): fails if any animation or transition appears in
// the built styles, or if the frontend code uses Svelte's or the browser's
// animation tools or sets motion itself. Views switch instantly. The two
// exceptions (DESIGN.md → Exceptions log): a swipe's short glide once the
// finger lets go, set only in `web/src/lib/swipeMotion.ts` (decision 0274),
// and a slow wait's breathing dots, set only in `web/src/lib/breathe.ts`
// (decision 0286); each must leave it out for a reader who asks for reduced
// motion.

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
// `node scripts/check-motion.mjs website` checks only the website, for the
// website's own part of scripts/check.sh (decision 0066).
const websiteOnly = process.argv[2] === "website";

// The website's styles and pages.
for (const file of files(join(root, "website/src"), [".css", ".html", ".njk", ".md"])) scan(file, cssRules);

if (!websiteOnly) for (const file of files(join(root, "web/dist"), [".css", ".html"])) scan(file, cssRules);

// The source: Svelte's animation helpers and the browser's animation API.
const sourceRules = [
  [/from\s+["']svelte\/(transition|animate|motion|easing)["']/g, "a Svelte animation tool"],
  [/\b(transition|in|out|animate):[a-zA-Z]/g, "a Svelte transition"],
  [/\.animate\(/g, "the browser's animation tool"],
  [/behavior:\s*["']smooth["']/g, "smooth scrolling"],
  [/\b(animate|transition)-[a-z0-9-[\]]+/g, "a Tailwind animation or transition class"],
  [/\.style\.(transition|animation)\b|\b(transition|animation)\s*:\s*[\w"'`$]|style:(transition|animation)\b|setProperty\(\s*["'`](transition|animation)/g, "motion set by a script"],
];
/** The two places allowed to move (Exceptions log): the swipe's glide, and a slow wait's breathing dots (decision 0286). */
const allowed = [join(root, "web/src/lib/swipeMotion.ts"), join(root, "web/src/lib/breathe.ts")];
for (const file of websiteOnly ? [] : allowed) {
  if (!readFileSync(file, "utf8").includes("prefers-reduced-motion: reduce")) {
    problems.push(`${relative(root, file)}: its motion must stop for a reader who asks for reduced motion`);
  }
}
for (const file of websiteOnly ? [] : files(join(root, "web/src"), [".svelte", ".ts", ".js", ".css", ".html"])) {
  if (file.endsWith(".test.ts") || allowed.includes(file)) continue;
  scan(file, sourceRules);
  // Also name the source file a built style came from, so it's easy to find.
  if (file.endsWith(".css") || file.endsWith(".svelte")) scan(file, cssRules);
}

if (problems.length > 0) {
  console.error("No-motion check failed. nine turtles never animates (but for a swipe's glide, swipeMotion.ts, and a slow wait's dots, breathe.ts):\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("No-motion check passed.");
