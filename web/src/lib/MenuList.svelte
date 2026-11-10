<!--
  A menu's list of choices (SPEC sections 6, 7 and 6's row menu): rows of
  buttons in groups, each row with its key at its end when it has one, a
  one-of-several choice ticked so it shows without color. The arrow keys,
  Home and End move between rows; Escape closes it and gives the keyboard
  back to whatever opened it; Tab closes it too. `MoreMenu.svelte` opens it
  from a More (…) button, `RowMenu.svelte` from a row in the article list.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { keyCap } from "./keyboard";
  import type { MenuGroup, MenuItem } from "./MoreMenu.svelte";

  let {
    id,
    label,
    groups,
    place,
    at,
    onClose,
  }: {
    id: string;
    label: string;
    groups: MenuGroup[];
    /** Where it sits: classes placing it beside its button. */
    place?: string;
    /** Or a point on the screen (a row's menu opens where it was pressed). */
    at?: { x: number; y: number };
    /** Closed by a choice or Escape (`giveBack`: the keyboard goes back to what opened it), or by Tab. */
    onClose: (giveBack: boolean) => void;
  } = $props();

  let menu: HTMLDivElement | undefined = $state();

  function items(): HTMLButtonElement[] {
    return [...(menu?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']") ?? [])];
  }

  /** Puts the keyboard on the first or last row. */
  export async function focus(which: "first" | "last" = "first") {
    await tick();
    const all = items();
    (which === "first" ? all[0] : all.at(-1))?.focus();
  }

  /** Whether a press landed inside the menu. */
  export function holds(target: Node): boolean {
    return menu?.contains(target) ?? false;
  }

  function choose(item: MenuItem) {
    onClose(true);
    item.onSelect();
  }

  function onMenuKey(event: KeyboardEvent) {
    const all = items();
    const now = all.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    switch (event.key) {
      case "Escape":
        // Handled here, so the app's own Escape (back to the list) waits for the next press.
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
        return;
      case "Tab":
        onClose(false);
        return;
      case "ArrowDown":
        next = (now + 1) % all.length;
        break;
      case "ArrowUp":
        next = (now - 1 + all.length) % all.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = all.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    all[next]?.focus();
  }
</script>

  <!-- svelte-ignore a11y_interactive_supports_focus: the items inside take the keyboard, not the menu itself. -->
  <div
    {id}
    role="menu"
    aria-label={label}
    tabindex="-1"
    bind:this={menu}
    onkeydown={onMenuKey}
    style:left={at ? `${at.x}px` : undefined}
    style:top={at ? `${at.y}px` : undefined}
    class={["z-30 w-max max-w-[min(18rem,calc(100vw-2rem))] min-w-56 floating p-1.5 text-left font-sans", at ? "fixed" : ["absolute", place]]}
  >
    {#each groups as group, index (index)}
      {#if index > 0}
        <div role="separator" class="mx-2 my-1.5 h-px bg-ink/10"></div>
      {/if}
      <div role="group" aria-label={group.label}>
        {#if group.label}
          <p aria-hidden="true" class="flex items-center gap-1.5 px-3 pt-1.5 pb-1 text-meta text-muted">{#if group.icon}<Icon name={group.icon} />{/if}{group.label}</p>
        {/if}
        {#each group.items as item (item.label)}
          <button
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={item.checked}
            aria-keyshortcuts={item.shortcut}
            tabindex="-1"
            onclick={() => choose(item)}
            class={["menu-item", item.checked && "font-semibold"]}
          >
            {#if item.checked !== undefined}
              <!-- The tick shows the current choice without color; the weight says it too. -->
              <span class="flex w-5 shrink-0 justify-center">{#if item.checked}<Icon name="check" />{/if}</span>
            {/if}
            <span class="min-w-0 flex-1">{item.label}</span>
            {#if item.shortcut}
              <!-- Printed the same on every computer (Shift A, M); screen readers hear the key from aria-keyshortcuts instead (decision 0180). -->
              <kbd aria-hidden="true" class="text-meta text-muted">{keyCap(item.shortcut)}</kbd>
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>

<style>
  .menu-item {
    display: flex;
    width: 100%;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.75rem;
    border-radius: var(--radius-press);
    color: var(--ink);
    font-size: var(--text-ui);
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }
  @media (hover: hover) {
    .menu-item:hover {
      background-color: var(--hover);
    }
  }
  .menu-item:focus-visible {
    outline-offset: -2px;
  }
</style>
