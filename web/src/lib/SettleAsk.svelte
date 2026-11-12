<!--
  The question at an article's end (SPEC section 7, decision 0263), the last
  resort of "could be either": for someone nine turtles couldn't sort, where
  Write back would stand for a person, "Is Jane someone you might write back
  to?" with Yes, a person and No, a publication. Asked once: it stays quietly
  at the end of their articles until answered, then never again. Yes puts
  Write back in its place, with the keyboard on it; No settles them as a
  publication, and the keyboard goes back to the article's title. Either
  has Undo in the reading area's note. Never a pop-up,
  never in the toolbar, never on paper.
-->
<script lang="ts">
  import { tick } from "svelte";
  import type { LoadedLibrary } from "./library.svelte";
  import type { ListNote } from "./listNote";
  import type { Article } from "./shapes";
  import { settle } from "./sorting";

  let {
    article,
    library,
    away = $bindable(),
  }: {
    article: Article;
    library: LoadedLibrary;
    /** What was just settled, with Undo, said in the reading area's note. */
    away?: ListNote;
  } = $props();

  let source = $derived(library.feeds?.find((feed) => feed.id === article.feedId));
  let name = $derived(library.shownAs(source)?.title ?? article.feedTitle);
  let box: HTMLElement | undefined = $state();
  let busy = $state(false);

  async function answer(person: boolean) {
    const place = source;
    if (!place || busy) return;
    const [was, called, around] = [place.why ?? undefined, name, box?.parentElement];
    busy = true;
    const refusal = await settle([{ feed: place.id, kind: person ? "person" : "publication" }]);
    if (!refusal) await library.loadFeeds();
    busy = false;
    if (refusal) {
      away = { words: "That couldn't be saved. Try again in a moment.", refusal: true, close: () => (away = undefined) };
      return;
    }
    away = {
      words: `${called} is ${person ? "a person" : "a publication"} now.`,
      undo: async () => {
        away = undefined;
        const failed = await settle([{ feed: place.id, kind: "publication", why: was }]);
        await library.loadFeeds();
        if (failed) away = { words: "That couldn't be undone. Change it on their page.", refusal: true, close: () => (away = undefined) };
      },
      close: () => (away = undefined),
    };
    // Write back takes the question's place, with the keyboard on it; with no Write back, the
    // keyboard's place goes back to the article's title, never lost with the question.
    await tick();
    const next = person ? around?.querySelector<HTMLElement>(".write-back :is(a, button)") : undefined;
    (next ?? around?.closest("article")?.querySelector<HTMLElement>(".article-title"))?.focus({ preventScroll: !next });
  }
</script>

{#if source?.open}
  <div bind:this={box} role="group" aria-labelledby="settle-ask" class="settle-ask" lang="en">
    <p id="settle-ask" class="text-center text-ink-2">Is <bdi>{name}</bdi> someone you might write back to?</p>
    <div class="flex flex-wrap justify-center gap-3">
      <button type="button" class="btn" aria-disabled={busy} onclick={() => void answer(true)}>Yes, a person</button>
      <button type="button" class="btn" aria-disabled={busy} onclick={() => void answer(false)}>No, a publication</button>
    </div>
  </div>
{/if}

<style>
  /* Where Write back stands for a person: centred under the article, in the app's own type. */
  .settle-ask {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-top: 2rem;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: 1.5;
  }
</style>
