<!--
  The welcome, before the first feed (SPEC section 2): a title in the reading serif, one
  sentence, a wide field with Add, then just under it "Bring your list from another app…" for
  someone who already reads feeds, then "Or try one": three example addresses to follow in one
  press (decision 0198), and "New to feeds?", all in one centred 420px column: one message, one
  main action (Add).
  On a phone (`start`) it's left-aligned on the screen's 20px margin instead (decision 0052).
  With the Add a feed sheet open over it (`covered`), the sheet has the only field.
-->
<script lang="ts">
  import AddFeed from "./AddFeed.svelte";
  import ImportOpml from "./ImportOpml.svelte";
  import TryOne from "./TryOne.svelte";
  import { trying } from "./welcomeTry.svelte";
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
    onImported,
    onTried,
  }: {
    start: boolean;
    covered: boolean;
    heading?: HTMLHeadingElement;
    field?: HTMLInputElement;
    /** Goes to a place in the app, unless the click is meant for a new tab or window. */
    follow: (event: MouseEvent, next: Route) => void;
    onAdded: (feed: Feed, note?: string) => void;
    onOpen: (id: number) => void;
    /** A list from another app brought feeds in: the welcome gives way, and `message` says what came. */
    onImported: (message: string) => void;
    /** An example was followed: the sidebar shows them, and the welcome stays to show their newest post. */
    onTried: () => void;
  } = $props();

  /** Add is asking who was just found: the examples step aside until it's answered. */
  let asked = $state("");

  /** What importing said, while the welcome stays (nothing came in, or the file wasn't a list). */
  let importLines: string[] = $state([]);
  const BRING = "Bring your list from another app…";
</script>

<div class="flex w-full max-w-[26.25rem] flex-col gap-6">
  <div class={start ? "text-left" : "text-center"}>
    <h2 id="welcome-heading" tabindex="-1" bind:this={heading} class="font-serif text-xlarge font-semibold tracking-[-0.01em]">Hello. <span class="block text-balance">Who would you like to read?</span></h2>
    <p class="mt-3 text-ink-2">Paste the address of someone's blog, newsletter or channel.</p>
  </div>
  {#if !covered}
    <!--
      Importing sits just under the field, centred as everything here is (on a phone, on the
      screen's margin), as the other way in (decisions 0045, 0048): a link in the text color,
      underlined as the article's note links are, with no side padding so its words line up
      with the heading's, in a 44px-tall target (decision 0055). It opens the device's file
      chooser at once (decision 0137); what came in is said on the list that follows, and a
      file that brought nothing is said here, under it.
    -->
    <AddFeed bind:field bind:asked feeds={[]} {onAdded} {onOpen} {start}>
      {#snippet alternative()}
        <ImportOpml link={BRING} bind:lines={importLines} onImported={(lines, added) => added > 0 && onImported(lines.join(" "))} />
        <div role="status" class={["flex flex-col gap-1 text-small text-ink-2", importLines.length === 0 && "sr-only"]}>
          {#each importLines as line, index (index)}<p>{line}</p>{/each}
        </div>
        <!-- Then, for someone new: three examples to follow in one press (decision 0198), and what feeds are (decision 0079). -->
        {#if !asked}<TryOne {follow} {onTried} />{/if}
        {#if !trying.current}<a href="/new-to-feeds" onclick={(event) => follow(event, { kind: "new-to-feeds" })} class="text-link">New to feeds? Start here</a>{/if}
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
        <span class="field flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-muted"><span class="welcome-hint">Their website's address</span></span>
        <span class="btn-primary rounded-lg">Add</span>
      </div>
      <div class={["flex min-h-[5.8rem] flex-col", start ? "items-start" : "items-center"]}>
        <span class="text-link">{BRING}</span>
        <TryOne {follow} {onTried} />
        <span class="text-link">New to feeds? Start here</span>
      </div>
    </div>
  {/if}
</div>
