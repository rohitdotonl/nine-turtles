<!--
  The handle on a pane's right edge that changes its width (on a computer):
  drag it with the mouse, or, with the keyboard on it, press the left and
  right arrows. A double click puts the pane back to its usual width. It sits
  over the pane's 1px edge line, 9px wide so it's easy to catch, and shows a
  slightly darker line while it's under the pointer, being dragged or holding
  the keyboard. Nothing animates.
-->
<script lang="ts">
  let {
    label,
    width = $bindable(),
    min,
    max,
    pane,
    onDone,
  }: {
    /** What screen readers hear, such as "Resize the sidebar". */
    label: string;
    /** The pane's width in pixels, or undefined for its usual width. */
    width: number | undefined;
    min: number;
    max: number;
    /** The pane this handle resizes, to read its width when a drag starts. */
    pane: HTMLElement | undefined;
    /** Called when a drag or key press ends, to remember the width. */
    onDone: () => void;
  } = $props();

  let dragging = $state(false);
  let startX = 0;
  let startWidth = 0;

  const clamp = (value: number) => Math.round(Math.min(max, Math.max(min, value)));
  let now = $derived(width ?? pane?.offsetWidth ?? min);

  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = true;
    startX = event.clientX;
    startWidth = pane?.offsetWidth ?? now;
  }

  function moved(event: PointerEvent) {
    if (dragging) width = clamp(startWidth + event.clientX - startX);
  }

  function up() {
    if (!dragging) return;
    dragging = false;
    onDone();
  }

  function key(event: KeyboardEvent) {
    const step = event.shiftKey ? 64 : 16;
    if (event.key === "ArrowLeft") width = clamp(now - step);
    else if (event.key === "ArrowRight") width = clamp(now + step);
    else return;
    event.preventDefault();
    event.stopPropagation();
    onDone();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={now}
  aria-valuemin={min}
  aria-valuemax={max}
  title="Drag to resize. Double-click for the usual width."
  tabindex="0"
  class={["pane-resizer", dragging && "dragging"]}
  onpointerdown={down}
  onpointermove={moved}
  onpointerup={up}
  onpointercancel={up}
  ondblclick={() => {
    width = undefined;
    onDone();
  }}
  onkeydown={key}
></div>

<style>
  .pane-resizer {
    position: absolute;
    top: 0;
    right: -5px;
    bottom: 0;
    z-index: 30;
    width: 9px;
    cursor: col-resize;
    touch-action: none;
  }
  .pane-resizer::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 4px;
    width: 1px;
  }
  .pane-resizer:hover::after,
  .pane-resizer.dragging::after,
  .pane-resizer:focus-visible::after {
    left: 3px;
    width: 3px;
    background: color-mix(in srgb, var(--ink) 22%, transparent);
  }
  .pane-resizer:focus-visible {
    outline: none;
  }
  .pane-resizer:focus-visible::after {
    background: var(--ink);
    opacity: 0.7;
  }
</style>
