<!--
  A person's or publication's page (SPEC section 36), the same for both, with
  no Edit mode: a page about them, and their settings on a page of its own,
  one press away (decision 0267). On a computer both open in the reading
  area, beside their list, where an article would; on a phone, as a screen of
  its own, with "‹" back. Opened by their name at the top of the list, "Info
  about …" in the list's More menu, or the i key; `e` (and the old Edit
  addresses) open their settings.

  Their page is who they are, then what's yours of them. First their name,
  the one large thing on the screen, set as an article's title is; under it,
  where they publish, each place a link to the publisher's own site; a paused
  or failing source's line; and Write to, with the address under it (Change
  beside it). Then one card holding your note and the words you highlighted.
  Last, one row, Settings ›. No picture and no color.

  Their settings (`route.settings`) are Settings' rows (WhoSettings,
  TheirPlaces), each changing as it's touched, under the title "Settings"
  with "‹ their name" above it: it and Escape go back to their page, with
  the keyboard on the row that opened it, as one of Settings' own pages does.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import PausedLine from "./PausedLine.svelte";
  import PersonNote from "./PersonNote.svelte";
  import WriteBack from "./WriteBack.svelte";
  import FailingLine from "./FailingLine.svelte";
  import TheirPlaces from "./TheirPlaces.svelte";
  import TheirReading from "./TheirReading.svelte";
  import WhoSettings from "./WhoSettings.svelte";
  import type { Notice } from "./feeds";
  import type { Sick } from "./health";
  import type { LoadedLibrary } from "./library.svelte";
  import { placeShownAs, placesOf } from "./people";
  import { pathFor, type Route } from "./router";
  import type { Article, Feed } from "./shapes";

  let {
    route,
    feed,
    library,
    phone = false,
    heading = $bindable(),
    go,
    follow,
    onBack,
    onUnsubscribe,
    onHide,
    onMoved,
    onSaved,
    onFolders,
    onOpen,
  }: {
    route: Extract<Route, { kind: "about" }>;
    /** Their row's place: the one their address and list open at. */
    feed: Feed;
    library: LoadedLibrary;
    phone?: boolean;
    heading?: HTMLHeadingElement;
    go: (next: Route, notice?: Notice) => void;
    /** A link pressed: goes there, unless the press was meant for a new tab. */
    follow: (event: MouseEvent, next: Route) => void;
    /** Their settings' way back to their page (Escape does the same). */
    onBack: () => void;
    /** `removeKept`: what the reader starred or marked of theirs goes too (SPEC section 42). */
    onUnsubscribe: (removeKept: boolean) => Promise<string | undefined>;
    /** "Hide articles about…": Settings › Hiding, with the field set to them ("Only from …"). */
    onHide: () => void;
    /** Find new address moved a source. */
    onMoved: (source: Feed, after: Sick) => void;
    /** A setting was saved: their list refreshes (an unpaused source's newest come back). */
    onSaved: () => void;
    /** A folder just made or chosen: the sidebar opens it. */
    onFolders?: (folders: number[]) => void;
    /** A piece of theirs pressed in Your highlights: it opens, in its list. */
    onOpen?: (article: Article) => void;
  } = $props();

  let places = $derived(placesOf(feed, library.feeds ?? []));
  let name = $derived(library.shownAs(feed)?.title ?? feed.title);
  let person = $derived((feed.kind ?? "person") === "person" || feed.person != null);
  /**
   * A place by its own title when that isn't their name ("Garden Letters" under Hal Brennan, decision 0167), else by its
   * website or name; one called just what they are ("xkcd.com" under xkcd.com) by what it is, so the line never repeats the name.
   */
  function placeWords(place: Feed): string {
    const same = (words: string | undefined) => !words || words.trim().toLowerCase() === name.trim().toLowerCase();
    if (!same(place.siteTitle)) return place.siteTitle!;
    const shown = placeShownAs(place);
    if (!same(shown)) return shown;
    if (place.sortsVideos) return "YouTube channel";
    return { blog: "Website", video: "Videos", newsletter: "Newsletter", podcast: "Podcast" }[place.place ?? "blog"];
  }
  const joined = (done: Notice, lead: number) => go({ kind: "feed", id: lead }, done);

  /** Their settings, a page of its own (decision 0267). */
  let theirSettings: Route = $derived({ kind: "about", id: feed.id, settings: true });
  // Each of the two pages starts at its top.
  let scroller: HTMLDivElement | undefined = $state();
  $effect(() => {
    void route.settings;
    if (scroller) scroller.scrollTop = 0;
  });
