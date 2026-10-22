// Download size budget (ENGINEERING.md → "Fast by design"): at most 150 KB of
// app code and styles (measured compressed, as the browser downloads them)
// and at most 400 KB of fonts.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;
const BUDGET = { code: 150 * KB, fonts: 400 * KB };
const dist = join(import.meta.dirname, "..", "web", "dist");

let code = 0;
let fonts = 0;
for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const data = readFileSync(join(entry.parentPath, entry.name));
  if (/\.(woff2?|ttf|otf)$/.test(entry.name)) {
    fonts += data.length; // Font files are already compressed.
  } else if (/\.(js|css|html|svg|json|webmanifest)$/.test(entry.name)) {
    code += gzipSync(data, { level: 9 }).length;
  }
}

const show = (bytes) => `${(bytes / KB).toFixed(1)} KB`;
console.log(`App code and styles: ${show(code)} of ${show(BUDGET.code)}`);
console.log(`Fonts:               ${show(fonts)} of ${show(BUDGET.fonts)}`);

if (code > BUDGET.code || fonts > BUDGET.fonts) {
  console.error("Size check failed: the download is over its budget.");
  process.exit(1);
}
console.log("Size check passed.");
