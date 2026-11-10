<!--
  The add-a-feed field (SPEC sections 2 and 3): the welcome on a fresh
  nine turtles, and the "+ Add" sheet. It takes a feed's address or a
  website's; nine turtles finds the feed. Several feeds become a list with a
  tick box on each, the first ticked, and Follow follows every ticked one; feeds
  followed together from one site become one person (decision 0206). A
  YouTube address's question is a choice of one, with round marks (decision
  0049). Problems are said in plain words. While nine turtles looks, a line of
  text says so: no spinner.

  In a sheet the field takes the full width and "Add" sits in the foot
  row beside Cancel. On a phone's page, the phone sheet's one build (decision
  0052): no Cancel (the X beside the title is the way out) and "Add"
  the full width at the screen's foot. In the welcome, with no Cancel, "Add"
  sits beside the field; while feeds are offered it steps aside, and Cancel
  and Follow sit at the list's foot (on a phone, Follow alone, the list's full
  width).

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

  In the sheet (and its page on a phone), an address typed and not yet
  added is kept on this device: Escape, a press on the dimmed page or going
  elsewhere leave it in the field for next time; Cancel clears it
  (decision 0235).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import AskForFeed from "./AskForFeed.svelte";
  import ByEmail from "./ByEmail.svelte";
  import Icon from "./Icon.svelte";
  import type { Feed } from "./shapes";
  import { onDestroy, tick } from "svelte";
  import { keepDraft, keptWords } from "./drafts";
  import { addFeed, editFeed, explain, type Choice } from "./feeds";
  import { followedTogether } from "./several";
  import { runningInstalled } from "./installing.svelte";
  import { join } from "./people";
  import type { WhoKind } from "./shapes";
  import { question } from "./youtube";
  import { addressFix, addressSlip, type AddressFix } from "./typos";
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
    /** Followed: it opens. `note` names any ticked feeds that couldn't be followed, for the list's line. */
    onAdded: (feed: Feed, note?: string) => void;
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

  // In the sheet, an address typed earlier and not added waits in the field (decision 0235).
  // svelte-ignore state_referenced_locally
  const keeps = onCancel !== undefined || page;
  let address = $state((keeps && keptWords("add")) || "");
  $effect(() => {
    if (keeps) keepDraft("add", address.trim() ? address : undefined);
  });

  /** Cancel: the sheet closes, and what was typed goes with it. */
  function cancel() {
    keepDraft("add", undefined);
    onCancel?.();
  }
  let busy = $state(false);
  let message = $state("");
  /** The message is a problem, not a next step. */
  let problem = $state(false);
  /** The problem is the address itself (not the site or nine turtles being unreachable), so the field is marked. */
  let badAddress = $state(false);
  let choices: Choice[] = $state([]);
  /** The feeds ticked among several, by their addresses: the first one offered, to begin with. */
  let ticked: string[] = $state([]);
  /** A YouTube address's question (its channel, or only the playlist): one of them, by its address. */
  let chosen = $state("");
  /** The choices are that question, a choice of one, rather than a site's feeds. */
  let oneOnly = $state(false);
  /** While several ticked feeds are followed one after another: how many are done, of how many. */
  let progress: { done: number; of: number } | undefined = $state();
  /** Ticked feeds that couldn't be followed, said on the list that opens. */
  let note: string | undefined;
  /** The address the choices were found at: Add adds the chosen one while the field still holds it. */
  let choicesFor = $state("");
  let alreadyId: number | undefined = $state();
  /** The address's one obvious repair, offered as a button under the message (decision 0234). */
  let slip: AddressFix | undefined = $state();
  /** The address Add already paused for once to offer a repair: pressed again, it's looked up as typed. */
  let pausedFor = "";
  /** Just added: "{title} is…" a person or a publication, with nine turtles' guess chosen (decision 0163), before it opens. */
  let asking: Feed | undefined = $state();
  /** Their newest title, shown with their site above the question. */
  let latest: string | undefined = $state();
  /** The address that had no feed: perhaps a newsletter that only comes by email (decision 0198). */
  let noFeed = $state("");
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
    if (asking && !answering) onAdded(asking, note);
  });

  /** In a sheet or on its page: the field's name above it, and Add at the foot rather than beside the field. */
  let framed = $derived(onCancel !== undefined || page);
  /** Several feeds were found: the line above them is their label. */
  let choosing = $derived(choices.length > 0 && !busy);
  /** A YouTube video's question: one row, which Follow's description reads out. */
  let single = $derived(oneOnly && choices.length === 1 && !asking);
  /** The welcome's own Add steps aside while feeds are offered: Follow, at the list's foot, takes its place. */
  let offering = $derived(choices.length > 0 && !framed);
  /** On a phone where nine turtles is installed, sharing a page into it is the easier way (decision 0206). */
  let shareHint = $derived(page && runningInstalled());

  let alreadyTitle = $derived(feeds.find((feed) => feed.id === alreadyId)?.title);

  /** Problems that aren't the address's fault (the site, the connection, nine turtles, the reader's plan): the field isn't marked. */
  const NOT_THE_ADDRESS = ["unreachable", "trouble", "too-many", "plan-ended", "offline"];

  /**
   * The address was changed after several feeds were offered: they belong to the old one, so they go with
   * everything said about them (a problem's red edge, "Go to …"), and Add looks again.
   */
  function edited() {
    // A repair offered for what was there before no longer fits: it goes with its message.
    if (slip) {
      slip = undefined;
      message = "";
      problem = false;
      badAddress = false;
    }
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
    begin();
    if (!fromChoices) choices = [];
    const result = await addFeed(text);
    busy = false;
    switch (result.kind) {
      case "added":
        await followed(result.feed, result.latest);
        break;
      case "choose":
        choices = result.choices;
        oneOnly = result.asks !== undefined;
        chosen = result.choices[0]?.url ?? "";
        ticked = chosen ? [chosen] : [];
        choicesFor = text;
        message = result.asks ? question(result.asks, result.maker ?? "") : "This site offers more than one feed. Choose which to follow:";
        break;
      case "already":
        alreadyId = result.feedId;
        message = "You already follow this.";
        break;
      case "problem":
        if (result.reason === "not-an-address" && offerRepair(text)) break;
        message = explain(result.reason);
        problem = true;
        badAddress = !NOT_THE_ADDRESS.includes(result.reason);
        if (result.reason === "no-feed") noFeed = text;
        break;
    }
  }

  /** Clears what was said before a new try. */
  function begin() {
    busy = true;
    message = "";
    problem = false;
    badAddress = false;
    alreadyId = undefined;
    noFeed = "";
    note = undefined;
    slip = undefined;
  }

  /** Says what looks mistyped in `text` and offers its one repair, if it has one; never changes the field by itself. */
  function offerRepair(text: string): boolean {
    slip = addressFix(text);
    if (!slip) return false;
    message = addressSlip(slip);
    problem = true;
    badAddress = true;
    return true;
  }

  /** Use …: the repaired address goes in the field, and is looked up. */
  function useRepair() {
    if (!slip) return;
    address = slip.address;
    field?.focus();
    add(address);
  }

  /** Followed: the question "… is…" a person or a publication, before it opens. */
  async function followed(feed: Feed, newest?: string) {
    // Followed: the address it was typed as is done with.
    keepDraft("add", undefined);
    // Closed while looking: nothing is left to ask in, so it only joins the sidebar.
    if (closed) {
      onAdded(feed, note);
      return;
    }
    address = "";
    choices = [];
    asking = feed;
    asked = feed.title;
    latest = newest;
    who = feed.kind ?? "person";
    await tick();
    whoGroup?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }

  /**
   * Follow, with several of a site's feeds ticked: each is followed in turn, from the copy just
   * looked at (the publisher isn't asked again), and those followed become one person, who opens.
   * One followed asks "… is…" as a single one does.
   */
  async function followTicked() {
    const urls = choices.map((choice) => choice.url).filter((url) => ticked.includes(url));
    if (urls.length === 0) {
      message = "Tick at least one first.";
      problem = true;
      badAddress = false;
      return;
    }
    if (urls.length === 1) return add(urls[0]!, true);
    begin();
    progress = { done: 0, of: urls.length };
    const results = [];
    for (const url of urls) {
      results.push(await addFeed(url));
      progress = { done: results.length, of: urls.length };
    }
    progress = undefined;
    const together = followedTogether(urls, results, choices);
    note = together.note;
    const [first] = together.added;
    if (!first) {
      busy = false;
      if (together.already !== undefined) {
        alreadyId = together.already;
        message = "You already follow these.";
      } else {
        message = explain(together.problem ?? "trouble");
        problem = true;
      }
      return;
    }
    if (together.added.length === 1) {
      busy = false;
      await followed(first.feed, first.latest);
      return;
    }
    // A source joined to others is always a person (SPEC section 36), so nothing is asked.
    const { refusal } = await join(together.added.map((each) => each.feed.id));
    busy = false;
    keepDraft("add", undefined);
    onAdded({ ...first.feed, kind: "person" }, [refusal, note].filter(Boolean).join(" ") || undefined);
  }

  /** The welcome's Cancel, under the offered feeds: they go, and the keyboard is back in the field. */
  function putAway() {
    choices = [];
    message = "";
    problem = false;
    alreadyId = undefined;
    field?.focus();
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
    onAdded(refusal ? feed : { ...feed, kind: who, ...(title ? { title } : {}) }, note);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (asking) {
      void answered();
      return;
    }
    if (choices.length > 0 && address === choicesFor) {
      if (!oneOnly) void followTicked();
      else if (chosen) add(chosen, true);
    } else if (address.trim()) {
      // A likely slip is offered first; never blocking, so a second press looks the address up as typed.
      if (pausedFor !== address && offerRepair(address)) pausedFor = address;
      else add(address);
    }
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
    {#if !framed && !offering}
      <!-- Beside the field, its corners match the field's. It steps aside while feeds are offered: Follow is under them. -->
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Add</button>
    {/if}
  </div>
  {#if shareHint}
    <!-- The installed app on a phone: the quieter way in, said once, as small and faint as the floors allow (decision 0206). -->
    <p class="share-hint">Reading them in another app? Share the page to nine turtles.</p>
  {/if}
  {/if}
  <!--
    In the welcome, everything under the field sits in one block, centred (on a
    phone, on the screen's margin). The welcome's heading never moves, so what
    arrives here only grows the page downward (decision 0206). In a sheet the
    block isn't drawn at all, so the sheet's own spacing stands. The other ways
    in sit just under the field, and a message, when there is one, comes
    between and moves them down (decision 0045).
  -->
  <div class={framed ? "contents" : ["flex flex-col", start ? "items-start text-left" : "items-center text-center"]}>
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
        choosing && "mt-3.5 self-stretch text-left text-ink-2",
        framed ? !busy && !message && "sr-only" : (busy || message) && "pb-2",
      ]}
    >
      {#if busy}{asking ? "Saving…" : progress ? `Following… ${progress.done} of ${progress.of} done` : "Looking…"}{:else}{#if problem}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{/if}{message}{/if}
    </p>
    {#if slip && !busy}
      <!-- The repair, as an everyday edged button: the reader presses it, nothing is changed for them (decision 0234). -->
      <button type="button" onclick={useRepair} class={["btn mt-1.5 max-w-full rounded-lg break-all", framed ? "self-start mb-2" : "mb-2"]}>Use {slip.address}</button>
    {/if}

    {#if choices.length > 0}
      <!--
        The feeds a site offers, as a Mac or iOS list draws a choice of any:
        each a row ending in a tick box, the first ticked, so any number can be
        followed at once, and followed together they become one person
        (decision 0206). A YouTube address's question is a choice of one
        instead, each row ending in a round mark (decision 0049). Either way the
        choice shows by its mark, never by a tint alone, and real inputs lie
        under the rows. Each row says what nine turtles saw inside the feed: its
        name, its newest title in the reading serif, then its address as a
        person says it (decision 0165), on one line that ends in "…" when it's
        too long, never cut off or broken mid-word (decision 0191). In a sheet a
        long list scrolls inside itself, so Cancel and Follow never leave the
        window. On a phone the list is a card on the screen's margin, the field's
        own edges (decision 0206). A YouTube video's question has one answer,
        its channel: the row shows who it is, with no mark, and Follow follows.
      -->
      {#if single}
        {@const only = choices[0]!}
        <div class={["inset-group self-stretch text-left", framed && "mb-2"]}>
          <div id="feed-only-choice" class="inset-row flex-nowrap">
            <span class="flex min-w-0 flex-col py-2.5">
              <span class="break-words">{only.title}</span>
              {#if only.latest}<span class="mt-0.5 font-serif break-words text-ink-2">{only.latest}</span>{/if}
              <span class="mt-0.5 truncate text-small text-muted">{only.place ?? only.url}</span>
            </span>
          </div>
        </div>
      {:else}
        <div
          role={oneOnly ? "radiogroup" : "group"}
          aria-label="Feeds on this site"
          aria-describedby="feed-address-status"
          class={["inset-group self-stretch text-left", framed && "mb-2", !page && "choices-scroll"]}
        >
          {#each choices as choice (choice.url)}
            <label class="inset-row check-row flex-nowrap">
              {#if oneOnly}
                <input type="radio" name="feed-choice" value={choice.url} bind:group={chosen} />
              {:else}
                <input type="checkbox" name="feed-choice" value={choice.url} bind:group={ticked} />
              {/if}
              <span class="flex min-w-0 flex-col py-2.5">
                <span class="break-words">{choice.title}</span>
                {#if choice.latest}<span class="mt-0.5 font-serif break-words text-ink-2">{choice.latest}</span>{/if}
                <span class="mt-0.5 truncate text-small text-muted" title={choice.url}>{choice.place ?? choice.url}</span>
              </span>
              {#if oneOnly}
                <span aria-hidden="true" class="radio-mark shrink-0"></span>
              {:else}
                <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
              {/if}
            </label>
          {/each}
        </div>
      {/if}
      {#if !framed}
        <!--
          In the welcome, the list's own row of actions at its foot, 20px under it: Cancel, then
          Follow at the right end. On a phone, Follow alone, the list's full width.
        -->
        <div class={["mt-3.5 mb-2 flex gap-3 self-stretch", start ? "flex-col" : "justify-end"]}>
          {#if !start}<button type="button" onclick={putAway} class="btn">Cancel</button>{/if}
          <button type="submit" aria-disabled={busy} aria-describedby={single ? "feed-only-choice" : undefined} class="btn-primary">Follow</button>
        </div>
      {/if}
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

    {#if noFeed && !busy}<AskForFeed site={noFeed} /><ByEmail site={noFeed} />{/if}

    {#if alternative && choices.length === 0 && !asking}{@render alternative()}{/if}
  </div>

  {#if page}
    <!-- On a phone: Add the full width at the screen's foot; the X beside the title leaves. -->
    <div class="page-action">
      <button type="submit" aria-disabled={busy} aria-describedby={single ? "feed-only-choice" : undefined} class="btn-primary"
        >{asking ? "Done" : choices.length > 0 ? "Follow" : "Add"}</button
      >
    </div>
  {:else if onCancel}
    <!-- The sheet's one row of actions, 20px under what's above it (with the form's 6px gap): Cancel, then Add at the right end. -->
    <div class="sheet-actions mt-3.5">
      {#if !asking}<button type="button" onclick={cancel} class="btn">Cancel</button>{/if}
      <button type="submit" aria-disabled={busy} aria-describedby={single ? "feed-only-choice" : undefined} class="btn-primary"
        >{asking ? "Done" : choices.length > 0 ? "Follow" : "Add"}</button
      >
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
  /* The share line: the smallest size, in the faintest grey that keeps 4.5 : 1 on the sheet (contrast.test.ts). */
  .share-hint {
    margin: 0.25rem 0 0;
    color: var(--faint);
    font-size: 0.75rem;
    line-height: 1.4;
  }
  /* What's above the list (title, words, field) takes about 37rem; the list keeps at least two rows. */
  .choices-scroll {
    max-height: max(10rem, calc(100dvh - 37rem));
    overflow-y: auto;
  }
</style>
