<!--
  A person's or publication's page (SPEC section 36, decision 0163): the same
  for both. On a computer it opens in the reading area, beside their list,
  where an article would; on a phone, as a screen of its own, with "‹" back
  to their list. Opened by their name at the top of the list, "Info about …" in
  the list's More menu, or the i key.

  Visiting: their name in Literata with a quiet underlined Edit beside it, so
  Write to is the page's one strong button (decision 0215), their
  blog's own title under it when that isn't their name (one source), then,
  while a source is paused, the line saying so with Resume (PausedLine), then
  "Write to Tomas Berg", the solid button with the paper plane, with the
  address under it (WriteBack, the owner's core path, points 9 and 10), then
  the reader's private note on them (SPEC section 42), then Your highlights
  from their writing (TheirReading, decision 0211; Lately went in 0215, as
  their list already shows their newest), then their
  sources, each by what it is (Blog, Video, Newsletter, Podcast) with a link
  to the publisher's own site, then a quiet "Hide articles about…" (SPEC
  section 27). No
  picture and no color. Edit turns the same page into its settings
  (WhoEdit), and a person's source opens its own settings (SourcePage).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PausedLine from "./PausedLine.svelte";
  import PersonNote from "./PersonNote.svelte";
  import WriteBack from "./WriteBack.svelte";
  import SourcePage from "./SourcePage.svelte";
  import TheirReading from "./TheirReading.svelte";
  import WhoEdit from "./WhoEdit.svelte";
  import type { Notice } from "./feeds";
  import type { Sick } from "./health";
  import type { LoadedLibrary } from "./library.svelte";
  import { PLACE_NAMES, placeShownAs, placesOf } from "./people";
  import type { Route } from "./router";
  import type { Article, Feed } from "./shapes";

  let {
    route,
    feed,
    library,
    phone = false,
    heading = $bindable(),
    go,
    onUnsubscribe,
    onHide,
    onMoved,
    onSaved,
    onFolders,
    onOpen,
  }: {
    route: Extract<Route, { kind: "about" | "edit-feed" | "edit-source" }>;
    /** Their row's place: the one their address and list open at. */
    feed: Feed;
    library: LoadedLibrary;
    phone?: boolean;
    heading?: HTMLHeadingElement;
    go: (next: Route, notice?: Notice) => void;
    /** `removeKept`: what the reader starred or marked of theirs goes too (SPEC section 42). */
    onUnsubscribe: (removeKept: boolean) => Promise<string | undefined>;
    /** "Hide articles about…": Settings › Hiding, with the field set to them ("Only from …"). */
    onHide: () => void;
    /** Find new address moved a source. */
    onMoved: (source: Feed, after: Sick) => void;
    /** Edit or a source's settings were saved: their list refreshes (an unpaused source's newest come back). */
    onSaved: () => void;
    /** Edit put them in a folder just made or chosen: the sidebar opens it. */
    onFolders?: (folders: number[]) => void;
    /** A piece of theirs pressed in Your highlights: it opens, in its list. */
    onOpen?: (article: Article) => void;
  } = $props();

  let places = $derived(placesOf(feed, library.feeds ?? []));
  let name = $derived(library.shownAs(feed)?.title ?? feed.title);
  /** One source whose own title isn't their name ("Notes from Tomas" under Tomas Berg): it shows under the name. */
  let ownTitle = $derived.by(() => {
    const title = places.length === 1 ? places[0]?.siteTitle : undefined;
    return title && title.toLowerCase() !== name.toLowerCase() ? title : undefined;
  });
  let source = $derived(route.kind === "edit-source" ? places.find((place) => place.id === route.source) : undefined);
  const about = $derived({ kind: "about", id: feed.id } as const);
  // Its own name for screen readers, never the same as their list's beside it (which is their name alone).
  let label = $derived(route.kind === "about" ? `About ${name}` : route.kind === "edit-feed" ? `Edit ${name}` : `Source settings for ${name}`);
  const joined = (done: Notice, lead: number) => go({ kind: "feed", id: lead }, done);
