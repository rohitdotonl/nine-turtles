<!--
  Settings › Hiding, under the field (SPEC section 27, decision 0216): as the
  reader types, what the word would hide, before anything is hidden: how many
  unread articles, the newest few with who wrote them and whether the word is
  in the title or the text, and how many more. It asks once typing has rested
  for a moment, and never twice at once: while an answer is on its way, the
  latest word waits for it, and an answer for an older word is dropped. Only
  the first line is spoken, politely (the field names it too). If it can't
  say (offline, a word too long), it shows nothing: it only helps, and Add
  still answers for itself.
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
  const REST = 400;

  let preview: Preview | undefined = $state();
  /** What was last typed, and whether an answer is on its way. */
  let latest: { words: string; feedId: number | null } = { words: "", feedId: null };
  let asking = false;

  /** Asks about the latest word; once the answer comes, asks again if the word changed meanwhile. */
  async function ask() {
    if (asking) return;
    asking = true;
    const asked = latest;
    const seen = await previewRule(asked.words, asked.feedId);
    asking = false;
    if (asked !== latest) {
      if (latest.words) void ask();
      return;
    }
    preview = seen;
  }

  $effect(() => {
    latest = { words, feedId };
    if (!words) {
      preview = undefined;
      return;
    }
    const wait = setTimeout(ask, REST);
    return () => clearTimeout(wait);
  });

  let more = $derived(preview ? preview.count - preview.articles.length : 0);
</script>

<!-- No box of its own, so an empty preview adds no space under the length choices. -->
<div class="contents">
  <p id="hide-preview" aria-live="polite" class={["font-semibold", !preview && "sr-only"]}>{preview ? previewLine(preview) : ""}</p>
  {#if preview && preview.count > 0}
    <ul class="-mt-2">
      {#each preview.articles as article (article.id)}
        <li class="preview-row">
          <span class="block font-serif text-(length:--row-title-size) leading-snug break-words">{untitledOpening(article) ?? article.title}</span>
          <span class="block text-meta text-muted">{previewWhere(article, preview.inTitle)}</span>
        </li>
      {/each}
    </ul>
    {#if more > 0}<p class="text-meta text-muted">And {more} more.</p>{/if}
    <p class="text-meta text-muted">Nothing is hidden until you press Add.</p>
  {/if}
</div>

<style>
  .preview-row {
    padding-block: 0.5rem;
  }
</style>
