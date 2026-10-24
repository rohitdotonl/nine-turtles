<!--
  A small menu behind a "More" (…) button (SPEC sections 6 and 7): the
  list's less frequent actions (Mark all as read, Refresh, the sort order,
  Edit), and the article's (Copy link or Share, Mark unread), kept out of
  sight until asked for (DESIGN.md → "Power is hidden, never missing").

  The button says it opens a menu (`aria-haspopup`); the menu is a short list
  of buttons. Opening it puts the keyboard on the first item; the arrow keys,
  Home and End move between items; Escape closes it and goes back to the
  button; Tab, or a press anywhere outside, closes it too. A choice that is
  one of several (the sort order) is ticked, so it shows without color.
-->
<script lang="ts" module>
  export type MenuItem = {
    label: string;
    onSelect: () => void;
    /** For one-of-several choices: whether this one is the current one. */
    checked?: boolean;
    /** The key that does the same, shown at the end of the row (e.g. "Shift+A"). */
    shortcut?: string;
  };
  export type MenuGroup = { label?: string; icon?: IconName; items: MenuItem[] };
</script>

<script lang="ts">
  import { tick } from "svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import { keyCap } from "./keyboard";

  let {
    id,
    label = "More",
    groups,
    size = 20,
    up = false,
  }: {
    id: string;
    label?: string;
    groups: MenuGroup[];
    /** The icon's size: 22 in the phone's bottom bar. */
    size?: number;
    /** Opens upwards, from a bar at the bottom of the screen. */
    up?: boolean;
  } = $props();

  let open = $state(false);
  let wrap: HTMLDivElement | undefined = $state();
  let button: HTMLButtonElement | undefined = $state();
  let menu: HTMLDivElement | undefined = $state();

  function items(): HTMLButtonElement[] {
    return [...(menu?.querySelectorAll<HTMLButtonElement>("[role^='menuitem']") ?? [])];
  }

  async function show(at: "first" | "last" = "first") {
    open = true;
    await tick();
    const all = items();
    (at === "first" ? all[0] : all.at(-1))?.focus();
  }

  function close(giveBack: boolean) {
    open = false;
    if (giveBack) button?.focus();
  }

  function choose(item: MenuItem) {
    close(true);
    item.onSelect();
  }

  function onButtonKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show(event.key === "ArrowDown" ? "first" : "last");
    }
  }

  function onMenuKey(event: KeyboardEvent) {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    switch (event.key) {
      case "Escape":
        // Handled here, so the app's own Escape (back to the list) waits for the next press.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
      case "ArrowDown":
        next = (at + 1) % all.length;
        break;
      case "ArrowUp":
        next = (at - 1 + all.length) % all.length;
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

<svelte:window
  onpointerdown={(event) => {
    // A press anywhere outside closes the menu, as menus do.
    if (open && !wrap?.contains(event.target as Node)) close(false);
  }}
/>

<div class="relative shrink-0" bind:this={wrap}>
  <button
    type="button"
    bind:this={button}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? id : undefined}
    aria-label={label}
    title={label}
    onclick={() => (open ? close(false) : show())}
    onkeydown={onButtonKey}
    class={["btn-quiet btn-icon", open && "text-ink"]}
  >
    <!-- Open, the icon sits on a small rounded tone, like a pressed toolbar button. -->
    <span class={["flex size-8 items-center justify-center rounded-md", open && "bg-[var(--tone)]"]}><Icon name="more" {size} /></span>
  </button>
  {#if open}
    <!-- svelte-ignore a11y_interactive_supports_focus: the items inside take the keyboard, not the menu itself. -->
    <div
      {id}
      role="menu"
      aria-label={label}
      tabindex="-1"
      bind:this={menu}
      onkeydown={onMenuKey}
      class={[
        "absolute right-0 z-30 w-max max-w-[min(18rem,calc(100vw-2rem))] min-w-56 floating p-1.5 text-left font-sans",
        up ? "bottom-full mb-1" : "top-full mt-1",
      ]}
    >
      {#each groups as group, index (index)}
        {#if index > 0}
          <div role="separator" class="mx-2 my-1.5 h-px bg-ink/10"></div>
        {/if}
        <div role="group" aria-label={group.label}>
          {#if group.label}
            <p aria-hidden="true" class="flex items-center gap-1.5 px-3 pt-1.5 pb-1 text-meta text-muted">{#if group.icon}<Icon name={group.icon} size={14} />{/if}{group.label}</p>
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
                <span class="flex w-5 shrink-0 justify-center">{#if item.checked}<Icon name="check" size={16} />{/if}</span>
              {/if}
              <span class="min-w-0 flex-1">{item.label}</span>
              {#if item.shortcut}
                <!-- Printed as a Mac prints it (⇧A, M); screen readers hear the key from aria-keyshortcuts instead (decision 0055). -->
                <kbd aria-hidden="true" class="text-meta text-muted">{keyCap(item.shortcut).cap}</kbd>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu-item {
    display: flex;
    width: 100%;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.75rem;
    border-radius: 0.5rem;
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
