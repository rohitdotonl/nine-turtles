<!--
  The add-a-feed field (SPEC sections 2 and 3): the welcome on a fresh
  nine turtles, and the "+ Add" sheet. It takes a feed's address or a
  website's; nine turtles finds the feed. Several feeds become a choice of one,
  drawn as a list with a round mark on each, the first one chosen, which
  Add then adds (decision 0049); problems
  are said in plain words. While nine turtles looks, a line of text says so: no
  spinner.

  In a sheet the field takes the full width and "Add" sits in the foot
  row beside Cancel. On a phone's page, the phone sheet's one build (decision
  0052): no Cancel (the X beside the title is the way out) and "Add"
  the full width at the screen's foot. In the welcome, with no Cancel, "Add
  feed" sits beside the field.

  Once someone is found, the field gives way to one question (the owner's
  core path, point 1): "Maya Chen is…" (the sheet's title, or in the welcome
  the question's own heading), what was found (their site, and their newest
  title in the reading serif), and two tiles side by side, A person and A
  publication, each with its icon, nine turtles' guess chosen; then "You can
  change this later in Edit." and Done.

  A shared page's address opens "Follow this person?" instead
  (FollowPerson.svelte, decision 0138). A YouTube video's address asks
  whether to follow its channel, and a playlist's whether to follow the
  whole channel or only the playlist (decision 0144), the same way.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import type { Feed } from "./shapes";
  import { onDestroy, tick } from "svelte";
  import { addFeed, editFeed, explain, type Choice } from "./feeds";
  import type { WhoKind } from "./shapes";
  import { question } from "./youtube";
  import { siteName } from "./people";

  let {
    field = $bindable(),
    asked = $bindable(""),
    feeds,
    onAdded,
    onOpen,
    onCancel,
    page = false,
    start = false,
    alternative,
  }: {
    field?: HTMLInputElement;
    /** Who was just found, while the question asks about them: a sheet's title becomes "{asked} is…". */
    asked?: string;
    /** The feeds already followed, to name one that's added twice. */
    feeds: Feed[];
    onAdded: (feed: Feed) => void;
    onOpen: (feedId: number) => void;
    /** In a sheet or its page: Cancel, beside Add in one row at the foot. */
    onCancel?: () => void;
    /** On a phone's page: no Cancel, and Add the full width at the screen's foot. */
    page?: boolean;
    /** The welcome on a phone: left-aligned on the screen's margin, not centred (decision 0052). */
    start?: boolean;
    /**
     * In the welcome: another way in (importing an OPML file), just under the
     * field, so it reads as an alternative to it rather than a footer.
     */
    alternative?: Snippet;
  } = $props();

  let address = $state("");
  let busy = $state(false);
  let message = $state("");
  /** The message is a problem, not a next step. */
  let problem = $state(false);
  /** The problem is the address itself (not the site or nine turtles being unreachable), so the field is marked. */
  let badAddress = $state(false);
  let choices: Choice[] = $state([]);
  /** The feed chosen among several, by its address: the first one offered, until another is picked. */
  let chosen = $state("");
  /** The address the choices were found at: Add adds the chosen one while the field still holds it. */
  let choicesFor = $state("");
  let alreadyId: number | undefined = $state();
  /** Just added: "someone you might write to?", with nine turtles' guess chosen (decision 0163), before it opens. */
  let asking: Feed | undefined = $state();
  /** Their newest title, shown with their site above the question. */
  let latest: string | undefined = $state();
  let who: WhoKind = $state("person");
  let whoGroup: HTMLElement | undefined = $state();
  /** Closed (Escape, Cancel, a press outside) while still looking or before Done: the feed is followed all the same. */
  let closed = false;
  /** Done was pressed: closing while its answer is kept doesn't add it a second time. */
  let answering = false;
  onDestroy(() => {
    closed = true;
    asked = "";
    // Followed but not yet answered: it joins the sidebar with nine turtles' guess, which Edit can change.
    if (asking && !answering) onAdded(asking);
  });

  /** In a sheet or on its page: the field's name above it, and Add at the foot rather than beside the field. */
  let framed = $derived(onCancel !== undefined || page);
  /** Several feeds were found: the line above them is their label. */
  let choosing = $derived(choices.length > 0 && !busy);

  let alreadyTitle = $derived(feeds.find((feed) => feed.id === alreadyId)?.title);

  /** Problems that aren't the address's fault (the site, the connection, nine turtles, the reader's plan): the field isn't marked. */
  const NOT_THE_ADDRESS = ["unreachable", "trouble", "too-many", "plan-ended", "offline"];

  /**
   * The address was changed after several feeds were offered: they belong to the old one, so they go with
   * everything said about them (a problem's red edge, "Go to …"), and Add looks again.
   */
  function edited() {
    if (choices.length > 0 && address !== choicesFor) {
      choices = [];
      message = "";
      problem = false;
      badAddress = false;
      alreadyId = undefined;
    }
  }

  // The choices stay on screen while the chosen one is being added, so a
  // choice that fails can be swapped for another. Add says it's busy
  // with `aria-disabled` rather than `disabled`, which would drop the
  // keyboard's place on it.
  async function add(text: string, fromChoices = false) {
    if (busy) return;
    busy = true;
    message = "";
    problem = false;
    badAddress = false;
    if (!fromChoices) choices = [];
    alreadyId = undefined;
    const result = await addFeed(text);
    busy = false;
    switch (result.kind) {
      case "added":
        // Closed while looking: nothing is left to ask in, so it only joins the sidebar.
        if (closed) {
          onAdded(result.feed);
          break;
        }
        address = "";
        choices = [];
        asking = result.feed;
        asked = result.feed.title;
        latest = result.latest;
        who = result.feed.kind ?? "person";
        await tick();
        whoGroup?.querySelector<HTMLInputElement>("input:checked")?.focus();
        break;
      case "choose":
        choices = result.choices;
        chosen = result.choices[0]?.url ?? "";
        choicesFor = text;
        message = result.asks ? question(result.asks, result.maker ?? "") : "This site offers more than one feed. Choose one:";
        break;
      case "already":
        alreadyId = result.feedId;
        message = "You already follow this.";
        break;
      case "problem":
        message = explain(result.reason);
        problem = true;
        badAddress = !NOT_THE_ADDRESS.includes(result.reason);
        break;
    }
  }

  /** Done: their answer is kept, and they open. */
  async function answered() {
    const feed = asking;
    if (!feed || busy) return;
    busy = true;
    answering = true;
    // Always kept, so a later guess never overrides what they answered. A publication goes by
    // its own title, not the one author's name nine turtles gave the person it guessed.
    const title = who === "publication" && feed.siteTitle && feed.siteTitle !== feed.title ? feed.siteTitle : undefined;
    const refusal = await editFeed(feed.id, { kind: who, ...(title ? { title } : {}) });
    busy = false;
    asking = undefined;
    asked = "";
    // The guess stands if the answer couldn't be kept; Edit can change it later.
    onAdded(refusal ? feed : { ...feed, kind: who, ...(title ? { title } : {}) });
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (asking) {
      void answered();
      return;
    }
    if (choices.length > 0 && address === choicesFor && chosen) add(chosen, true);
    else if (address.trim()) add(address);
    else {
      message = "Paste an address first.";
      problem = true;
      badAddress = true;
    }
  }
