import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

// Node's file functions, typed here because Node's own type definitions aren't among the approved libraries.
type Files = { readFileSync(path: string, encoding: "utf8"): string; writeFileSync(path: string, text: string): void };
const node = globalThis as unknown as { process: { getBuiltinModule(name: "node:fs"): Files } };

// Files in public/ are copied as they are, so their notes for the next agent
// would count against the download budget (scripts/check-size.mjs). The built
// copies drop them, and the source keeps them: the service worker loses its
// one-line comments, blank lines and indents (it has no multi-line strings or
// comments, so that is safe), the page its comments and line breaks, the web
// app manifest its spaces and the icon its line breaks.
function trimPublicFiles(): Plugin {
  let dist = "dist";
  return {
    name: "trim-public-files",
    apply: "build",
    configResolved(config) {
      dist = config.build.outDir;
    },
    transformIndexHtml(html) {
      return html.replace(/<!--[\s\S]*?-->/g, "").replace(/\n\s*/g, "").replaceAll(" />", ">");
    },
    closeBundle() {
      const { readFileSync, writeFileSync } = node.process.getBuiltinModule("node:fs");
      const file = `${dist}/sw.js`;
      const lines = readFileSync(file, "utf8").split("\n");
      const kept = lines
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("//") && !(line.startsWith("/*") && line.endsWith("*/")));
      writeFileSync(file, kept.join("\n") + "\n");
      const icon = `${dist}/icons/icon.svg`;
      writeFileSync(icon, readFileSync(icon, "utf8").replace(/\n/g, ""));
      const manifest = `${dist}/manifest.webmanifest`;
      writeFileSync(manifest, JSON.stringify(JSON.parse(readFileSync(manifest, "utf8"))));
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), svelte(), trimPublicFiles()],
  build: {
    // The built files are packed into the Rust program (see server/src/assets.rs).
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Lets tests read app.css as text (the contrast test); nothing is styled.
    css: true,
  },
});
