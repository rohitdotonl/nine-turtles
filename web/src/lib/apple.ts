// Whether nine turtles runs on an Apple device (a Mac, iPhone or iPad; an
// iPad reports itself as a Mac). Such a device names the Command key rather
// than Ctrl (keyboard.ts), and has its own share icon, a box with an arrow,
// where every other device has three linked dots (Icon.svelte, decision 0292).
export const onApple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
