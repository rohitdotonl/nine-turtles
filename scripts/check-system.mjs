// "One system" (DESIGN.md → "The system", decision 0244): the app's styles use
// only the values in that table, so the same thing always looks the same and
// nothing drifts screen by screen. It reads the web app's own styles and
// components (web/src) and fails on:
//
// 1. Corners: a rounding other than 8px (what you press or type in), 12px
//    (what holds things), 4px (a small mark inside them) or round.
// 2. Shadows: any shadow other than the one for things that float (and the
//    small lift under a segmented control's chosen side). Rings drawn with a
//    shadow and inset lines are lines, not shadows, so they pass.
// 3. Text sizes: a size that isn't one of the named ones. Sizes in `em`
//    follow the reader's own text size (Aa), so they pass.
// 4. Labels: small spaced capitals; a group's name is the one label (.label).
// 5. Icons: an icon size other than "word" (16px) or "alone" (20px), and the
//    two named exceptions.
// 6. Spacing and grey tones: older values off the spacing scale, and tones
//    mixed from the ink, are counted. No new one may appear: the counts below
//    may only go down, and must be lowered in the same change that lowers them.
//
// Each exception is named, with its reason, in DESIGN.md's table and in
// EXCEPTIONS below. It matches text, not meaning: a value built in script or
// in a CSS variable's own definition isn't seen; the review looks for those.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const src = join(root, "web/src");
const problems = [];

// Older spacing values off the scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64px), counted
// across the app. Lower this when you move some onto the scale; never raise it.
const SPACING_LEFT = 193;
// The ink tones in use today (the text color mixed at these percentages). No
// new one may be added; when one goes, take it off this list.
const TONES = ["3", "5", "6", "7", "8", "9", "10", "11", "12", "14", "15", "16", "18", "22", "25", "30", "45", "55", "60", "65", "88", "96"];

// Named exceptions: [file, the exact value, why]. Mirrored in DESIGN.md.
const EXCEPTIONS = [
  ["web/src/app.css", "clamp(10.5px, calc((100cqi - 8.75rem) / 14.5), 1rem)", "the welcome field's example shrinks to fit its field (SPEC section 2)"],
  ["web/src/print.css", "10pt", "paper is measured in points (decision 0236)"],
  ["web/src/lists.css", "var(--row-title-size, 1.1875rem)", "the list's titles are 19px with a mouse (decision 0128)"],
  ["web/src/lib/TextSize.svelte", "text-[0.9375rem]", "the text-size stepper's small A is a picture of small text"],
  ["web/src/lib/TextSize.svelte", "text-[1.375rem]", "the text-size stepper's large A is a picture of large text"],
];
const excepted = (file, value) => EXCEPTIONS.some(([f, v]) => f === file && v === value);

function files(dir, extensions) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !file.endsWith(".test.ts"));
}

// Comments say what was, and why; only the code itself is held to the table.
const uncomment = (text) =>
  text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, " "));

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

// Splits a value at its top-level commas or spaces, keeping var(…) and calc(…) whole.
function split(value, separator) {
  const parts = [];
  let depth = 0;
  let part = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && (separator === " " ? /\s/.test(ch) : ch === separator)) {
      if (part.trim()) parts.push(part.trim());
      part = "";
    } else part += ch;
  }
  if (part.trim()) parts.push(part.trim());
  return parts;
}

