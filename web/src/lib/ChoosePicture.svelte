<!--
  Their picture at the top of their page (SPEC section 36, decision 0284),
  and the one way to change it: pressed, it opens a small menu, "Choose a
  picture…" and, once one is chosen, "Use the automatic picture". A chosen
  picture is made small here, in the browser (portrait.ts → madeSmall),
  before it's sent. Changing it or going back to the automatic one can be
  undone, in place, as a discarded note can (PersonNote).
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import Portrait from "./Portrait.svelte";
  import type { LoadedLibrary } from "./library.svelte";
  import { chosenPicture, madeSmall, picturesOf } from "./portrait";
  import type { Feed } from "./shapes";
  import { api } from "./updates.svelte";

  let { feed, places, name, person, library }: { feed: Feed; places: Feed[]; name: string; person: boolean; library: LoadedLibrary } = $props();

  let input: HTMLInputElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();
  /** What just happened, with Undo beside it, until the next change. */
  let said: string | undefined = $state();
  /** The picture to put back on Undo: the one chosen before, or none (the automatic one). */
  let before: Blob | null | undefined = $state();

  let chosen = $derived(chosenPicture(places));
  let groups: MenuGroup[] = $derived([
    {
      items: [
        { label: "Choose a picture…", onSelect: () => input?.click() },
        ...(chosen ? [{ label: "Use the automatic picture", onSelect: () => change(null, "Back to the automatic picture.") }] : []),
      ],
    },
  ]);

  /** The chosen picture as it is now, for Undo; none while it's the automatic one; undefined if it couldn't be fetched. */
  async function current(): Promise<Blob | null | undefined> {
    if (!chosen) return null;
    const response = await api(chosen).catch(() => undefined);
    return response?.ok ? response.blob() : undefined;
  }

  /** Sends a picture to keep, or none to go back to the automatic one. Answers whether it worked, or that the reader keeps too many already. */
  async function send(picture: Blob | null): Promise<boolean | "full"> {
    const response = await api(picture ? `/api/feeds/${feed.id}/picture` : `/api/feeds/${feed.id}/picture/delete`, {
      method: "POST",
      headers: { "content-type": picture ? picture.type : "application/json" },
      body: picture ?? "{}",
      signal: AbortSignal.timeout(15_000),
    }).catch(() => undefined);
    if (response?.ok) await library.loadFeeds();
    return response?.status === 413 ? "full" : !!response?.ok;
  }

  const FAILED = "That didn't work. Try again in a moment.";

  async function change(picture: Blob | null, done: string) {
    // The picture there now, so Undo can put it back; without it, nothing changes, so nothing is lost.
    const was = await current();
    const sent = was === undefined ? false : await send(picture);
    if (sent !== true) {
      said = sent === "full" ? "There’s no room for more pictures. Use the automatic picture for someone else first." : FAILED;
      before = undefined;
      return;
    }
    said = done;
    before = was;
    await tick();
    undoButton?.focus();
  }

  async function picked() {
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (!file) return;
    const small = await madeSmall(file);
    if (!small) {
      said = "nine turtles couldn't open that file. Try a photo saved as JPEG, PNG or WebP.";
      before = undefined;
      return;
    }
    await change(small, "Picture changed.");
  }

  async function undo() {
    const picture = before;
    if (picture === undefined) return;
    if ((await send(picture)) !== true) {
      // Undo stays, to try again.
      said = FAILED;
      return;
    }
    said = undefined;
    before = undefined;
  }
</script>

<!-- What just happened sits beside the picture, so nothing under it moves. -->
<div class="flex items-center gap-4" lang="en">
  <MoreMenu id="picture-menu" label="Change picture of {name}" start groups={groups}>
    {#snippet face()}
      <span class="relative block">
        <Portrait {name} pictures={picturesOf(places)} {person} large />
        <!-- A pencil on the circle's edge says it can be changed, as a contact card's does. -->
        <span class="pencil"><Icon name="edit" /></span>
      </span>
    {/snippet}
  </MoreMenu>
  <input bind:this={input} type="file" accept="image/*" class="sr-only" tabindex="-1" aria-hidden="true" onchange={picked} />
  <div class={["flex flex-wrap items-center gap-x-3 text-meta", said === undefined && "sr-only"]}>
    <p role="status">{said ?? ""}</p>
    {#if said !== undefined && before !== undefined}<button type="button" class="btn-quiet -ml-3" bind:this={undoButton} onclick={undo}>Undo</button>{/if}
  </div>
</div>

<style>
  /* A small round badge on the circle's lower right, the page's own color with a hairline edge, the pencil in the ink; under a pointer, the grouped rows' tone. */
  .pencil {
    position: absolute;
    right: -0.25rem;
    bottom: -0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9999px;
    border: 1px solid var(--line);
    background-color: var(--paper);
    color: var(--ink);
  }
  @media (hover: hover) {
    :global(.face:hover) .pencil {
      background-color: var(--group, var(--list));
    }
  }
</style>
