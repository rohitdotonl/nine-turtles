<!--
  A person's or publication's page (SPEC section 36, decision 0163): the same
  for both. On a computer it opens in the reading area, beside their list,
  where an article would; on a phone, as a screen of its own, with "‹" back
  to their list. Opened by their name at the top of the list, "Info about …" in
  the list's More menu, or the i key.

  Visiting: their name in Literata with an Edit button beside it, their
  blog's own title under it when that isn't their name (one source), a muted line
  saying what they are (a person or a publication), their folders and since
  when the reader follows them, then their sources, each by what it is (Blog,
  Video, Newsletter, Podcast) with a link to the publisher's own site, and
  the email address Write back writes to, once nine turtles knows it, and
  the reader's private note on them (SPEC section 42), then a quiet
  "Hide articles about…" (SPEC section 27). No
  picture and no color. Edit turns the same page into its settings
  (WhoEdit), and a person's source opens its own settings (SourcePage).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PersonNote from "./PersonNote.svelte";
  import SourcePage from "./SourcePage.svelte";
  import WhoEdit from "./WhoEdit.svelte";
  import type { Notice } from "./feeds";
  import type { Sick } from "./health";
  import type { LoadedLibrary } from "./library.svelte";
  import { followingSince, PLACE_NAMES, placeShownAs, placesOf } from "./people";
  import type { Route } from "./router";
  import type { Feed } from "./shapes";
  import { addressFor, writeBackLink } from "./writeBack";

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
    /** "Hide articles about…": Settings › Hiding, with a new rule for them. */
    onHide: () => void;
    /** Find new address moved a source. */
    onMoved: (source: Feed, after: Sick) => void;
    /** Edit or a source's settings were saved: their list refreshes (an unpaused source's newest come back). */
    onSaved: () => void;
  } = $props();

  let places = $derived(placesOf(feed, library.feeds ?? []));
  let name = $derived(library.shownAs(feed)?.title ?? feed.title);
  let since = $derived(followingSince(places));
  /** One source whose own title isn't their name ("Notes from Tomas" under Tomas Berg): it shows under the name. */
  let ownTitle = $derived.by(() => {
    const title = places.length === 1 ? places[0]?.siteTitle : undefined;
    return title && title.toLowerCase() !== name.toLowerCase() ? title : undefined;
  });
  let address = $derived(addressFor(feed, library.feeds ?? []));
  let folderNames = $derived(library.folders.filter((folder) => places.some((place) => place.folders.includes(folder.id))).map((folder) => folder.name));
  let what = $derived([feed.kind === "publication" ? "A publication" : "A person", folderNames.length > 0 ? `in ${folderNames.join(", ")}` : "", since ? `following ${since}` : ""].filter(Boolean).join(" · "));
  let source = $derived(route.kind === "edit-source" ? places.find((place) => place.id === route.source) : undefined);
  const about = $derived({ kind: "about", id: feed.id } as const);
  // Its own name for screen readers, never the same as their list's beside it (which is their name alone).
  let label = $derived(route.kind === "about" ? `About ${name}` : route.kind === "edit-feed" ? `Edit ${name}` : `Source settings for ${name}`);
  const joined = (done: Notice, lead: number) => go({ kind: "feed", id: lead }, done);
</script>

<section aria-label={label} class={["who-page flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper", phone ? "px-5 pt-3 pb-10" : "px-10 pt-[10vh] pb-16"]}>
  <div class="flex w-full max-w-[36rem] flex-col gap-6">
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
          <button type="button" class="btn shrink-0" aria-label="Edit {name}" onclick={() => go({ kind: "edit-feed", id: feed.id })}>Edit</button>
        </div>
        {#if ownTitle}<p class="-mt-1 font-serif text-large break-words text-ink-2">{ownTitle}</p>{/if}
        <p class="text-small text-muted">{what}</p>
      </div>
      <div class="flex flex-col gap-2">
        <h3 class="text-small text-ink-2">{places.length > 1 ? "Sources" : "Source"}</h3>
        <dl class="who-facts">
          {#each places as place (place.id)}
            <dt>{PLACE_NAMES[place.place ?? "blog"]}</dt>
            <dd>
              {#if place.siteUrl}
                <a href={place.siteUrl} target="_blank" rel="noopener noreferrer" class="underline decoration-1 underline-offset-4">{placeShownAs(place)}</a>
              {:else}
                {placeShownAs(place)}
              {/if}
            </dd>
          {/each}
          {#if address}
            <!-- Where Write back writes to: the reader's email app opens with it. -->
            <dt>Email</dt>
            <dd><a href={writeBackLink(address, "")} class="underline decoration-1 underline-offset-4">{address}</a></dd>
          {/if}
        </dl>
      </div>
      <!-- The reader's private note on them (SPEC section 42). -->
      <PersonNote place={feed.id} note={places.find((each) => each.note)?.note ?? null} {name} {library} />
      <p class="text-small"><button type="button" class="text-link" onclick={onHide}>Hide articles about…</button></p>
    {/if}
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
