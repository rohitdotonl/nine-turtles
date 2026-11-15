<!--
  One article's row in the item list (SPEC section 6): a button that opens
  the article, with the unread dot in its gutter and its words
  (`RowText.svelte`). A right-click, a long press, or the Menu key (or
  Shift+F10) opens its own menu; the arrow keys work like j and k; a drag
  carries the article (decision 0250); Command-click or a middle click opens
  it in a new tab (decision 0233); on a touch screen, swiped left a little
  way it's marked read, and all the way it's starred, as its menu does,
  and springs back when the finger lets go (decision 0274). Which row is chosen, and what each of
  these does to the list, is `ItemList.svelte`'s.
-->
<script lang="ts">
  import type { Article } from "./shapes";
  import type { OneSource } from "./people";
  import RowText from "./RowText.svelte";
  import { longPress } from "./longPress";
  import { opensElsewhere } from "./articleLinks";
  import { carriesArticle } from "./articleDrag";
  import Icon from "./Icon.svelte";
  import type { RowSwipe } from "./rowMenu";
  import { reach, swipe } from "./swipe";
  import { springBack } from "./swipeMotion";

  let {
    article,
    row = $bindable(),
    current,
    tabbable,
    held,
    bold,
    unreadOff,
    oneFeed,
    addressOf,
    onOpen,
    onMenu,
    onStep,
    swipes,
  }: {
    article: Article;
    /** The row's button, for the list to move the keyboard's place to. */
    row?: HTMLButtonElement;
    /** The selected row. */
    current: boolean;
    /** Only one row is a Tab stop: the selected one, or the first. */
    tabbable: boolean;
    /** Its own menu is open. */
    held: boolean;
    bold: string[];
    unreadOff: boolean;
    oneFeed: OneSource;
    addressOf: (article: Article) => string;
    /** A click or Enter: `byKeyboard` tells which. */
    onOpen: (byKeyboard: boolean) => void;
    /** Its menu, where it was pressed, or (by the keyboard) under the start of its title. */
    onMenu: (x?: number, y?: number) => void;
    /** An arrow key: the next (1) or previous (-1) article. */
    onStep: (step: 1 | -1) => void;
    /** What a swipe left does on a touch screen, a little way first, then all the way. */
    swipes: [RowSwipe, ...RowSwipe[]];
  } = $props();

  /** How far the row follows a finger to the left (0 at rest), and what letting go there does: the first of `swipes` past a third of the way (`reach`), the last past 60%. */
  let pulled = $state(0);
  const chosen = (dx: number) => {
    const width = row?.clientWidth ?? innerWidth;
    if (-dx >= width * 0.6) return swipes.at(-1);
    return -dx >= reach(width) ? swipes[0] : undefined;
  };
  const armed = $derived(chosen(pulled));
  /** The room beside the row, and what it says while it closes once the finger has let go. */
  let room: HTMLElement | undefined = $state();
  let closing: { shown: RowSwipe; armed: boolean } | undefined = $state();
  const hands = {
    side: -1 as const,
    moved: (dx: number) => (pulled = dx),
    ended: (dx: number) => {
      const done = chosen(dx);
      if (row && pulled) {
        closing = { shown: done ?? swipes[0], armed: done !== undefined };
        springBack(row, room, () => (pulled = 0), () => (closing = undefined));
      } else pulled = 0;
      done?.run();
    },
  };

  function keys(event: KeyboardEvent) {
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      onMenu();
      return;
    }
    // The arrow keys work like j and k while the keyboard is in the list.
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    onStep(event.key === "ArrowDown" ? 1 : -1);
  }
</script>

<!-- Only one row is a Tab stop (the selected one, or the first); the others are reached with j, k or the arrows. -->
<button
  type="button"
  bind:this={row}
  tabindex={tabbable ? 0 : -1}
  aria-current={current ? "true" : undefined}
  data-held={held ? "" : undefined /* held in the pointer's tone while its own menu is open, so it's clear which article the menu acts on (decision 0214) */}
  data-space-reads
  onclick={(event) => {
    // A click made with Enter has no mouse position.
    onOpen(event.detail === 0);
  }}
  onkeydown={keys}
  oncontextmenu={(event) => {
    event.preventDefault();
    // A press has a place; the keyboard's (where the browser sends it) is the row's.
    onMenu(event.clientX || undefined, event.clientY || undefined);
  }}
  use:longPress={(x, y) => onMenu(x, y)}
  use:opensElsewhere={() => addressOf(article)}
  use:carriesArticle={() => article}
  use:swipe={hands}
  style:transform={pulled ? `translateX(${pulled}px)` : undefined}
  class="item-row place block cursor-pointer pr-4 text-left"
>
  <!-- Unread: an accent dot in the gutter beside the title, and a semibold title (regular under a name in Unread, lists.css), so it shows without color. -->
  {#if !article.read && !unreadOff}<span aria-hidden="true" class="unread-dot"></span>{/if}
  <!-- Its title (or opening), a search result's text, and the one-line meta under them. -->
  <RowText {article} {bold} {current} {unreadOff} {oneFeed} />
</button>
{#if (pulled || closing) && row}
  {@const shown = closing?.shown ?? armed ?? swipes[0]}
  {@const ready = closing ? closing.armed : armed !== undefined}
  <!-- In the room the row opens: the word and icon of what letting go does, in the ink once it's far enough. Seen only; the menu and keys say the same in words. -->
  <span bind:this={room} aria-hidden="true" class="row-swipe" data-armed={ready ? "" : undefined} style:top="{row.offsetTop}px" style:height="{row.offsetHeight}px" style:--pulled="{-pulled}px">
    <Icon name={shown.icon} filled={ready && shown.icon === "star"} />{shown.word}
  </span>
{/if}
