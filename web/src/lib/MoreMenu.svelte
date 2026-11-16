<!--
  A small menu behind a "More" (…) button (SPEC sections 6 and 7): the
  list's less frequent actions (Mark all as read, Refresh, the sort order,
  Edit), and the article's (Copy link or Share, Mark unread), kept out of
  sight until asked for (DESIGN.md → "Power is hidden, never missing").

  The button says it opens a menu (`aria-haspopup`); the menu is a short list
  of buttons. Opening it puts the keyboard on the first item; the arrow keys,
  Home and End move between items; Escape closes it and goes back to the
  button; Tab, or a press anywhere outside, closes it too. A menu that opens
  upwards, from the phone's bottom bar, reads from the button outwards: its
  first item sits nearest the button and finger, so its rows (and groups)
  are drawn in reverse, and opening it puts the keyboard on that nearest
  one (decision 0243). A menu that would open downwards past the edge of
  what's showing (the end of an article, above the phone's bottom bar) opens
  upwards instead, the same way, when there's more room above. A choice that is
  one of several (the sort order) is ticked, so it shows without color.
-->
<script lang="ts" module>
  export type MenuItem = {
    label: string;
    onSelect: () => void;
    /** For one-of-several choices: whether this one is the current one. */
    checked?: boolean;
    /** An icon of its own before the words (Write back's ways, decision 0286). */
    icon?: IconName;
    /** The key that does the same, shown at the end of the row (e.g. "Shift+A"). */
    shortcut?: string;
  };
  export type MenuGroup = { label?: string; icon?: IconName; items: MenuItem[] };
</script>

<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import MenuList from "./MenuList.svelte";

  let {
    id,
    label = "More",
    groups,
    up = false,
    start = false,
    icon = "more",
    face,
    look,
  }: {
    id: string;
    label?: string;
    groups: MenuGroup[];
    /** The button's icon: More's three dots, or a row's handle in the sidebar's Edit. */
    icon?: IconName;
    /** Opens upwards, from a bar at the bottom of the screen, its first item nearest the button. */
    up?: boolean;
    /** Lines the menu up with the button's left edge, for a button at the screen's left (the phone's bottom bar). */
    start?: boolean;
    /** What the button shows instead of an icon: a person's picture, on their page (decision 0285). */
    face?: Snippet;
    /** The button's own classes with `face`, instead of a round picture's: the arrow half of Write back's split button (decision 0286). */
    look?: string;
  } = $props();

  let open = $state(false);
  let wrap: HTMLDivElement | undefined = $state();
  let button: HTMLButtonElement | undefined = $state();
  let list: MenuList | undefined = $state();
  /** No room below the button in what's showing, so it opens upwards this time. */
  let flipped = $state(false);
  let upwards = $derived(up || flipped);
  /** Nearest the button first: upwards, the last row drawn is the first item. */
  let shown = $derived(upwards ? [...groups].reverse().map((group) => ({ ...group, items: [...group.items].reverse() })) : groups);

  /** `at` is where it sits on the screen: the top row ("first") or the bottom one; by default, the one nearest the button. */
  async function show(at?: "first" | "last") {
    flipped = false;
    open = true;
    await tick();
    if (!up) flipped = noRoomBelow();
    await list?.focus(at ?? (upwards ? "last" : "first"));
  }

  /** The bottom of what's showing around the button: the screen's, or a scrolling area's that ends sooner (an article's, above the phone's bottom bar). */
  function shownBounds(): { top: number; bottom: number } {
    let top = 0;
    let bottom = window.innerHeight;
    for (let node = wrap?.parentElement; node; node = node.parentElement) {
      if (getComputedStyle(node).overflowY === "visible") continue;
      const it = node.getBoundingClientRect();
      top = Math.max(top, it.top);
      bottom = Math.min(bottom, it.bottom);
    }
    return { top, bottom };
  }

  /** Whether the menu, drawn downwards, runs past what's showing while there's more room above the button. */
  function noRoomBelow(): boolean {
    const menu = wrap?.querySelector("[role='menu']");
    if (!menu || !button) return false;
    const view = shownBounds();
    const it = button.getBoundingClientRect();
    return menu.getBoundingClientRect().bottom > view.bottom && it.top - view.top > view.bottom - it.bottom;
  }

  function close(giveBack: boolean) {
    open = false;
    if (giveBack) button?.focus();
  }

  function onButtonKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show(event.key === "ArrowDown" ? "first" : "last");
    }
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
    class={face ? (look ?? "face") : ["btn-quiet btn-icon", open && "text-ink"]}
  >
    {#if face}
      {@render face()}
    {:else}
      <!-- Open, the icon sits on a small rounded tone, like a pressed toolbar button. -->
      <span class={["flex size-8 items-center justify-center rounded-press", open && "bg-[var(--pressed)]"]}><Icon name={icon} size="alone" /></span>
    {/if}
  </button>
  {#if open}
    <MenuList bind:this={list} {id} {label} groups={shown} place={`${start ? "left-0" : "right-0"} ${upwards ? "bottom-full mb-1" : "top-full mt-1"}`} onClose={close} />
  {/if}
</div>

<style>
  /* A picture as the button: round, as the picture is, so the keyboard's outline follows it. */
  .face {
    display: block;
    border-radius: 9999px;
  }
</style>
