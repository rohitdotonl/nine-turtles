import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { apply, load } from "./lib/preferences";

const target = document.getElementById("app");
if (!target) throw new Error("slowfeed: the #app element is missing from index.html");

// The reader's theme and reading settings for this device, before anything is drawn.
apply(load());
mount(App, { target });
