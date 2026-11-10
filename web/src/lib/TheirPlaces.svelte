<!--
  Their sources' own settings, on their page under Settings (SPEC section
  36): for someone with two or more, a group of Settings' rows, each source by what it is (Blog, Video, Newsletter,
  Podcast) and its name, with Take out at its end for someone with two or
  more (it becomes someone of its own, with Undo on the next screen) and a
  channel's Include Shorts and Include live streams under it, which change
  the moment they're switched. Under the group, + Add a source (AddPlace),
  for a person with one source the line that says what it adds. Links to
  their sites are under their name, at the page's top.
-->
<script lang="ts">
  import AddPlace from "./AddPlace.svelte";
  import Icon from "./Icon.svelte";
  import { editFeed, refused, type Notice } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import { PLACE_NAMES, placeShownAs, placesOf, putBack, separate } from "./people";
  import type { Feed } from "./shapes";

  let {
    feed,
    library,
    onPeople,
    onSaved,
  }: {
    feed: Feed;
    library: LoadedLibrary;
    /** Joined or taken out: the list it opens on now, with "… · Undo". */
    onPeople: (done: Notice, lead: number) => void;
    onSaved: () => void;
  } = $props();

  const id = $props.id();
  let places = $derived(placesOf(feed, library.feeds ?? []));
  let many = $derived(places.length > 1);
  let name = $derived(library.shownAs(feed)?.title ?? feed.title);
  let person = $derived((feed.kind ?? "person") === "person" || feed.person != null);
  let message = $state("");
  let busy = $state(false);

  async function setVideos(place: Feed, changes: { shorts?: boolean; liveStreams?: boolean }) {
    message = "";
    const refusal = await editFeed(place.id, changes);
    await library.loadFeeds();
    if (refusal) message = refused(refusal, "feed");
    else onSaved();
  }

  /** Take out: this source stands on its own again, with Undo on its list. */
  async function takeOut(place: Feed) {
    if (busy) return;
    busy = true;
    message = "";
    const { refusal, before } = await separate(place.id);
    if (refusal) {
      busy = false;
      message = refusal;
      return;
    }
    await library.loadFeeds();
    busy = false;
    const undo = async () => {
      const problem = await putBack(before);
      await library.loadFeeds();
      return problem;
    };
    onPeople({ message: `${placeShownAs(place)} is on its own now.`, undo }, place.id);
  }
</script>

{#if many}
  <section class="mt-8 flex flex-col gap-2" aria-labelledby="{id}-heading" lang="en">
    <h3 id="{id}-heading" class="label">Sources</h3>
    <div class="inset-group">
      {#each places as place (place.id)}
        <div class="inset-row setting source-row">
          <!-- Its name over its kind, as a setting's name over its description. -->
          <span class="setting-words min-w-0">
            <span class="setting-name break-words">{placeShownAs(place)}</span>
            <span class="setting-hint">{PLACE_NAMES[place.place ?? "blog"]}</span>
          </span>
          {#if many}
            <button type="button" class="text-link shrink-0" aria-disabled={busy} title="It becomes a person or publication of its own. You can undo it straight afterwards." onclick={() => void takeOut(place)}>Take out<span class="sr-only"> {placeShownAs(place)} of {name}</span></button>
          {/if}
        </div>
        {#if place.sortsVideos}
          <!-- A YouTube channel (decision 0144): both off by default, changed the moment they're switched. -->
          <div class="inset-row setting nested">
            <div class="setting-words">
              <span class="setting-name" aria-hidden="true">Include Shorts</span>
              <span id="{id}-{place.id}-shorts-hint" class="setting-hint">YouTube's short, upright videos. Sorted by YouTube's own lists, so one may slip through now and then.</span>
            </div>
            <label class="switch-target -my-2 -mr-2"><input type="checkbox" role="switch" class="switch" aria-label="Include Shorts" aria-describedby="{id}-{place.id}-shorts-hint" checked={place.shorts === true} onchange={(event) => void setVideos(place, { shorts: event.currentTarget.checked })} /></label>
          </div>
          <div class="inset-row setting nested">
            <div class="setting-words">
              <span class="setting-name" aria-hidden="true">Include live streams</span>
              <span id="{id}-{place.id}-live-hint" class="setting-hint">Streams, and their recordings once they end.</span>
            </div>
            <label class="switch-target -my-2 -mr-2"><input type="checkbox" role="switch" class="switch" aria-label="Include live streams" aria-describedby="{id}-{place.id}-live-hint" checked={place.liveStreams === true} onchange={(event) => void setVideos(place, { liveStreams: event.currentTarget.checked })} /></label>
          </div>
        {/if}
      {/each}
    </div>
    <p role="status" class={["inset-foot flex items-start gap-2 text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{/if}{message}
    </p>
  </section>
{/if}
{#if person}
  <div class={["flex flex-col", many ? "mt-1" : "mt-3"]}>
    <AddPlace {feed} {name} {library} invite={!many} quiet onJoined={onPeople} />
  </div>
{/if}

<style>
  /* Take out keeps to the row's end, and drops under the name only when big text leaves no room beside it. */
  .source-row > .setting-words {
    flex: 1 1 10rem;
  }
  .nested {
    padding-left: 2rem;
  }
  .nested::before {
    left: 2rem !important;
  }
</style>
