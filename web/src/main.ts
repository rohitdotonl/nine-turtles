import "./app.css";
import "./tops.css";
import "./lists.css";
import "./article-lists.css";
import "./article-text.css";
import "./arranging.css";
import "./reading-column.css";
import "./scripts.css";
import "./pressed.css";
import "./print.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { apply, load } from "./lib/preferences";
import { listenForInstall } from "./lib/installing.svelte";

const target = document.getElementById("app");
if (!target) throw new Error("nine turtles: the #app element is missing from index.html");

// The reader's theme and reading settings for this device, before anything is drawn.
apply(load());
mount(App, { target });

// Keeps the browser's offer to install nine turtles for Settings › Install the app on any device.
listenForInstall();

// Whether the reader is using the keyboard right now, so a row the app moves
// the keyboard back to is outlined after a key press but not after a click
// (app.css).
addEventListener("keydown", () => (document.documentElement.dataset.keyboard = ""), true);
addEventListener("pointerdown", () => delete document.documentElement.dataset.keyboard, true);
// Safari on iPhone draws a press (:active, pressed.css) only once the page listens for touches.
addEventListener("touchstart", () => {}, { passive: true });

// Lets nine turtles be added to the home screen and open without a connection
// (public/sw.js). It keeps only the app itself and its fonts; articles kept for
// reading offline are in the app's own database (lib/offline.ts).
if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Without it nine turtles works the same; it just can't open offline.
    });
  });
}
