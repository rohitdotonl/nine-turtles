<!--
  What kind of article a list row is, on the row's meta line, in the line's
  own ink: a podcast's episode is a small headphones mark and its length
  (SPEC section 35); a YouTube video, a small screen with a play mark
  (decision 0144). Screen readers hear "Episode" or "Video". Anything else
  shows nothing.
-->
<script lang="ts" module>
  import type { Article } from "./shapes";
  import { youtubeVideo } from "./youtube";

  /** Whether the row shows a kind: a podcast's episode or a YouTube video. */
  export function kindShown(article: Article): boolean {
    return Boolean(article.episode || youtubeVideo(article.link));
  }
</script>

<script lang="ts">
  import Icon from "./Icon.svelte";
  import { length } from "./podcasts";

  /** `first`: nothing shows before it on the line, so its "·" is for screen readers only, a pause after what they hear first. */
  let { article, first = false }: { article: Article; first?: boolean } = $props();
</script>

{#if article.episode}
  <span class="row-kind"><span class={[first && "sr-only"]}>·&nbsp;</span><Icon name="headphones" /><span class="sr-only">Episode</span>{#if article.episodeSeconds}&nbsp;{length(article.episodeSeconds)}{/if}</span>
{:else if youtubeVideo(article.link)}
  <span class="row-kind"><span class={[first && "sr-only"]}>·&nbsp;</span><Icon name="video" /><span class="sr-only">Video</span></span>
{/if}

<style>
  .row-kind {
    flex: none;
    display: flex;
    align-items: center;
  }
</style>
