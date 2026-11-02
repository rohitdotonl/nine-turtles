<!--
  "Is this the same person?" (SPEC section 36, decision 0145): asked once, only
  on clear evidence (two places on one website of their own), never joined
  without a yes. Yes joins them, with Undo on the line that follows; No, or
  joining any other way, and it's never asked about these places again.
-->
<script lang="ts">
  import type { Notice } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import { join, joinedNotice, notTheSame, sameAs, type Same } from "./people";
  import type { Feed } from "./shapes";

  let { feed, name, library, onJoined }: { feed: Feed; name: string; library: LoadedLibrary; onJoined: (done: Notice) => void } = $props();

  let same: Same | undefined = $state();
  let busy = $state(false);
  let message = $state("");
  $effect(() => {
    const asking = feed.id;
    same = undefined;
    void sameAs(asking).then((found) => {
      if (feed.id === asking) same = found;
    });
  });

  async function yes() {
    if (!same || busy) return;
    busy = true;
    const { refusal, before } = await join([same.feed, feed.id]);
    busy = false;
    if (refusal) {
      message = refusal;
      return;
    }
    const joinedName = same.name;
    await library.loadFeeds();
    onJoined(joinedNotice(joinedName, before, () => library.loadFeeds()));
  }

  async function no() {
    if (!same) return;
    const other = same.feed;
    same = undefined;
    await notTheSame([feed.id, other]);
  }
</script>

{#if same}
  <div class="same-person" role="group" aria-labelledby="same-person-question">
    <p id="same-person-question" class="text-base text-ink">Is {name} the same person as {same.name}?</p>
    <p class="text-small text-muted">Their places are on the same website.</p>
    <div class="mt-3 flex flex-wrap gap-3">
      <button type="button" class="btn" aria-disabled={busy} onclick={yes}>Yes, they're one person</button>
      <button type="button" class="btn-quiet" onclick={no}>No</button>
    </div>
    {#if message}<p role="status" class="mt-2 text-small text-danger">{message}</p>{/if}
  </div>
{/if}

<style>
  .same-person {
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
  }
</style>
