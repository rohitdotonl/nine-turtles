<!--
  A person's page (SPEC section 36): what the reading area shows beside a
  person's list until an article is opened. Their name; their places on the
  web, each by what it is (Blog, Video, Newsletter) with a link to the
  publisher's own site; since when the reader follows them; "Is this the same
  person?" when nine turtles has clear evidence; their email address, once
  nine turtles knows it, for writing back (SPEC section 37); the reader's
  private note on them (SPEC section 42); Edit person
  (their name, email address, folders and rarer settings); and Add another
  place. Someone with one blog gets the same page, with one place.

  The same quiet build as the rest of the reading area: Literata for the name,
  one left edge, the facts as a two-column list of muted names and plain
  values, no picture and no color.
-->
<script lang="ts">
  import AddPlace from "./AddPlace.svelte";
  import PersonNote from "./PersonNote.svelte";
  import ReadingTip from "./ReadingTip.svelte";
  import SamePerson from "./SamePerson.svelte";
  import type { Notice } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import { followingSince, PLACE_NAMES, placeShownAs, placesOf } from "./people";
  import type { Feed } from "./shapes";
  import { addressFor, writeBackLink } from "./writeBack";

  let {
    feed,
    library,
    listCount,
    tipSeen,
    onEdit,
    onJoined,
  }: {
    feed: Feed;
    library: LoadedLibrary;
    /** How many articles their list shows, so the page says how to open one only when there is one. */
    listCount: number;
    tipSeen: boolean;
    onEdit: () => void;
    onJoined: (done: Notice, lead: number) => void;
  } = $props();

  let places = $derived(placesOf(feed, library.feeds ?? []));
  let name = $derived(library.shownAs(feed)?.title ?? feed.title);
  let since = $derived(followingSince(places));
  let address = $derived(addressFor(feed, library.feeds ?? []));
</script>

<section aria-label="Article" class="person-page flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
  <div class="flex w-full max-w-[34rem] flex-col gap-8">
    <div class="flex flex-col gap-5">
      <!-- A step under the list's own title, which also names them. -->
      <h3 class="font-serif text-xlarge font-semibold text-ink [overflow-wrap:anywhere]">{name}</h3>
      <dl class="person-facts">
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
        {#if since}
          <dt>Following</dt>
          <dd>{since}</dd>
        {/if}
      </dl>
    </div>
    {#if places[0]}
      <PersonNote place={places[0].id} note={places.find((each) => each.note)?.note ?? null} {name} {library} />
    {/if}
    <SamePerson {feed} {name} {library} {onJoined} />
    <div class="flex flex-col gap-3">
      <AddPlace {feed} {name} {library} {onJoined} />
      <button type="button" class="btn-quiet -ml-3 self-start" onclick={onEdit}>Edit person…</button>
    </div>
    {#if listCount > 0}
      <ReadingTip {tipSeen} />
    {/if}
  </div>
</section>

<style>
  /* On the reading area's own margin, a little above its middle, as an article's title sits. */
  .person-page {
    padding: 14vh 2.5rem 4rem;
  }
  /* The facts: the muted name of each in one column, its value in full ink beside it. */
  .person-facts {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.5rem 1.5rem;
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.5;
  }
  /* The keyboard tip on the page's own left edge, under its last button. */
  .person-page :global(.shortcut-tip) {
    margin-top: 0;
    text-align: left;
  }
  .person-facts :global(dt) {
    color: var(--muted);
  }
  .person-facts :global(dd) {
    margin: 0;
    color: var(--ink);
    overflow-wrap: anywhere;
  }
</style>
