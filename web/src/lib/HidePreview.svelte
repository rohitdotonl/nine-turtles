<!--
  Settings › Hiding, under the field (SPEC section 27, decision 0216): as the
  reader types, what the word would hide, before anything is hidden: how many
  unread articles, the newest few with who wrote them and whether the word is
  in the title or the text, and how many more. It asks a moment after typing
  stops, so a word is asked about once; a slower answer for an older word is
  dropped. Only the first line is spoken, politely.
-->
<script lang="ts">
  import { previewLine, previewRule, previewWhere, type Preview } from "./rules";
  import { untitledOpening } from "./shapes";

  let {
    words,
    feedId,
  }: {
    /** What's in the field, tidied as Add tidies it. */
    words: string;
    /** The person the word is for; null for everyone. */
    feedId: number | null;
  } = $props();

  /** How long typing rests before the word is asked about, in milliseconds. */
  const REST = 200;

  let preview: Preview | undefined = $state();
  let asked = 0;

  $effect(() => {
    const typed = words;
    const person = feedId;
    const turn = ++asked;
    if (!typed) {
      preview = undefined;
      return;
    }
    const wait = setTimeout(async () => {
      const seen = await previewRule(typed, person);
      if (turn === asked) preview = seen;
    }, REST);
    return () => clearTimeout(wait);
  });

  let more = $derived(preview ? preview.count - preview.articles.length : 0);
</script>

<div class="hide-preview flex flex-col">
  <p aria-live="polite" class="font-semibold">{preview ? previewLine(preview) : ""}</p>
  {#if preview && preview.count > 0}
    <ul class="mt-1">
      {#each preview.articles as article (article.id)}
        <li class="preview-row">
          <span class="block font-serif text-[1.0625rem] leading-snug break-words">{untitledOpening(article) ?? article.title}</span>
          <span class="block text-meta text-muted">{previewWhere(article, preview.inTitle)}</span>
        </li>
      {/each}
    </ul>
    {#if more > 0}<p class="text-meta text-muted mt-2">And {more} more.</p>{/if}
    <p class="text-meta text-muted mt-2">Nothing is hidden until you press Add.</p>
  {/if}
</div>

<style>
  .preview-row {
    padding-block: 0.5rem;
  }
</style>
