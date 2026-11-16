<!--
  Their picture at the top of their page (SPEC section 36, decision 0283),
  and the one way to change it: pressed, it opens a small menu, "Choose a
  picture…" and, once one is chosen, "Use the automatic picture". A chosen
  picture is made small here, in the browser (portrait.ts → madeSmall),
  before it's sent. Changing it or going back to the automatic one can be
  undone, in place, as a discarded note can (PersonNote).
-->
<script lang="ts">
  import { tick } from "svelte";
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

  /** The chosen picture as it is now, for Undo; none while it's the automatic one. */
  async function current(): Promise<Blob | null> {
    if (!chosen) return null;
    const response = await api(chosen).catch(() => undefined);
    return response?.ok ? response.blob() : null;
  }

  /** Sends a picture to keep, or none to go back to the automatic one. Answers whether it worked. */
  async function send(picture: Blob | null): Promise<boolean> {
    const response = await api(picture ? `/api/feeds/${feed.id}/picture` : `/api/feeds/${feed.id}/picture/delete`, {
      method: "POST",
      headers: { "content-type": picture ? picture.type : "application/json" },
      body: picture ?? "{}",
      signal: AbortSignal.timeout(15_000),
    }).catch(() => undefined);
    if (response?.ok) await library.loadFeeds();
    return !!response?.ok;
  }

  async function change(picture: Blob | null, done: string) {
    const was = await current();
    if (!(await send(picture))) {
      said = "That didn't work. Try again in a moment.";
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
      said = "That file isn't a picture nine turtles can read. Try a JPEG or PNG.";
      before = undefined;
      return;
    }
    await change(small, "Picture changed.");
  }

  async function undo() {
    const picture = before;
    said = undefined;
    before = undefined;
    if (picture !== undefined) await send(picture);
  }
</script>

<!-- What just happened sits beside the picture, so nothing under it moves. -->
<div class="flex items-center gap-4" lang="en">
  <MoreMenu id="picture-menu" label="Picture of {name}" start groups={groups}>
    {#snippet face()}<Portrait {name} pictures={picturesOf(places)} {person} large />{/snippet}
  </MoreMenu>
  <input bind:this={input} type="file" accept="image/*" class="sr-only" tabindex="-1" aria-hidden="true" onchange={picked} />
  <div class={["flex flex-wrap items-center gap-x-3 text-meta", said === undefined && "sr-only"]}>
    <p role="status">{said ?? ""}</p>
    {#if said !== undefined && before !== undefined}<button type="button" class="btn-quiet -ml-3" bind:this={undoButton} onclick={undo}>Undo</button>{/if}
  </div>
</div>
