<!--
  The welcome, before the first feed (SPEC section 2): a title in the reading serif, one
  sentence, a wide field with Add feed, and importing a list of feeds as a quiet second way in,
  all in one centred 420px column, like Apple Books' empty library: one message, one action.
  On a phone (`start`) it's left-aligned on the screen's 20px margin instead (decision 0052).
  With the Add a feed sheet open over it (`covered`), the sheet has the only field.
-->
<script lang="ts">
  import AddFeed from "./AddFeed.svelte";
  import type { Feed } from "./shapes";
  import type { Route } from "./router";

  let {
    start,
    covered,
    heading = $bindable(),
    field = $bindable(),
    follow,
    onAdded,
    onOpen,
  }: {
    start: boolean;
    covered: boolean;
    heading?: HTMLHeadingElement;
    field?: HTMLInputElement;
    /** Goes to a place in the app, unless the click is meant for a new tab or window. */
    follow: (event: MouseEvent, next: Route) => void;
    onAdded: (feed: Feed) => void;
    onOpen: (id: number) => void;
  } = $props();
</script>

<div class="flex w-full max-w-[26.25rem] flex-col gap-6">
  <div class={start ? "text-left" : "text-center"}>
    <h2 id="welcome-heading" tabindex="-1" bind:this={heading} class="font-serif text-xlarge font-semibold tracking-[-0.01em]">A quiet place to read.</h2>
    <p class="mt-3 text-ink-2">Follow the websites you like, and read what they publish here, at your own pace.</p>
    <!-- For someone who has never used feeds: what they are, and a few to start with, in a sheet (decision 0079). -->
    <a href="/new-to-feeds" onclick={(event) => follow(event, { kind: "new-to-feeds" })} class="text-link mt-1">New to feeds? Start here</a>
  </div>
  {#if !covered}
    <!--
      Importing sits just under the field, centred as everything here is (on a phone, on the
      screen's margin), as the other way in (decisions 0045, 0048): a link in the text color,
      underlined as the article's note links are, with no side padding so its words line up
      with the heading's, in a 44px-tall target (decision 0055). It opens Settings › Your data.
    -->
    <AddFeed bind:field feeds={[]} {onAdded} {onOpen} {start}>
      {#snippet alternative()}
        <a href="/settings/data" onclick={(event) => follow(event, { kind: "settings", page: "data" })} class="text-link">Import an OPML file…</a>
      {/snippet}
    </AddFeed>
  {:else}
    <!--
      With the Add a feed sheet over it, the field is the sheet's (one field of that name on the page).
      The welcome keeps its exact shape under the dim, a still picture of itself that nothing can
      reach, so nothing behind the sheet moves as it opens or closes (decision 0048).
    -->
    <div inert aria-hidden="true" class="flex flex-col gap-1.5">
      <div class="welcome-row flex gap-2">
        <span class="field flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-muted"><span class="welcome-hint">Paste a website or feed URL</span></span>
        <span class="btn-primary rounded-lg">Add feed</span>
      </div>
      <div class="flex min-h-[5.8rem] flex-col items-center">
        <span class="text-link">Import an OPML file…</span>
      </div>
    </div>
  {/if}
</div>
