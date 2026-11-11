<!--
  The sidebar's foot: always at the very bottom, outside the scrolling list,
  so it never moves. "+ Add" (screen readers hear "Add a person or
  publication", decision 0163) and Keys (the shortcut list), each an icon and
  a word, so they read as two buttons, not one phrase (decisions 0062, 0064),
  then Settings as an icon, the way a Mac app keeps its tools at the foot of
  the sidebar. In a sidebar narrowed below 15rem, Keys keeps only its icon.

  While a person or publication is held (decision 0248), the foot shows two
  places to drop them instead: Pause and, in the oxblood words, Unsubscribe,
  as words alone (no icon of their own: one icon, one meaning, BRAND.md).
  They're for the pointer only (sidebarDrag.ts reads `data-drop-act`); the
  keyboard and screen readers have the same on their page.
-->
<script lang="ts">
  import { tip } from "./keyboard";
  import Icon from "./Icon.svelte";
  import { inSettings, type Route } from "./router";

  let {
    route,
    follow,
    phone,
    keysOpen = $bindable(),
  }: {
    route: Route;
    follow: (event: MouseEvent, next: Route) => void;
    /** A phone has no keyboard shortcuts, so no Keys button. */
    phone: boolean;
    /** Whether the shortcut list is open; Keys opens it. */
    keysOpen: boolean;
  } = $props();
</script>

<div class="sidebar-foot @container flex shrink-0 items-center gap-1 border-t border-[var(--line)] py-2 pr-3">
  <div class="drop-acts ml-2 flex-1 gap-2" aria-hidden="true">
    <span data-drop-act="pause" class="drop-act text-ink-2">Pause</span>
    <span data-drop-act="unsubscribe" class="drop-act text-danger">Unsubscribe</span>
  </div>
  <!-- An action, not a place: it never shows the "where you are" bar. -->
  <a
    href="/add"
    aria-label="Add a person or publication"
    title={tip("Add a person or publication", "add-feed")}
    onclick={(event) => follow(event, { kind: "add-feed" })}
    class="btn-quiet ml-2 min-w-0 flex-1 justify-start gap-3 pl-3 text-meta text-ink-2 @max-[15rem]:ml-0 @max-[15rem]:gap-2 @max-[15rem]:pr-2 @max-[15rem]:pl-2"><Icon name="plus" />Add</a
  >
  {#if !phone}
    <!-- Filled in a neutral ink tone while the shortcut list is open (never the accent: this is a button, not a place), and it says it opens a dialog (decision 0054). -->
    <button
      type="button"
      onclick={() => (keysOpen = true)}
      aria-label="Keys (keyboard shortcuts)"
      title="Keyboard shortcuts (?)"
      aria-haspopup="dialog"
      aria-expanded={keysOpen}
      class={["btn-quiet gap-3 px-3 text-meta text-ink-2 @max-[15rem]:w-11 @max-[15rem]:px-0", keysOpen && "bg-[var(--line)] text-ink"]}
      ><Icon name="keyboard" /><span class="@max-[15rem]:hidden">Keys</span></button
    >
  {/if}
  <a
    href="/settings"
    aria-label="Settings"
    title="Settings"
    aria-current={inSettings(route) ? "page" : undefined}
    onclick={(event) => follow(event, { kind: "settings" })}
    class={["btn-quiet btn-icon @max-[15rem]:-mr-2", inSettings(route) && "bg-tint-sidebar text-ink"]}><Icon name="settings" size="alone" /></a
  >
</div>
