<!--
  The "Wrong turn?" page (SPEC section 4): what an address that isn't one of
  nine turtles' places opens, in place of the app. A small "404 error", then
  nine turtles from the logo: eight walking one way and, a few steps behind,
  one turned the other. The website's 404 page (website/src/404.md) is the
  same page: change both together. Screen readers skip the drawing; the
  words say it all.
-->
<script lang="ts">
  import { onMount } from "svelte";

  let { onBack }: { onBack: () => void } = $props();

  let heading: HTMLHeadingElement | undefined = $state();
  /** Opens the reader's own email app, with the address they reached already written in. */
  const tellMe = `mailto:hello@nineturtles.app?subject=${encodeURIComponent("A link that took a wrong turn")}&body=${encodeURIComponent(`It led to ${location.href}\n\nI found the link here: `)}`;

  onMount(() => {
    document.title = "Page not found · nine turtles";
    heading?.focus();
  });
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-5 bg-paper px-5 py-12 text-center">
  <p class="text-meta tracking-[0.08em] text-muted uppercase">404 error</p>
  <div class="wrong-turn" aria-hidden="true">
    <svg viewBox="-10 -4.5 22 8.5" focusable="false"><path transform="translate(2 0) scale(-1 1)" d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z" /><circle transform="translate(2 0) scale(-1 1)" cx="8.6" cy="0.6" r="2" /></svg>
    <span class="apart"></span>
    {#each { length: 8 }, i (i)}
      <svg viewBox="-10 -4.5 22 8.5" focusable="false"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z" /><circle cx="8.6" cy="0.6" r="2" /></svg>
    {/each}
  </div>
  <h1 tabindex="-1" bind:this={heading} class="font-serif text-display font-semibold outline-none">Wrong turn?</h1>
  <div class="flex max-w-md flex-col gap-4 font-serif text-large text-ink-2">
    <p>There's nothing at this address. It may have moved, or the link may have a typing mistake in it.</p>
    <p>If a link in this app brought you here, <a class="underline underline-offset-4" href={tellMe}>tell me which one</a> and I'll fix it.</p>
    <p class="text-ink">Rohit</p>
  </div>
  <button type="button" class="btn-primary mt-3 rounded-lg" onclick={onBack}>Back to your reading</button>
</main>

<style>
  /* Big enough that the one going the other way is seen at a glance, and still on one line on the narrowest phone. */
  .wrong-turn {
    display: flex;
    align-items: flex-end;
    gap: clamp(4px, 1.2vw, 10px);
    padding-block: 8px 12px;
    color: var(--ink);
  }
  .wrong-turn svg {
    flex: none;
    width: clamp(22px, 6.2vw, 56px);
    height: auto;
    aspect-ratio: 22 / 8.5;
    fill: currentColor;
  }
  .apart {
    flex: none;
    width: clamp(12px, 4vw, 32px);
  }
</style>
