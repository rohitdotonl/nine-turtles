<!--
  The list's title line. The title is one line, as Apple Books' collection titles are (decision 0041): a long
  name ends in "…", with its whole name as its tooltip and read in full by screen readers, so
  the search field below and More beside it never move. In a pane narrower than 340px it
  steps down from 24px to 22px. Beside it, one quiet More (…) button, as Apple Books has one
  per collection (decision 0038): Mark all as read, Refresh, the sort order, and "About …" or
  Edit folder in a person's, publication's or folder's own list (SPEC section 6). A person's or
  publication's name is itself the way to their page, a button ending in › (decision 0163).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";

  let {
    text,
    actions,
    phone,
    searchOpen,
    onSearch,
    menu,
    heading = $bindable(),
    onAbout,
  }: {
    /** The list's name (`listHeading.ts`). */
    text: string;
    /** Whether Search and More show: only over a list that exists. */
    actions: boolean;
    /** A phone keeps its way into search here, beside More. */
    phone: boolean;
    searchOpen: boolean;
    onSearch: () => void;
    /** More's groups, built each time the line is drawn (`listMenu.ts`). */
    menu: () => MenuGroup[];
    heading?: HTMLHeadingElement;
    /** A person's or publication's list: the name opens their page. */
    onAbout?: () => void;
  } = $props();
</script>

<div class="flex min-h-11 min-w-0 flex-1 items-center gap-4">
  <h2
    id="list-heading"
    tabindex="-1"
    bind:this={heading}
    title={text}
    class="min-w-0 flex-1 truncate font-serif text-heading leading-[1.3] font-semibold tracking-[-0.01em] @max-[340px]:text-[1.375rem]"
  >
    {#if onAbout}
      <!-- The heading's name stays theirs alone; what the button does is its description. The full 44px tall, to touch. -->
      <button type="button" onclick={onAbout} title="About {text} (i)" aria-describedby="list-heading-about" class="list-title-link min-h-11 max-w-full truncate text-left"
        >{text}<span aria-hidden="true" class="ml-1.5 font-normal text-muted">›</span></button
      >
    {:else}
      {text}
    {/if}
  </h2>
  {#if onAbout}<span id="list-heading-about" class="sr-only">Opens the page about them.</span>{/if}
  {#if actions}
    <div class="-mr-3 flex shrink-0 items-center">
      {#if phone}
        <!-- The way into search, beside More, as an iOS list keeps it (decision 0060). -->
        <button type="button" aria-label="Search" title="Search" aria-expanded={searchOpen} onclick={onSearch} class="btn-quiet btn-icon"
          ><span class="flex size-8 items-center justify-center"><Icon name="search" size={20} /></span></button
        >
      {/if}
      <MoreMenu id="list-menu" groups={menu()} />
    </div>
  {/if}
</div>

<style>
  /* The name as a button reads as the title it is: no box, the title's own type; the pointer and focus say it opens. */
  .list-title-link {
    font: inherit;
    letter-spacing: inherit;
    color: inherit;
    border-radius: 0.375rem;
  }
  .list-title-link:hover {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
  }
</style>
