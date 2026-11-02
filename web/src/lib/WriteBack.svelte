<!--
  Write back (SPEC section 37, decision 0147): at the end of every article of
  someone the reader follows, under its closing rule, one button, "Write back
  to Alpha", with the address it writes to under it. It opens the reader's own
  email app with the address and "Re: the title" filled in; nine turtles never
  sends or reads that email.

  When nine turtles doesn't know their address (their feed gives none), the
  button opens a small box in place, as Add another place does: one field for
  it, Write back and Not now. The address is kept for the person (their page
  shows it, Edit person changes it), so it's asked for once. The email app
  opens at once, while the address is being kept.

  The More menu's "Write back" and its key (`w`) do the same (`start`).
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { plainSourceName } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import type { Article } from "./shapes";
  import { addressFor, keepAddress, looksLikeAddress, writeBackLink } from "./writeBack";

  let { article, library }: { article: Article; library: LoadedLibrary } = $props();

  let place = $derived(library.feeds?.find((feed) => feed.id === article.feedId));
  let name = $derived(plainSourceName(library.shownAs(place)?.title ?? article.feedTitle));
  let address = $derived(place && addressFor(place, library.feeds ?? []));

  let asking = $state(false);
  let busy = $state(false);
  let written: HTMLAnchorElement | undefined = $state();
  let typed = $state("");
  let message = $state("");
  let field: HTMLInputElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();

  // Another article starts with the button, not a half-typed address.
  $effect(() => {
    void article.id;
    asking = false;
    typed = "";
    message = "";
  });

  /** Write back: the email app, or the box asking for their address. */
  export async function start() {
    if (!place) return;
    if (address) {
      window.location.href = writeBackLink(address, article.title);
      return;
    }
    asking = true;
    await tick();
    field?.focus();
  }

  async function notNow() {
    asking = false;
    message = "";
    await tick();
    opener?.focus();
  }

  async function write(event: SubmitEvent) {
    event.preventDefault();
    if (!place || busy) return;
    message = "";
    if (!looksLikeAddress(typed)) {
      message = typed.trim() ? "That doesn't look like an email address. Check it and try again." : `Type ${name}'s email address first.`;
      field?.focus();
      return;
    }
    // The email app opens while the press still counts as the reader's own; the address is kept meanwhile.
    window.location.href = writeBackLink(typed.trim().replace(/^mailto:/i, ""), article.title);
    busy = true;
    const problem = await keepAddress(place.id, typed);
    if (problem) {
      busy = false;
      message = problem;
      return;
    }
    await library.loadFeeds();
    busy = false;
    asking = false;
    typed = "";
    // The keyboard stays where it was: on Write back, now a link to the email app.
    await tick();
    (written ?? opener)?.focus();
  }
</script>

{#if place}
  <div class="write-back" lang="en">
    {#if asking}
      <form class="ask flex flex-col gap-4" aria-labelledby="write-back-title" onsubmit={write}>
        <div class="flex flex-col gap-1">
          <p id="write-back-title" class="text-base font-semibold text-ink">Write back to {name}</p>
          <p class="text-small text-ink-2">nine turtles doesn't know their email address yet. Type it once and it's kept on their page. Your own email app sends what you write; nine turtles never sends or reads it.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="write-back-address" class="text-small text-ink-2">Their email address</label>
          <input
            id="write-back-address"
            bind:this={field}
            bind:value={typed}
            type="text"
            inputmode="email"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            aria-invalid={message ? "true" : undefined}
            aria-describedby="write-back-message"
            class="field min-w-0"
          />
        </div>
        <p id="write-back-message" role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
          {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
        </p>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="btn-primary" aria-disabled={busy}>Write back</button>
          <button type="button" class="btn-quiet" onclick={notNow}>Not now</button>
        </div>
      </form>
    {:else if address}
      <a class="btn" bind:this={written} href={writeBackLink(address, article.title)}>Write back to {name}</a>
      <p class="to">{address}</p>
    {:else}
      <button type="button" class="btn" bind:this={opener} onclick={start}>Write back to {name}</button>
    {/if}
  </div>
{/if}

<style>
  /* Under the article's closing rule, centred as its end matter is, in the interface's type. */
  .write-back {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    margin-top: 2rem;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: 1.5;
  }
  /* A long name wraps rather than running off a phone. */
  .write-back > .btn {
    max-width: 100%;
    white-space: normal;
    text-align: center;
  }
  /* Where it goes, quietly, so the press holds no surprise. */
  .to {
    color: var(--muted);
    font-size: var(--text-meta);
    overflow-wrap: anywhere;
  }
  /* The same quiet bordered box as Add another place, across the text column. */
  .ask {
    align-self: stretch;
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
    text-align: left;
  }
</style>
