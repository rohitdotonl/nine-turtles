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
// 6. Spacing: a padding, margin or gap off the scale (4, 8, 12, 16, 20, 24,
//    32, 40, 48, 64px). 44px is meant only as room kept for a 44px target,
//    and 96 and 192px only as a page's room above or below: the check lets
//    them pass anywhere, and the review checks what they're used for. Sizes
//    in `em`, `vh`, `vw` or `%` follow the text or the window, so they pass.
// 7. Grey tones: the ink (or the text's own color, currentColor) mixed at
//    anything but the four tones (5% a fill, 10% a line, 20% something
//    strong, 65% an edge or underline that must reach 3 : 1), in CSS or in a
//    Tailwind value (in_srgb), or the ink faded with Tailwind's "/" (ink/10).
//
// Each exception is named, with its reason, in DESIGN.md's table and in
// EXCEPTIONS below. It matches text, not meaning: a value built in script or
// in a CSS variable's own definition isn't seen; the review looks for those.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const src = join(root, "web/src");
const problems = [];

// The four grey tones, mixed from the ink (DESIGN.md → "The system"). The main button's 88% is in EXCEPTIONS.
const TONES = ["5", "10", "20", "65"];

// Named exceptions: [file, the exact value, why]. Mirrored in DESIGN.md.
const EXCEPTIONS = [
  ["web/src/app.css", "clamp(10.5px, calc((100cqi - 8.75rem) / 14.5), 1rem)", "the welcome field's example shrinks to fit its field (SPEC section 2)"],
  ["web/src/print.css", "10pt", "paper is measured in points (decision 0236)"],
  ["web/src/lists.css", "var(--row-title-size, 1.1875rem)", "the list's titles are 19px with a mouse (decision 0128)"],
  ["web/src/lib/TextSize.svelte", "text-[0.9375rem]", "the text-size stepper's small A is a picture of small text"],
  ["web/src/lib/TextSize.svelte", "text-[1.375rem]", "the text-size stepper's large A is a picture of large text"],
  ["web/src/lib/ArticleView.svelte", "pl-14", "the article's bar keeps room for the one pane button at its left (8 + 44 + 4px)"],
  ["web/src/lib/ArticleView.svelte", "pl-[6.5rem]", "the article's bar keeps room for the two pane buttons at its left (8 + 44 + 8 + 44px)"],
  ["web/src/lib/Shell.svelte", "pr-13", "the sidebar's top line keeps room for the sidebar button (44 + 8px)"],
  ["web/src/lib/PasswordField.svelte", "pr-[4.5rem]", "the password field keeps room for its Show button"],
  ["web/src/lib/EpisodePlayer.svelte", "ml-[2px]", "the Play triangle sits 2px right of centre, so it looks centred"],
  ["web/src/lib/Logo.svelte", "mr-[9px]", "the drawn turtle sits 9px from the name, the owner's choice (BRAND.md, DESIGN.md's Exceptions log)"],
  ["web/src/lib/YouTubePlayer.svelte", "margin-left: 2px", "the Play triangle sits 2px right of centre, so it looks centred"],
  ["web/src/app.css", "88%", "the main button, a step softer than the text (decision 0045)"],
  ["web/src/lib/WhoPage.svelte", "2.375rem", "their name on their page, set as an article's title is (decision 0254, DESIGN.md's Exceptions log)"],
  ["web/src/lib/WhoPage.svelte", "2rem", "their name on their page on a phone, as an article's title (decision 0254)"],
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
const SCALE_PX = new Set([0, 4, 8, 12, 16, 20, 24, 32, 40, 44, 48, 64, 96, 192]);
const TW_SCALE = new Set(["0", "1", "2", "3", "4", "5", "6", "8", "10", "11", "12", "16", "24", "48", "px", "auto"]);
// Tailwind's spacing utilities (padding, margin, gaps, space between).
const TW_SPACE = /(?<![\w-])-?(?:px|py|pt|pr|pb|pl|ps|pe|p|mx|my|mt|mr|mb|ml|ms|me|m|gap-x|gap-y|gap|space-x|space-y|scroll-p[trblxy]?|scroll-m[trblxy]?)-([\w.[\]()-]+)(?![\w-])/g;
const CSS_SPACE = /(?<![\w-])(padding|margin|gap|row-gap|column-gap)(-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?\s*:\s*([^;}{]+)/g;
const TONE = /color-mix\(in[ _](?:srgb|oklab),[ _]*(?:var\(--(?:color-)?ink(?:-2)?\)|currentColor)[ _]([\d.]+)%/g;


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

  for (const m of text.matchAll(/text-transform\s*:\s*uppercase|(?<![\w-])uppercase(?![\w-])(?=[^"'`]*["'`])/g)) {
    say(m.index, "small capitals; a group's name is the one label (.label)");
  }

  if (file.endsWith(".svelte")) {
    for (const m of text.matchAll(/<Icon\b[^>]*?\ssize=(\{[^}]*\}|"[^"]*")/g)) {
      if (!['"alone"', '"tick"', '"picture"'].includes(m[1])) say(m.index, `an icon size not in the table (size=${m[1]}); leave it out beside a word, or use size="alone"`);
    }
  }

  for (const m of text.matchAll(TW_SPACE)) {
    // A value from a variable (the list's edges, the phone's safe area) is named elsewhere.
    const relative = /^\[(var|env|calc)\(|^\[-?[\d.]+(em|vh|vw|dvh|%)\]$/.test(m[1]);
    if (!TW_SCALE.has(m[1]) && !relative && !excepted(name, m[0].replace(/^-/, ""))) say(m.index, `a gap off the spacing scale (${m[0]})`);
  }
  for (const m of text.matchAll(CSS_SPACE)) {
    for (const token of split(m[3].replace(/\s*!important/, ""), " ")) {
      const px = lengthPx(token);
      if (px !== null && !SCALE_PX.has(px) && !excepted(name, m[0].trim())) say(m.index, `a gap off the spacing scale (${m[0].trim()})`);
    }
  }
  for (const m of text.matchAll(TONE)) {
    if (!TONES.includes(m[1]) && !excepted(name, `${m[1]}%`)) say(m.index, `a grey tone not in the table (the ink at ${m[1]}%); use var(--fill), var(--line), var(--strong) or one of the 65% edges`);
  }
  for (const m of text.matchAll(/(?<![\w-])(?:bg|border|text|ring|outline|divide|fill|stroke|decoration)-ink(?:-2)?\/\d+/g)) {
    say(m.index, `the ink faded with "/" (${m[0]}); use a named tone, such as bg-[var(--line)]`);
  }
}

if (problems.length > 0) {
  console.error("One-system check failed. Use the values in DESIGN.md → \"The system\":\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("One-system check passed.");