</script>

<section aria-label={route.settings ? `Settings for ${name}` : `About ${name}`} class="who-page flex min-w-0 flex-1 flex-col bg-paper">
  <!-- On a phone, a hairline under the top once the page has scrolled (decision 0040). -->
  <div use:edge bind:this={scroller} class={["relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto", phone ? "scroller px-5 pb-12" : "scroll-gutter px-5 pb-16 md:px-16"]}>
  {#if !phone}
    <!-- The reading area's own bar, as an article's: its first line, scrolling away with it (decision 0263); on its right, where the article's tools end, the way back to their list. -->
    <div class="reading-bar pane-bar relative z-10 -mx-5 shrink-0 justify-end pr-2 md:-mx-16">
      <button type="button" class="btn-quiet btn-icon" aria-label="Close" title="Close (Esc)" onclick={() => go({ kind: "feed", id: feed.id })}><Icon name="close" size="alone" /></button>
    </div>
  {/if}
  <!-- On a computer, the article's own column: its left edge and first line (decision 0219); the page's own text keeps to 36rem, so its lines stay short at large text sizes. -->
  <div class={phone ? "contents" : "reading-column pt-3"}>
  <div class="flex w-full max-w-[36rem] flex-col font-sans text-base">
    {#if route.settings}
      <!-- Their settings: Back to their page above the title, as one of Settings' own pages has (decision 0120). -->
      <div class="top-back"><button type="button" onclick={onBack} aria-label="Back to {name}" title="Back to {name} (Esc)" class="btn-quiet nav-back -ml-2 text-ink-2"><Icon name="back" size="alone" /><bdi>{name}</bdi></button></div>
      <h2 bind:this={heading} tabindex="-1" class="top-title font-display text-heading font-semibold tracking-[-0.01em]">Settings</h2>
      <div class="mt-4">
        <WhoSettings {feed} {library} {onSaved} {onFolders} {onHide} {onUnsubscribe}>
          {#snippet sources(save)}<TheirPlaces {feed} {library} onPeople={joined} {save} />{/snippet}
        </WhoSettings>
      </div>
    {:else}
    {#if phone}
      <!-- One top (DESIGN.md → "The system"): Back in the top line's height. -->
      <div class="top-back"><button type="button" onclick={() => go({ kind: "feed", id: feed.id })} class="btn-quiet nav-back -ml-2 text-ink-2"><Icon name="back" size="alone" />{name}</button></div>
    {/if}

    <!-- Who they are: their name, where they publish, and the one thing to do, write to them. -->
    <header class={["flex flex-col", phone ? "pt-2" : ""]}>
      <h2 bind:this={heading} tabindex="-1" class="who-name">{name}</h2>
      <p class="who-places">
        {#each places as place, index (place.id)}{#if index > 0}<span aria-hidden="true" class="dot">·</span>{/if}{#if place.siteUrl}<a href={place.siteUrl} target="_blank" rel="noopener noreferrer">{placeWords(place)}<span class="sr-only">{" "}(opens in a new tab)</span></a>{:else}<span>{placeWords(place)}</span>{/if}{/each}
      </p>
      <div class="mt-6 flex flex-col gap-3 empty:hidden">
        {#key feed.id}<PausedLine {places} {library} onResumed={onSaved} />{/key}
        <!-- Unkeyed, so a source that just moved to a new number keeps its line saying so (decision 0106). -->
        {#each places as place}<FailingLine feed={place} subject={placeShownAs(place)} label="Find new address" onMoved={(after) => onMoved(place, after)} />{/each}
      </div>
      {#if person}<div class="mt-2"><WriteBack feedId={feed.id} {library} /></div>{/if}
    </header>

    <!-- What's yours of them, held together in one card: where the eye rests. -->
    <div class="yours">
      <PersonNote place={feed.id} note={places.find((each) => each.note)?.note ?? null} {name} {library} />
      {#if onOpen}<div class="theirs"><TheirReading feed={feed.id} {onOpen} /></div>{/if}
    </div>

    <!-- Their settings: one row that opens a page of its own, built as Settings' rows are (decisions 0120, 0267). -->
    <div class="inset-group mt-4">
      <a href={pathFor(theirSettings)} onclick={(event) => follow(event, theirSettings)} data-settings-row="their-settings" aria-describedby="who-opens-page" class="inset-row inset-action setting">
        <span class="setting-label"><span class="setting-icon" aria-hidden="true"><Icon name="settings" /></span><span class="setting-words"><span class="setting-name">Settings</span></span></span>
        <span class="row-glyph flex items-center"><Icon name="chevron-right" /></span>
      </a>
    </div>
    <span id="who-opens-page" hidden>Opens its own page.</span>
    {/if}
  </div>
  </div>
  </div>
</section>

<style>
  /* The bar is solid, in the page's own color (decision 0040). */
  .reading-bar {
    background-color: var(--paper);
  }
  /*
    Their name, the one large thing on the screen, set as an article's title
    is (decision 0246): Literata's display cut, regular weight, about 38px
    (32px on a phone), balanced over two lines when it needs them.
  */
  .who-name {
    margin: 0;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 2.375rem;
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.012em;
    text-wrap: balance;
    overflow-wrap: break-word;
    outline: none;
  }
  /* Where they publish, under the name in the reading serif and the second ink, each place a link to it, underlined as every link is. */
  .who-places {
    margin: 0.75rem 0 0;
    color: var(--ink-2);
    font-family: var(--font-serif);
    font-size: var(--text-large);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  /* Each place stays whole on its line, unless it alone is wider than the line. Its 44px to touch reaches above and below (first floor). */
  .who-places a {
    position: relative;
  }
  .who-places a::after {
    content: "";
    position: absolute;
    inset: -0.5rem -0.25rem;
  }
  .who-places a,
  .who-places span:not(.dot, .sr-only) {
    display: inline-block;
    max-width: 100%;
  }
  .who-places a {
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
    text-decoration-color: color-mix(in srgb, currentColor 65%, transparent);
  }
  @media (hover: hover) {
    .who-places a:hover {
      text-decoration-color: currentColor;
    }
  }
  .who-places .dot {
    padding-inline: 0.5rem;
  }
  /*
    What's yours of them (decision 0267): your note and your highlights in
    one card, a grouped list's tone and corners with 16px inside, a hairline
    between the two, so the page reads as two things: them, and yours.
  */
  .yours {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 2.5rem;
    padding: 1rem;
    border-radius: var(--radius-hold);
    background-color: var(--group, var(--list));
  }
  .theirs {
    padding-top: 1.25rem;
    border-top: 1px solid var(--line);
  }
  /* The box a note is written in has a frame of its own elsewhere (NoteBox); here the card already holds it, so it has none: never a box in a box. */
  .yours :global(form.note-form) {
    padding: 0;
    border: 0;
  }
  @media (width < 48rem) {
    .who-name {
      font-size: 2rem;
    }
    /* On a phone, one place to a line, so no line ends on a lone dot. */
    .who-places .dot {
      display: none;
    }
    .who-places a,
    .who-places span:not(.dot, .sr-only) {
      display: flex;
      align-items: center;
      width: fit-content;
      min-height: 2.75rem;
    }
    .who-places a::after {
      inset: 0 -0.25rem;
    }
    .who-places {
      margin-top: 0.25rem;
    }
  }
</style>
