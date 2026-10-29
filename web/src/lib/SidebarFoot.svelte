<!--
  The sidebar's foot: always at the very bottom, outside the scrolling list,
  so it never moves. Add feed and Keys (the shortcut list), each an icon and
  a word, so they read as two buttons, not one phrase (decisions 0062, 0064),
  then Settings as an icon, the way a Mac app keeps its tools at the foot of
  the sidebar. In a sidebar narrowed below 15rem, Keys keeps only its icon.
-->
<script lang="ts">
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

<div class="@container flex shrink-0 items-center gap-1 border-t border-ink/10 py-1.5 pr-3">
  <!-- An action, not a place: it never shows the "where you are" bar. -->
  <a
    href="/add-feed"
    onclick={(event) => follow(event, { kind: "add-feed" })}
    class="btn-quiet ml-1.5 min-w-0 flex-1 justify-start gap-2.5 pl-[14px] text-small text-ink-2 @max-[15rem]:ml-0 @max-[15rem]:gap-1.5 @max-[15rem]:pr-1.5 @max-[15rem]:pl-1.5"><Icon name="plus" size={16} />Add feed</a
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
      class={["btn-quiet gap-2.5 px-2.5 text-small text-ink-2 @max-[15rem]:w-11 @max-[15rem]:px-0", keysOpen && "bg-ink/10 text-ink"]}
      ><Icon name="keyboard" size={16} /><span class="@max-[15rem]:hidden">Keys</span></button
    >
  {/if}
  <a
    href="/settings"
    aria-label="Settings"
    title="Settings"
    aria-current={inSettings(route) ? "page" : undefined}
    onclick={(event) => follow(event, { kind: "settings" })}
    class={["btn-quiet btn-icon @max-[15rem]:-mr-1.5", inSettings(route) && "bg-tint-sidebar text-ink"]}><Icon name="settings" size={18} /></a
  >
</div>
