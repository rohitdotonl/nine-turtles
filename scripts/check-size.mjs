// Download size budget (ENGINEERING.md → "Fast by design"): at most 200 KB of
// app code and styles (measured compressed, as the browser downloads them)
// and at most 400 KB of the fonts every reader may download. A reading face
// for another script (decision 0227) is downloaded only by readers of that
// script, so each has its own budget: at most 150 KB.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;
const BUDGET = { code: 200 * KB, fonts: 400 * KB, script: 150 * KB };
// The other scripts' reading faces, by their files' names (web/src/fonts.css).
const SCRIPT_FONT = /^noto-/;
const dist = join(import.meta.dirname, "..", "web", "dist");

let code = 0;
let fonts = 0;
const scriptFonts = [];
for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const data = readFileSync(join(entry.parentPath, entry.name));
  if (/\.(woff2?|ttf|otf)$/.test(entry.name) && SCRIPT_FONT.test(entry.name)) {
    scriptFonts.push([entry.name, data.length]);
  } else if (/\.(woff2?|ttf|otf)$/.test(entry.name)) {
    fonts += data.length; // Font files are already compressed.
  } else if (/\.(js|css|html|svg|json|webmanifest)$/.test(entry.name)) {
    code += gzipSync(data, { level: 9 }).length;
  }
}

const show = (bytes) => `${(bytes / KB).toFixed(1)} KB`;
console.log(`App code and styles: ${show(code)} of ${show(BUDGET.code)}`);
console.log(`Fonts:               ${show(fonts)} of ${show(BUDGET.fonts)}`);
for (const [name, bytes] of scriptFonts) console.log(`${name}: ${show(bytes)} of ${show(BUDGET.script)}`);

if (code > BUDGET.code || fonts > BUDGET.fonts || scriptFonts.some(([, bytes]) => bytes > BUDGET.script)) {
  console.error("Size check failed: the download is over its budget.");
  process.exit(1);
}
console.log("Size check passed.");
