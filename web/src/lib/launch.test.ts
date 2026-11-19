// The home-screen app's launch screens (decision 0321): every screen size
// index.html names has a plain picture of each page in public/launch/, exactly
// that size and that page's color, and each page has its web app manifest.
import { describe, expect, it } from "vitest";
import page from "../../index.html?raw";
import white from "../../public/manifest.webmanifest?raw";
import paper from "../../public/manifest-paper.webmanifest?raw";
import night from "../../public/manifest-night.webmanifest?raw";
import { LOOKS, THEMES } from "./themes";

const pictures = import.meta.glob("../../public/launch/*/*.png", { query: "?inline", import: "default", eager: true }) as Record<string, string>;

/** A picture's size and its one color, from the data address Vite gives it. */
function read(address: string) {
  const bytes = Uint8Array.from(atob(address.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const hex = [...bytes.slice(41, 44)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { width: view.getUint32(16), height: view.getUint32(20), color: `#${hex}`, palette: String.fromCharCode(...bytes.slice(37, 41)) };
}

const links = [...page.matchAll(/<link rel="apple-touch-startup-image" href="\/launch\/white\/(\d+)x(\d+)\.png" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (portrait|landscape)\)" \/>/g)];

describe("the home-screen app's launch screens", () => {
  it("names a picture for every screen, the screen's own size", () => {
    expect(links.length).toBeGreaterThan(20);
    expect(page.match(/apple-touch-startup-image" href/g)).toHaveLength(links.length);
    for (const [, w, h, dw, dh, ratio, way] of links) {
      const [across, down] = way === "portrait" ? [dw, dh] : [dh, dw];
      expect([Number(w), Number(h)]).toEqual([Number(across) * Number(ratio), Number(down) * Number(ratio)]);
    }
  });

  it("has each page's picture for each, plain in that page's color", () => {
    for (const theme of THEMES) {
      for (const [, w, h] of links) {
        const address = pictures[`../../public/launch/${theme}/${w}x${h}.png`];
        expect(address, `${theme} ${w}x${h}`).toBeDefined();
        const picture = read(address ?? "");
        expect(picture).toEqual({ width: Number(w), height: Number(h), color: LOOKS[theme].page, palette: "PLTE" });
      }
    }
    expect(Object.keys(pictures)).toHaveLength(links.length * THEMES.length);
  });

  it("has a manifest for each page, the same app in that page's color", () => {
    const manifests = { white, paper, night };
    const plain = JSON.parse(white) as Record<string, unknown>;
    for (const theme of THEMES) {
      const manifest = JSON.parse(manifests[theme]) as Record<string, unknown>;
      const color = LOOKS[theme].page.toUpperCase();
      expect(manifest).toEqual({ ...plain, background_color: color, theme_color: color });
      expect(manifest.id).toBe("/");
    }
  });
});
