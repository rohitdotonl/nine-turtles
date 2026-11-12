<!--
  A person's or publication's page (SPEC section 36): one page, the same for
  both, with no Edit mode. On a computer it opens in the reading area, beside
  their list, where an article would; on a phone, as a screen of its own,
  with "‹" back to their list. Opened by their name at the top of the list,
  "Info about …" in the list's More menu, or the i key; `e` (and the old
  Edit addresses) open it with the keyboard on their Name.

  It reads as a book's title page, then its pages, then its colophon. First
  who they are: their name, the one large thing on the screen, set as an
  article's title is; under it, where they publish, each place a link to the
  publisher's own site; a paused or failing source's line; and Write to, the
  page's one solid button, with the address under it (Change beside it).
  Then what's yours of them, where the eye rests: your note and the words
  you highlighted, in the reading serif. Then, quieter, apart, their
  settings as Settings' rows (WhoSettings, TheirPlaces), each changing as
  it's touched. No picture and no color.
-->
<script lang="ts">
  import { tick } from "svelte";
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
    route: Extract<Route, { kind: "about" }>;
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

  // `e` and the old Edit addresses: the same page, with the keyboard on their Name.
  let nameField: HTMLInputElement | undefined = $state();
  let scroller: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (!route.settings) return;
    void tick().then(() => {
      if (!nameField || !scroller) return;
      // Only the page's own scroll moves (scrollIntoView would nudge the whole window too), the field at its middle.
      const field = nameField.getBoundingClientRect();
      const area = scroller.getBoundingClientRect();
      scroller.scrollTop += field.top - area.top - (area.height - field.height) / 2;
      nameField.focus({ preventScroll: true });
    });
  });
</script>

<section aria-label="About {name}" class="who-page flex min-w-0 flex-1 flex-col bg-paper">
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
    {#if phone}
      <!-- One top (DESIGN.md → "The system"): Back in the top line's height. -->
      <div class="top-back"><button type="button" onclick={() => go({ kind: "feed", id: feed.id })} class="btn-quiet nav-back -ml-2 text-ink-2"><Icon name="back" size="alone" />{name}</button></div>
    {/if}

    <!-- Who they are: their name, where they publish, and the one thing to do, write to them. -->
    <header class={["flex flex-col", phone ? "pt-2" : ""]}>
      <h2 bind:this={heading} tabindex="-1" class="who-name">{name}</h2>
      <p class="who-places">
        {#each places as place, index (place.id)}{#if index > 0}<span aria-hidden="true" class="dot">·</span>{/if}{#if place.siteUrl}<a href={place.siteUrl} target="_blank" rel="noopener noreferrer">{placeWords(place)}<span class="sr-only"> (opens in a new tab)</span></a>{:else}<span>{placeWords(place)}</span>{/if}{/each}
      </p>
      <div class="mt-6 flex flex-col gap-3 empty:hidden">
        {#key feed.id}<PausedLine {places} {library} onResumed={onSaved} />{/key}
        <!-- Unkeyed, so a source that just moved to a new number keeps its line saying so (decision 0106). -->
        {#each places as place}<FailingLine feed={place} subject={placeShownAs(place)} label="Find new address" onMoved={(after) => onMoved(place, after)} />{/each}
      </div>
      {#if person}<div class="mt-2"><WriteBack feedId={feed.id} {library} /></div>{/if}
    </header>

    <!-- What's yours of them: where the eye rests. -->
    <div class="mt-12 flex flex-col gap-10">
      <PersonNote place={feed.id} note={places.find((each) => each.note)?.note ?? null} {name} {library} />
      {#if onOpen}<TheirReading feed={feed.id} {onOpen} />{/if}
    </div>

    <!-- Their settings: quieter, at the foot, apart. -->
    <div class="mt-16">
      <WhoSettings {feed} {library} bind:nameField {onSaved} {onFolders} {onHide} {onUnsubscribe}>
        {#snippet sources(save)}<TheirPlaces {feed} {library} onPeople={joined} {save} />{/snippet}
      </WhoSettings>
    </div>
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
