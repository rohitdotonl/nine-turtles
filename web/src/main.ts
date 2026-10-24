import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { apply, load } from "./lib/preferences";

const target = document.getElementById("app");
if (!target) throw new Error("nine turtles: the #app element is missing from index.html");

// The reader's theme and reading settings for this device, before anything is drawn.
apply(load());
mount(App, { target });

// Whether the reader is using the keyboard right now, so a title the app
// moves the keyboard to is outlined after a key press but not on first load
// or after a click (app.css).
addEventListener("keydown", () => (document.documentElement.dataset.keyboard = ""), true);
addEventListener("pointerdown", () => delete document.documentElement.dataset.keyboard, true);

// Lets nine turtles be added to the home screen and open without a connection
// (public/sw.js). It keeps only the app itself, never your articles.
if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Without it nine turtles works the same; it just can't open offline.
    });
  });
}