</script>

<!--
  In the welcome everything is centred, under a centred title (decision 0048):
  the field's name is said to screen readers and shown as its placeholder, so
  no line of it sits left-aligned. In a sheet its name stands above it.
-->
<form onsubmit={submit} class={["flex flex-col gap-1.5", page && "flex-1"]}>
  {#if !asking}
  <label for="feed-address" class={framed ? "text-small text-ink-2" : "sr-only"}>Their website's address</label>
  <!-- In the welcome, a container, so its hint can step down a size on a small phone (welcome-field in app.css). -->
  <div class={["flex gap-2", !framed && "welcome-row"]}>
    <input
      id="feed-address"
      bind:this={field}
      bind:value={address}
      type="text"
      inputmode="url"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      placeholder={framed ? "example.com" : "Their website's address"}
      aria-describedby="feed-address-status"
      aria-invalid={badAddress ? "true" : undefined}
      oninput={edited}
      class={["field min-w-0 flex-1", !framed && "welcome-field"]}
    />
    {#if !framed}
      <!-- Beside the field, its corners match the field's. -->
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Add</button>
    {/if}
  </div>
  {/if}
  <!--
    In the welcome, everything under the field sits in a block that keeps
    room for a two-line message and the line after it (the page is centred,
    so a message arriving moves nothing above it). In a sheet the block
    isn't drawn at all, so the sheet's own spacing stands. The other way in sits just under the field, and
    a message, when there is one, takes its place there and moves it down
    within that room (decision 0045).
  -->
  <div class={framed ? "contents" : ["flex min-h-[5.8rem] flex-col", start ? "items-start text-left" : "items-center text-center"]}>
    <!--
      Screen readers hear each new line here without moving the keyboard's place.
      A problem is in red words after an icon. In a sheet the line takes room
      only once there's something to say, and the sheet grows down by it (its
      top stays put). In the welcome the block around it keeps the room. It
      sits 6px under the field; when it asks you to choose among several
      feeds it is their label, set as the field's own label is, 20px under
      the field (decision 0052).
    -->
    <p
      id="feed-address-status"
      role="status"
      class={[
        "flex items-start gap-1.5 text-small",
        problem && !busy && "text-danger",
        choosing && "mt-3.5 text-ink-2",
        framed ? !busy && !message && "sr-only" : (busy || message) && "pb-2",
      ]}
    >
      {#if busy}{asking ? "Saving…" : "Looking…"}{:else}{#if problem}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{/if}{message}{/if}
    </p>

    {#if choices.length > 0}
      <!--
        A choice of one, as a Mac or iOS list draws it: each feed a row with its
        name and address, ending in a round mark, empty or filled with a dot,
        so the chosen one shows by its mark, never by a tint alone. Round,
        because only one can be added (a square tick box says "any of these",
        decision 0045). Real radio buttons lie under the rows: the arrow keys
        move the choice, and Add adds it (decision 0049). Each row says
        what nine turtles saw inside the feed: its newest title in the reading
        serif, then how often it posts and its address as a person says it
        (decision 0165). In a sheet a long list scrolls inside itself, so
        Cancel and Add never leave the window.
      -->
      <div role="radiogroup" aria-label="Feeds on this site" aria-describedby="feed-address-status" class={["inset-group mb-2 self-stretch text-left", !page && "choices-scroll"]}>
        {#each choices as choice (choice.url)}
          <label class="inset-row check-row flex-nowrap">
            <input type="radio" name="feed-choice" value={choice.url} bind:group={chosen} />
            <span class="flex min-w-0 flex-col py-2.5">
              <span class="break-words">{choice.title}</span>
              {#if choice.latest}<span class="mt-0.5 font-serif break-words text-ink-2">{choice.latest}</span>{/if}
              <span class="mt-0.5 text-small break-all text-muted">{[choice.posting, choice.place ?? choice.url].filter(Boolean).join(" · ")}</span>
            </span>
            <span aria-hidden="true" class="radio-mark shrink-0"></span>
          </label>
        {/each}
      </div>
    {/if}

    {#if asking}
      <!--
        A person or a publication (decision 0163, the owner's core path, point 1), asked as a sentence
        to finish: "Maya Chen is…". Two tiles side by side, each a real radio button under its icon,
        name and meaning, the guess chosen; the chosen one has a 2px ink edge, so it shows by its
        shape, never by a tint alone. In a sheet the title asks it; in the welcome, its own heading.
      -->
      <fieldset bind:this={whoGroup} class={["flex flex-col gap-4 self-stretch text-left", !framed && "mt-2"]}>
        <legend class={framed ? "sr-only" : "mb-4 font-serif text-heading font-semibold break-words text-ink"}>{asking.title} is…</legend>
        {#if siteName(asking.siteUrl) || latest}
          <div class="found flex flex-col gap-1">
            {#if siteName(asking.siteUrl)}<span class="text-small break-all text-ink-2">{siteName(asking.siteUrl)}</span>{/if}
            {#if latest}<span class="font-serif break-words text-ink">{latest}</span>{/if}
          </div>
        {/if}
        <div class="tiles">
          <label class="tile">
            <input type="radio" name="feed-who" value="person" bind:group={who} aria-labelledby="feed-who-person-name" aria-describedby="feed-who-person" />
            <Icon name="person" size={36} />
            <span id="feed-who-person-name" class="font-semibold text-ink">A person</span>
            <span id="feed-who-person" class="text-small text-ink-2">Someone you might write back to.</span>
          </label>
          <label class="tile">
            <input type="radio" name="feed-who" value="publication" bind:group={who} aria-labelledby="feed-who-publication-name" aria-describedby="feed-who-publication" />
            <Icon name="newspaper" size={36} />
            <span id="feed-who-publication-name" class="font-semibold text-ink">A publication</span>
            <span id="feed-who-publication" class="text-small text-ink-2">Anything you only read or watch, and won't write back to.</span>
          </label>
        </div>
        <span class="field-help mt-0">You can change this later in Edit.</span>
        {#if !framed}
          <!-- In the welcome, Done under the question, at its right, as in a sheet. -->
          <button type="submit" aria-disabled={busy} class="btn-primary self-end">Done</button>
        {/if}
      </fieldset>
    {/if}

    {#if alreadyId !== undefined}
      <p class="-mt-1 mb-2">
        <a
          href={`/people/${alreadyId}`}
          onclick={(event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (alreadyId !== undefined) onOpen(alreadyId);
          }}
          class="inline-flex min-h-11 items-center underline underline-offset-4">Go to {alreadyTitle ?? "it"}</a
        >
      </p>
    {/if}

    {#if alternative}{@render alternative()}{/if}
  </div>

  {#if page}
    <!-- On a phone: Add the full width at the screen's foot; the X beside the title leaves. -->
    <div class="page-action">
      <button type="submit" aria-disabled={busy} class="btn-primary">{asking ? "Done" : "Add"}</button>
    </div>
  {:else if onCancel}
    <!-- The sheet's one row of actions, 20px under what's above it (with the form's 6px gap): Cancel, then Add at the right end. -->
    <div class="sheet-actions mt-3.5">
      {#if !asking}<button type="button" onclick={onCancel} class="btn">Cancel</button>{/if}
      <button type="submit" aria-disabled={busy} class="btn-primary">{asking ? "Done" : "Add"}</button>
    </div>
  {/if}
</form>

<style>
  /* What was found, quietly, on the grouped rows' grey. */
  .found {
    padding: 0.875rem 1rem;
    border-radius: 0.625rem;
    background-color: var(--group, var(--list));
  }
  /* Two tiles side by side, each the same size, whatever their words. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem 0.875rem;
    border: 2px solid transparent;
    border-radius: 0.75rem;
    background-color: var(--group, var(--list));
    color: var(--ink);
    text-align: center;
    cursor: pointer;
  }
  .tile input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .tile:has(input:checked) {
    border-color: var(--ink);
  }
  .tile:has(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .tile:hover {
      background-color: var(--hover);
    }
  }
  @media (forced-colors: active) {
    .tile:has(input:checked) {
      border-color: Highlight;
    }
    .tile:has(input:focus-visible) {
      outline-color: CanvasText;
    }
  }
  /* What's above the list (title, words, field) takes about 37rem; the list keeps at least two rows. */
  .choices-scroll {
    max-height: max(10rem, calc(100dvh - 37rem));
    overflow-y: auto;
  }
</style>
