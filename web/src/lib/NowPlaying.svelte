<!--
  The "now playing" bar (SPEC section 34, decision 0111): while an episode is
  in the player, a still, quiet band at the foot of the app, so it keeps
  playing as the reader moves through other articles. From the left: back 15
  seconds, Play or Pause, then the episode's title and podcast (a button that
  opens the episode), and Close, which stops it and keeps where the reader
  was. It takes its own room at the foot of the screen, so it never covers
  anything; on a phone it sits above the article's toolbar. A quiet line
  says what happens by itself ("Playing next: …"), for screen readers too.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Article } from "./feeds";
  import { BACK_SECONDS } from "./podcasts";
  import { back, close, player, toggle } from "./player.svelte";

  let { onOpen, bottom = true }: { onOpen: (article: Article) => void; bottom?: boolean } = $props();
</script>

{#if player.current}
  {@const current = player.current}
  <section aria-label="Now playing" class={["now-playing", bottom && "pb-[env(safe-area-inset-bottom)]"]}>
    <div class="flex items-center gap-1 px-2 py-1">
      <button type="button" class="btn-quiet btn-icon" aria-label="Back {BACK_SECONDS} seconds" title="Back {BACK_SECONDS} seconds" onclick={back}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M4.25 10a5.75 5.75 0 1 0 1.7-4.08" /><path d="M4 3.5v3h3" /><text x="10" y="12.4" text-anchor="middle" font-size="5.6" stroke="none" fill="currentColor" font-family="system-ui, sans-serif">15</text></svg
        >
      </button>
      <button type="button" class="btn-quiet btn-icon text-ink" aria-label={player.playing ? "Pause" : "Play"} title={player.playing ? "Pause" : "Play"} onclick={toggle}>
        {#if player.playing}
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><rect x="5.5" y="4.5" width="3" height="11" rx=".75" fill="currentColor" /><rect x="11.5" y="4.5" width="3" height="11" rx=".75" fill="currentColor" /></svg>
        {:else}
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><path d="M6.5 4.6v10.8a.6.6 0 0 0 .9.5l8.4-5.4a.6.6 0 0 0 0-1L7.4 4.1a.6.6 0 0 0-.9.5z" fill="currentColor" /></svg>
        {/if}
      </button>
      <button type="button" class="now-playing-title" title="Open the episode" onclick={() => onOpen(current.article)}>
        <span class="block truncate text-small text-ink"><span class="sr-only">Open the episode: </span>{current.article.title || "Untitled"}</span>
        <span class="block truncate text-meta text-muted">{player.said || current.article.feedTitle}</span>
      </button>
      <button type="button" class="btn-quiet btn-icon" aria-label="Close the player" title="Close the player" onclick={close}><Icon name="close" size={18} /></button>
    </div>
    <p role="status" class="sr-only">{player.said}</p>
  </section>
{/if}

<style>
  /* Solid, in the list's tone, with the same faint line above it as the phone's toolbar: it ends the page, never covers it. */
  .now-playing {
    flex: none;
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    background-color: var(--list);
  }
  .now-playing-title {
    display: flex;
    min-width: 0;
    min-height: 2.75rem;
    flex: 1 1 auto;
    flex-direction: column;
    justify-content: center;
    padding-inline: 0.5rem;
    border-radius: 0.375rem;
    text-align: left;
    cursor: pointer;
  }
  .now-playing-title:hover {
    background-color: var(--hover);
  }
  @media (forced-colors: active) {
    .now-playing {
      background-color: Canvas;
      border-top-color: CanvasText;
    }
  }
</style>
