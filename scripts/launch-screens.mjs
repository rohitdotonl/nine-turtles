// Makes the launch screens an iPhone or iPad shows while nine turtles opens
// from the home screen (decision 0321): one plain picture of each page (White,
// Paper, Night) for every screen size, since iOS shows a picture only if it is
// exactly the screen's size, and white when there is none. Writes them into
// web/public/launch/<page>/ and prints the <link> tags for web/index.html.
// Run it again only when Apple ships a new screen size: node scripts/launch-screens.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

/** Each page's color, as in web/src/lib/themes.ts (launch.test.ts checks). */
const PAGES = { white: "#ffffff", paper: "#f7f3ea", night: "#121212" };

/** Screens in points (portrait) and their pixels per point. iPads open either way up; iPhones upright. */
export const SCREENS = [
  // iPhones
  [440, 956, 3], [420, 912, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
  // iPads
  [1032, 1376, 2], [1024, 1366, 2], [834, 1210, 2], [834, 1194, 2], [820, 1180, 2], [834, 1112, 2],
  [810, 1080, 2], [744, 1133, 2], [768, 1024, 2],
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
/** A one-color picture: a one-entry palette, so each row is a few bytes before packing. */
function png(width, height, hex) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 1; // one bit per pixel
  header[9] = 3; // colors from the palette
  const palette = Buffer.from(hex.slice(1), "hex");
  const row = 1 + Math.ceil(width / 8);
  const pixels = Buffer.alloc(row * height); // filter 0, color 0, every row
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("PLTE", palette),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL("../web/public/launch/", import.meta.url);
  const links = [];
  for (const [w, h, ratio] of SCREENS) {
    const ways = w >= 744 ? ["portrait", "landscape"] : ["portrait"];
    for (const way of ways) {
      const [pw, ph] = way === "portrait" ? [w * ratio, h * ratio] : [h * ratio, w * ratio];
      for (const [page, hex] of Object.entries(PAGES)) {
        mkdirSync(new URL(`${page}/`, root), { recursive: true });
        writeFileSync(new URL(`${page}/${pw}x${ph}.png`, root), png(pw, ph, hex));
      }
      links.push(
        `    <link rel="apple-touch-startup-image" href="/launch/white/${pw}x${ph}.png" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${way})" />`,
      );
    }
  }
  console.log(links.join("\n"));
}