const CORNERS = new Set(["var(--radius-press)", "var(--radius-hold)", "var(--radius-mark)", "999px", "9999px", "50%", "0", "inherit"]);
const ROUNDED = /(?<![\w-])rounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?(?:-([\w.[\]%()-]+))?(?![\w-])/g;
const ROUNDED_OK = new Set(["press", "hold", "mark", "full", "none"]);
const TEXT_OK = /^(var\(--text-[a-z-]+\)|var\(--reading-size\)|calc\(var\(--reading-size\)[^;]*\)|[\d.]+em|inherit|100%)$/;
const SCALE_PX = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
const TW_SCALE = new Set(["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16", "px", "auto"]);
// Tailwind's spacing utilities (padding, margin, gaps, space between).
const TW_SPACE = /(?<![\w-])-?(?:px|py|pt|pr|pb|pl|ps|pe|p|mx|my|mt|mr|mb|ml|ms|me|m|gap-x|gap-y|gap|space-x|space-y|scroll-p[trblxy]?|scroll-m[trblxy]?)-([\w.[\]()-]+)(?![\w-])/g;
const CSS_SPACE = /(?<![\w-])(padding|margin|gap|row-gap|column-gap)(-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?\s*:\s*([^;}{]+)/g;
const TONE = /color-mix\(in srgb, var\(--(?:color-)?ink\) ([\d.]+)%/g;

let spacing = 0;
const spacingAt = [];
const tones = new Map();

function lengthPx(token) {
  const m = token.match(/^(-?[\d.]+)(px|rem)$/);
  if (!m) return null;
  return Math.abs(parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1));
}

for (const file of files(src, [".svelte", ".css", ".ts"])) {
  const name = relative(root, file);
  const text = uncomment(readFileSync(file, "utf8"));
  const say = (index, what) => problems.push(`${name} line ${lineOf(text, index)}: ${what}`);

  for (const m of text.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}{]+)/g)) {
    const value = m[1].replace(/\s*!important/, "").trim();
    if (!split(value, " ").every((part) => CORNERS.has(part))) say(m.index, `a corner not in the table (${value})`);
  }
  for (const m of text.matchAll(ROUNDED)) {
    if (!m[1] || !ROUNDED_OK.has(m[1])) say(m.index, `a corner not in the table (${m[0]}); use rounded-press, rounded-hold, rounded-mark or rounded-full`);
  }

  for (const m of text.matchAll(/box-shadow\s*:\s*([^;}{]+)/g)) {
    const value = m[1].replace(/\s*!important/, "").trim();
    const fine = split(value, ",").every((part) => part === "none" || part === "var(--shadow-float)" || part.startsWith("var(--raised-shadow") || part.startsWith("inset ") || /^0 0 0 /.test(part));
    if (!fine) say(m.index, `a shadow not in the table (${value}); things that float use var(--shadow-float)`);
  }
  for (const m of text.matchAll(/(?<![\w-])(?:drop-|inset-)?shadow-(2xs|xs|sm|md|lg|xl|2xl|inner|\[[^\]]*\])(?![\w-])/g)) {
    say(m.index, `a shadow not in the table (${m[0]}); things that float use shadow-float`);
  }
  if (/drop-shadow\(/.test(text)) say(text.indexOf("drop-shadow("), "a drop shadow; things that float use var(--shadow-float)");

  for (const m of text.matchAll(/font-size\s*:\s*([^;}{]+)/g)) {
    const value = m[1].replace(/\s*!important/, "").trim();
    if (!TEXT_OK.test(value) && !excepted(name, value)) say(m.index, `a text size not in the table (${value})`);
  }
  for (const m of text.matchAll(/(?<![\w-])text-\[([^\]]+)\]/g)) {
    if (m[1].startsWith("color:") || m[1].startsWith("var(--color")) continue;
    if (!excepted(name, m[0])) say(m.index, `a text size not in the table (${m[0]})`);
  }

  for (const m of text.matchAll(/text-transform\s*:\s*uppercase|(?<![\w-:])uppercase(?![\w-])(?=[^"'`]*["'`])/g)) {
    say(m.index, "small capitals; a group's name is the one label (.label)");
  }

  if (file.endsWith(".svelte")) {
    for (const m of text.matchAll(/<Icon\b[^>]*?\ssize=(\{[^}]*\}|"[^"]*")/g)) {
      if (!['"alone"', '"tick"', '"picture"'].includes(m[1])) say(m.index, `an icon size not in the table (size=${m[1]}); leave it out beside a word, or use size="alone"`);
    }
  }

  for (const m of text.matchAll(TW_SPACE)) {
    // A value from a variable (the list's edges, the phone's safe area) is named elsewhere.
    if (!TW_SCALE.has(m[1]) && !/^\[(var|env|calc)\(/.test(m[1])) {
      spacing++;
      spacingAt.push(`${name} line ${lineOf(text, m.index)}: ${m[0]}`);
    }
  }
  for (const m of text.matchAll(CSS_SPACE)) {
    for (const token of split(m[3].replace(/\s*!important/, ""), " ")) {
      const px = lengthPx(token);
      if (px !== null && !SCALE_PX.has(px)) {
        spacing++;
        spacingAt.push(`${name} line ${lineOf(text, m.index)}: ${m[0].trim()}`);
      }
    }
  }
  for (const m of text.matchAll(TONE)) {
    const tone = m[1];
    if (!tones.has(tone)) tones.set(tone, `${name} line ${lineOf(text, m.index)}`);
  }
}

if (process.argv[2] === "count") {
  console.log(`spacing off the scale: ${spacing}`);
  console.log(`ink tones: ${[...tones.keys()].sort((a, b) => a - b).join(", ")} (${tones.size})`);
  if (process.argv[3] === "spacing") console.log(spacingAt.join("\n"));
  process.exit(0);
}

if (spacing > SPACING_LEFT) {
  problems.push(`${spacing - SPACING_LEFT} new spacing value(s) off the scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 64px). Run \`node scripts/check-system.mjs count spacing\` to list them all.`);
} else if (spacing < SPACING_LEFT) {
  problems.push(`Good: spacing off the scale is down to ${spacing}. Lower SPACING_LEFT in scripts/check-system.mjs to ${spacing}, so it can't creep back.`);
}
for (const [tone, at] of tones) {
  if (!TONES.includes(tone)) problems.push(`${at}: a new grey tone (the ink at ${tone}%); use one already in the table`);
}
for (const tone of TONES) {
  if (!tones.has(tone)) problems.push(`Good: the ink at ${tone}% is no longer used. Take it off TONES in scripts/check-system.mjs.`);
}

if (problems.length > 0) {
  console.error("One-system check failed. Use the values in DESIGN.md → \"The system\":\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("One-system check passed.");