</script>

<section aria-label={label} class={["who-page flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper", phone ? "px-5 pt-3 pb-10" : "reading-top scroll-gutter px-5 pb-16 md:px-14"]}>
  <!-- On a computer, the article's own column: its left edge and first line (decision 0219); the page's own text keeps to 36rem, so its lines stay short at large text sizes. -->
  <div class={phone ? "contents" : "reading-column"}>
  <div class="flex w-full max-w-[36rem] flex-col gap-6 font-sans text-base">
    {#if phone && route.kind === "about"}
      <button type="button" onclick={() => go({ kind: "feed", id: feed.id })} class="btn-quiet nav-back -ml-2 self-start text-ink-2"><Icon name="back" size={22} />{name}</button>
    {/if}
    {#if route.kind === "edit-feed"}
      <WhoEdit
        {feed}
        folders={library.folders}
        {library}
        bind:heading
        onDone={(saved) => (saved && onSaved(), go(about))}
        onSource={(id) => go({ kind: "edit-source", id: feed.id, source: id })}
        {onUnsubscribe}
        onPeople={joined}
        onMoved={(after) => onMoved(feed, after)}
        {onFolders}
      />
    {:else if route.kind === "edit-source" && source}
      {#key source.id}
        <SourcePage
          {source}
          {name}
          {library}
          bind:heading
          onDone={(saved) => (saved && onSaved(), go({ kind: "edit-feed", id: feed.id }))}
          onPeople={(done, lead) => joined(done, library.rowOf(lead))}
          onMoved={(after) => onMoved(source!, after)}
        />
      {/key}
    {:else}
      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <!-- The page's heading, a step under the list's title, which also names them. -->
          <h2 bind:this={heading} tabindex="-1" class="min-w-0 font-serif text-xlarge font-semibold break-words text-ink">{name}</h2>
          <button type="button" class="text-link min-w-11 shrink-0 justify-end" aria-label="Edit {name}" onclick={() => go({ kind: "edit-feed", id: feed.id })}>Edit</button>
        </div>
        {#if ownTitle}<p class="-mt-1 font-serif text-large break-words text-ink-2">{ownTitle}</p>{/if}
      </div>
      <!-- Paused, it says so here as above their list, with Resume (decision 0239). -->
      {#key feed.id}<PausedLine {places} {library} onResumed={onSaved} />{/key}
      <WriteBack feedId={feed.id} {library} />
      <!-- The reader's private note on them (SPEC section 42). -->
      <PersonNote place={feed.id} note={places.find((each) => each.note)?.note ?? null} {name} {library} />
      <!-- Your highlights from their writing (decision 0211). -->
      {#if onOpen}<TheirReading feed={feed.id} {onOpen} />{/if}
      <div class="flex flex-col gap-2">
        <h3 class="text-small text-ink-2">{places.length > 1 ? "Sources" : "Source"}</h3>
        <dl class="who-facts">
          {#each places as place (place.id)}
            <dt>{PLACE_NAMES[place.place ?? "blog"]}</dt>
            <dd>
              {#if place.siteUrl}
                <a href={place.siteUrl} target="_blank" rel="noopener noreferrer" class="underline decoration-1 underline-offset-4">{placeShownAs(place)}<span class="sr-only"> (opens in a new tab)</span></a>
              {:else}
                {placeShownAs(place)}
              {/if}
            </dd>
          {/each}
        </dl>
      </div>
      <p class="text-small"><button type="button" class="text-link" onclick={onHide}>Hide articles about…</button></p>
    {/if}
  </div>
  </div>
</section>

<style>
  /* The facts: the muted name of each in one column, its value in full ink beside it. */
  .who-facts {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.5rem 1.5rem;
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.5;
  }
  .who-facts :global(dt) {
    color: var(--muted);
  }
  .who-facts :global(dd) {
    margin: 0;
    color: var(--ink);
    overflow-wrap: anywhere;
  }
</style>
