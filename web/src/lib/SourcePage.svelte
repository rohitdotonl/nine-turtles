<!--
  One source's own settings (SPEC section 36, decision 0163), opened from a
  person's Edit by the source's ›: what kind of source it is, its settings
  (SourceFields), and, at the foot, "Take out of Alpha", which makes it a
  person or publication of its own, with Undo on the next screen. Done saves
  and goes back to Edit; "‹ Edit Alpha" or Escape goes back unchanged.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import SourceFields from "./SourceFields.svelte";
  import { editFeed, refused, type Notice } from "./feeds";
  import type { Sick } from "./health";
  import type { LoadedLibrary } from "./library.svelte";
  import { PLACE_NAMES, placeShownAs, putBack, separate } from "./people";
  import type { Check, Feed, PlaceKind } from "./shapes";

  let {
    source,
    name,
    library,
    river = false,
    heading = $bindable(),
    onDone,
    onPeople,
    onAddRule,
    onMoved,
  }: {
    source: Feed;
    /** The person's name, for "Take out of Alpha". */
    name: string;
    library: LoadedLibrary;
    river?: boolean;
    heading?: HTMLHeadingElement;
    /** Back to the person's Edit, saved or not. */
    onDone: (saved: boolean) => void;
    /** Taken out: the list it opens on now, with "… · Undo". */
    onPeople: (done: Notice, lead: number) => void;
    onAddRule: () => void;
    onMoved: (feed: Sick) => void;
  } = $props();

  const formId = $props.id();
  const start = (() => source)();
  let place: PlaceKind = $state(start.place ?? "blog");
  let flows = $state(start.river);
  let check: Check = $state(start.check);
  let openOnSite = $state(start.openOnSite);
  let paused = $state(start.pausedAt != null);
  let shorts = $state(start.shorts === true);
  let liveStreams = $state(start.liveStreams === true);
  let busy = $state(false);
  let message = $state("");

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    message = "";
    const refusal = await editFeed(source.id, { ...(place !== start.place ? { place } : {}), river: flows, check, openOnSite, paused, ...(source.sortsVideos ? { shorts, liveStreams } : {}) });
    if (!refusal) await library.loadFeeds();
    busy = false;
    if (refusal) message = refused(refusal, "feed");
    else onDone(true);
  }

  /** "Take out of Alpha": this source stands on its own again, with Undo on its list. */
  async function takeOut() {
    if (busy) return;
    // Kept now: once it's on its own, it's no longer this person's, so `source` comes back empty.
    const taken = source;
    busy = true;
    message = "";
    const { refusal, before } = await separate(taken.id);
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
    onPeople({ message: `${placeShownAs(taken)} is on its own now`, undo }, taken.id);
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex flex-col gap-1">
    <button type="button" onclick={() => onDone(false)} title="Back to Edit {name} (Esc)" class="btn-quiet nav-back -ml-2 self-start text-ink-2"><Icon name="back" size={20} />Edit {name}</button>
    <div class="flex items-center justify-between gap-3">
      <h2 bind:this={heading} tabindex="-1" class="min-w-0 font-serif text-heading font-semibold break-words text-ink">
        {PLACE_NAMES[source.place ?? "blog"]}<span class="font-normal text-muted"> · {placeShownAs(source)}</span>
      </h2>
      <button type="submit" form={formId} aria-disabled={busy} class="btn-primary shrink-0">Done</button>
    </div>
  </div>

  <form id={formId} onsubmit={save} class="flex flex-col gap-5">
    <SourceFields feed={source} {river} bind:place bind:flows bind:check bind:openOnSite bind:paused bind:shorts bind:liveStreams {onAddRule} {onMoved} />

    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>

    <div class="flex flex-col gap-1.5">
      <button type="button" class="btn self-start" aria-disabled={busy} aria-describedby="{formId}-take-out" onclick={takeOut}>Take out of {name}</button>
      <span id="{formId}-take-out" class="field-help mt-0">It becomes a person or publication of its own. You can undo it straight afterwards.</span>
    </div>
  </form>
</div>
