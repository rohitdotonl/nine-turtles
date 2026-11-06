<!--
  "Or try one" in the welcome (SPEC section 2, decision 0198): three example addresses as quiet
  typographic rows, the kind in small spaced capitals, the address, and "Try" at the end, parted by
  hairlines with no fill, so nothing here competes with Add. Pressing one follows it at once; the
  welcome then shows that person's newest post, set in the reading serif as a page is, with a thin
  rule in the ink at its left, the examples not yet pressed under it, and Start reading, an
  outlined button, as the way into the app.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Route } from "./router";
  import { examplesLeft, trying, tryExample, type Example } from "./welcomeTry.svelte";

  let {
    follow,
    onTried,
  }: {
    follow: (event: MouseEvent, next: Route) => void;
    onTried: () => void;
  } = $props();

  let busy = $state("");
  let message = $state("");
  let left = $derived(examplesLeft());

  async function press(example: Example) {
    if (busy) return;
    busy = example.address;
    message = "";
    const problem = await tryExample(example);
    busy = "";
    if (problem) message = problem;
    else onTried();
  }

  const CAPS = "text-[0.6875rem] leading-[1.3] font-semibold tracking-[0.1em] uppercase text-muted";
</script>

<div class="mt-2 mb-4 flex flex-col gap-8 self-stretch text-left">
  {#if trying.current}
    {@const { feed, latest } = trying.current}
    <!-- Their newest post, right here: the moment a feed makes sense. -->
    <article aria-labelledby="tried-name" class="flex flex-col gap-2 border-l-2 border-ink pl-5">
      <h3 id="tried-name" class={CAPS}>{latest ? `Newest from ${feed.title}` : feed.title}</h3>
      {#if latest}
        <a
          href={`/people/${feed.id}`}
          onclick={(event) => follow(event, { kind: "feed", id: feed.id })}
          class="font-serif text-heading leading-tight font-semibold break-words text-ink underline decoration-1 underline-offset-4 [text-decoration-color:color-mix(in_srgb,currentColor_30%,transparent)] hover:[text-decoration-color:currentColor]">{latest}</a
        >
      {/if}
      <p class="text-small text-ink-2">You're following {feed.title}. What they write next will be waiting for you here.</p>
    </article>
    <a href="/unread" onclick={(event) => follow(event, { kind: "view", view: "unread" })} class="btn self-start">Start reading</a>
  {/if}
  {#if left.length > 0}
    <section aria-labelledby="try-head" class="flex flex-col gap-2">
      <h3 id="try-head" class={CAPS}>{trying.current ? "Try another" : "Or try one"}</h3>
      <ul class="m-0 flex list-none flex-col p-0">
        {#each left as example (example.address)}
          <li class="try-row">
            <button type="button" aria-disabled={busy !== ""} onclick={() => press(example)} class="group flex min-h-14 w-full cursor-pointer items-center gap-4 py-2 text-left">
              <span class={["w-24 shrink-0", CAPS]}>{example.kind}</span>
              <span class="min-w-0 flex-1 truncate text-ink">{example.address}</span>
              <span class="try-word shrink-0 text-small text-ink-2">{busy === example.address ? "Adding…" : "Try"}<span class="sr-only"> {example.address}</span></span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>{#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}</p>
</div>

<style>
  .try-row {
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }
  .try-row:last-child {
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }
  .try-word {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
  }
  .group:hover .try-word {
    text-decoration-color: currentColor;
  }
</style>
