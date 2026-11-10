<!--
  "Follow this person?" (SPEC section 3, decision 0138): what a page shared
  to nine turtles opens (a share menu, a Shortcuts shortcut or a bookmark,
  decision 0104). One question, the sheet's title "Follow <name>?", and one
  press. Under it, their site and the titles of what they wrote lately, so
  the reader knows who they're saying yes to; nothing more, and no word of
  feeds or RSS.

  On opening it looks at the page, without following anything; only Follow
  follows (the site's own feed, the first one the page names). Not now,
  Escape or the X follows nothing. While nine turtles looks, a line of text
  says so: no spinner. If the look can't be made (the finder busy or out of
  reach), Follow still works, through the ordinary add.

  The same build as Add a feed's: in a sheet, Not now and Follow in one row
  at the foot; on a phone's page, no Not now (the X leaves) and Follow the
  full width at the screen's foot (decision 0052).

  A link dropped on a folder (linkDrop.svelte.ts, decision 0247) says so
  under the site, and once followed they're filed in that folder.
-->
<script lang="ts">
  import Waiting from "./Waiting.svelte";
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import type { Feed } from "./shapes";
  import { addFeed, editFeed, type Problem } from "./feeds";
  import { droppedOn } from "./linkDrop.svelte";
  import { lookAt, sayProblem, siteOf, type Person } from "./follow";

  let {
    address,
    name = $bindable(""),
    onFollowed,
    onOpen,
    onCancel,
    page = false,
  }: {
    /** The shared page's address. */
    address: string;
    /** Who it's by, once the look finds out: the sheet's title asks about them. */
    name?: string;
    /** Followed; `note` says anything that didn't go as asked (the dropped-on folder). */
    onFollowed: (feed: Feed, note?: string) => void;
    onOpen: (feedId: number) => void;
    /** In a sheet: Not now, beside Follow in one row at the foot. */
    onCancel?: () => void;
    /** On a phone's page: no Not now, and Follow the full width at the screen's foot. */
    page?: boolean;
  } = $props();

  let looking = $state(true);
  let busy = $state(false);
  let person: Person | undefined = $state();
  let problem = $state("");
  /** The problem is one trying again can't fix, so Follow stays locked. */
  let stuck = $state(false);

  let site = $derived(siteOf(person?.site || address));
  /** The folder the link was dropped on, if it was; forgotten when the question closes. */
  const into = droppedOn.folder;
  $effect(() => () => {
    droppedOn.folder = null;
  });

  onMount(async () => {
    const looked = await lookAt(address);
    looking = false;
    if (looked.kind === "found") {
      person = looked;
      name = looked.name;
    } else if (looked.kind === "problem") said(looked.reason);
  });

  function said(reason: Problem) {
    problem = sayProblem(reason);
    stuck = !["unreachable", "offline", "trouble"].includes(reason);
  }

  async function follow(event: SubmitEvent) {
    event.preventDefault();
    if (held) return;
    busy = true;
    problem = "";
    let result = await addFeed(person?.choices[0]?.url ?? address);
    // Asked without a look, a site naming several: its first, as the look would have chosen.
    if (result.kind === "choose" && result.choices[0]) result = await addFeed(result.choices[0].url);
    // Filing them in the folder the link was dropped on; if that fails, they're followed all the same and the note says so.
    const filed = result.kind === "added" && into ? await editFeed(result.feed.id, { folders: [into.id] }) : undefined;
    busy = false;
    if (result.kind === "added") onFollowed(result.feed, filed && into ? `They couldn't be put in ${into.name}; Edit can do it.` : undefined);
    // Followed already: Follow takes them to that person instead.
    else if (result.kind === "already") onOpen(result.feedId);
    else if (result.kind === "problem") said(result.reason);
  }

  /** Follow can't be pressed: busy, still looking, or a problem trying again can't fix. */
  let held = $derived(busy || looking || stuck);
</script>

<form onsubmit={follow} class={["flex flex-col gap-4", page && "flex-1"]}>
  <div class="flex flex-col gap-1">
    <p class="break-all text-ink-2">{site}</p>
    {#if into}<p class="text-meta text-ink-2">They'll go in {into.name}.</p>{/if}
    <!-- Screen readers hear each new line here without moving the keyboard's place: the question again once the name is known, since the keyboard reached the title before it was. -->
    <p role="status" class={["flex items-start gap-2 text-meta", problem ? "text-danger" : "text-ink-2"]}>
      {#if looking}Looking…{:else if problem}<span class="mt-px shrink-0"><Icon name="alert" /></span>{problem}{:else if name}<span class="sr-only">Follow {name}?</span>{/if}
    </p>
  </div>

  {#if person && person.lately.length > 0}
    <!-- What they wrote lately, so the reader knows who they're saying yes to. Plain text: Follow is the one action here. -->
    <section aria-labelledby="follow-lately" class="flex flex-col gap-2">
      <h3 id="follow-lately" class="text-meta text-ink-2">Lately</h3>
      <ul class="flex flex-col gap-1 font-serif">
        {#each person.lately as title, index (index)}
          <li class="break-words">{title}</li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if page}
    <div class="page-action">
      <button type="submit" aria-disabled={held} class="btn-primary"><Waiting {busy} word="Follow" doing="Following…" /></button>
    </div>
  {:else if onCancel}
    <div class="sheet-actions">
      <button type="button" onclick={onCancel} class="btn">Not now</button>
      <button type="submit" aria-disabled={held} class="btn-primary"><Waiting {busy} word="Follow" doing="Following…" /></button>
    </div>
  {/if}
</form>
