<!--
  "Add another place" (SPEC section 36): one more place for this person, by
  choosing someone the reader already follows, or by pasting the address of
  their blog, channel or newsletter (followed then and there, as Add a feed
  would). Either way the places become one person, with Undo on the line that
  follows. It opens in place, under its button, and never inside a form of
  its own, so it can sit in Edit person's.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { addFeed, explain, plainSourceName, type Notice } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import { join, joinedNotice } from "./people";
  import type { Feed } from "./shapes";

  let { feed, name, library, onJoined }: { feed: Feed; name: string; library: LoadedLibrary; onJoined: (done: Notice) => void } = $props();

  let open = $state(false);
  let chosen = $state("");
  let address = $state("");
  let busy = $state(false);
  let message = $state("");
  let field: HTMLSelectElement | undefined = $state();

  /** Everyone else the reader follows, A to Z, as the sidebar lists them. */
  let others = $derived((library.rows ?? []).filter((row) => row.id !== feed.id && !(row.places ?? []).includes(feed.id)));

  async function joinWith(other: number) {
    const { refusal, before } = await join([feed.id, other]);
    if (refusal) {
      message = refusal;
      return;
    }
    await library.loadFeeds();
    onJoined(joinedNotice(name, before, () => library.loadFeeds()));
  }

  async function addChosen() {
    if (busy) return;
    message = "";
    if (!chosen) {
      message = "Choose who it is first.";
      return;
    }
    busy = true;
    await joinWith(Number(chosen));
    busy = false;
  }

  async function addAddress() {
    if (busy) return;
    message = "";
    if (!address.trim()) {
      message = "Paste the address of their blog, channel or newsletter first.";
      return;
    }
    busy = true;
    let added = await addFeed(address);
    // A site that offers several: its first, which is nearly always the main one.
    if (added.kind === "choose" && added.choices[0]) added = await addFeed(added.choices[0].url);
    if (added.kind === "added") await joinWith(added.feed.id);
    else if (added.kind === "already") await joinWith(added.feedId);
    else if (added.kind === "problem") message = explain(added.reason);
    else message = "nine turtles couldn't tell which to follow there. Try the address of the blog or channel itself.";
    busy = false;
  }
</script>

{#if !open}
  <button
    type="button"
    class="btn self-start"
    onclick={() => {
      open = true;
      queueMicrotask(() => field?.focus());
    }}><Icon name="plus" size={16} />Add another place</button
  >
{:else}
  <div class="add-place flex flex-col gap-4" role="group" aria-labelledby="add-place-title">
    <p id="add-place-title" class="text-base font-semibold text-ink">Add another place for {name}</p>
    {#if others.length > 0}
      <div class="flex flex-col gap-1.5">
        <label for="add-place-who" class="text-small text-ink-2">Someone you already follow</label>
        <div class="flex flex-wrap gap-2">
          <select id="add-place-who" bind:this={field} bind:value={chosen} class="field min-w-0 flex-1">
            <option value="">Choose…</option>
            {#each others as other (other.id)}
              <option value={String(other.id)}>{plainSourceName(other.title)}</option>
            {/each}
          </select>
          <button type="button" class="btn" aria-disabled={busy} onclick={addChosen}>Join</button>
        </div>
      </div>
    {/if}
    <div class="flex flex-col gap-1.5">
      <label for="add-place-address" class="text-small text-ink-2">{others.length > 0 ? "Or the address of their blog, channel or newsletter" : "The address of their blog, channel or newsletter"}</label>
      <div class="flex flex-wrap gap-2">
        <input
          id="add-place-address"
          bind:value={address}
          type="url"
          inputmode="url"
          autocomplete="off"
          placeholder="youtube.com/@name"
          class="field min-w-0 flex-1"
          onkeydown={(event) => {
            if (event.key !== "Enter") return;
            // Never the form around it (Edit person's Save): this adds the place.
            event.preventDefault();
            void addAddress();
          }}
        />
        <button type="button" class="btn" aria-disabled={busy} onclick={addAddress}>Follow and join</button>
      </div>
    </div>
    <p role="status" class={["flex items-start gap-1.5 text-small", message ? "text-danger" : busy ? "text-muted" : "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{:else if busy}Joining…{/if}
    </p>
    <button type="button" class="btn-quiet self-start" onclick={() => (open = false)}>Not now</button>
  </div>
{/if}

<style>
  .add-place {
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
  }
</style>
