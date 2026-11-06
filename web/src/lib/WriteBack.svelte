<!--
  Write back (SPEC section 37, decision 0147): at the end of every article of
  someone the reader follows, under its closing rule, one solid ink button
  with a paper plane, "Write back to Tomas Berg" (their full name, the one in
  the sidebar; the owner's core path, points 6 and 7), with the address it
  writes to under it. It's the only solid button in the reading pane. It opens
  the reader's own email app with the address and "Re: the title" filled in;
  nine turtles never sends or reads that email.

  On their page (no article), the same button says "Write to Tomas Berg",
  under their name, and opens the email app with the address only and an
  empty subject (point 9).

  When nine turtles doesn't know their address (neither their feed nor its
  articles' text gives one), the button opens a small box in place, as Add a
  source does, and nine turtles looks on their site once for it (decision
  0168: their home page and one contact or about page, by the server, never
  twice for the same writer). What it finds fills in the field for the reader
  to check; else "Find it on their site" (their website, in a new tab), one
  field to paste it in, Write back and Not now. The address is kept for the person (their page
  shows it, Edit on their page changes it), so it's asked for once. The email app
  opens at once, while the address is being kept.

  The More menu's "Write back" and its key (`w`) do the same (`start`).

  A publication has none of this (decision 0192): nothing shows, and `start` does nothing.
-->
<script lang="ts">
  import { tip } from "./keyboard";
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { plainSourceName } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import type { Article } from "./shapes";
  import { addressFor, keepAddress, lookOnTheirSite, looksLikeAddress, siteOf, writeBackLink, writesBack } from "./writeBack";

  let {
    article,
    feedId,
    library,
  }: {
    /** The article it writes back about; none on their page, where it writes to them. */
    article?: Article;
    /** On their page: their row's place. */
    feedId?: number;
    library: LoadedLibrary;
  } = $props();

  let source = $derived(library.feeds?.find((feed) => feed.id === (article?.feedId ?? feedId)));
  /** Their place, when they're someone to write to: a publication has none (decision 0192). */
  let place = $derived(writesBack(source) ? source : undefined);
  let name = $derived(plainSourceName(library.shownAs(place)?.title ?? article?.feedTitle ?? ""));
  let address = $derived(place && addressFor(place, library.feeds ?? []));
  let site = $derived(siteOf(place, article?.link));
  /** On their page: "Write to", an empty subject, under their name on the page's left edge. */
  let verb = $derived(article ? "Write back to" : "Write to");
  let subject = $derived(article?.title ?? "");

  let asking = $state(false);
  /** Looking on their site for the address, what it found, that it found none, or couldn't look. */
  let looked: "looking" | "found" | "none" | "couldn't" | undefined = $state();
  let found = $state("");
  let typed = $state("");
  /** The found address is still what's in the field: once the reader changes it, the box is as before. */
  let showingFound = $derived(looked === "found" && typed.trim() === found);
  let busy = $state(false);
  let written: HTMLAnchorElement | undefined = $state();
  let message = $state("");
  let field: HTMLInputElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();

  // Another article starts with the button, not a half-typed address.
  $effect(() => {
    void (article?.id ?? feedId);
    asking = false;
    looked = undefined;
    typed = "";
    message = "";
  });

  /** Write back: the email app, or the box asking for their address. */
  export async function start() {
    if (!place) return;
    if (address) {
      window.location.href = writeBackLink(address, subject);
      return;
    }
    asking = true;
    await tick();
    field?.focus();
    if (!site) return;
    looked = "looking";
    const asked = place.id;
    const answer = await lookOnTheirSite(place.id);
    // The reader may have moved on or closed the box meanwhile.
    if (asked !== place?.id || !asking) return;
    if (!answer.looked) {
      looked = "couldn't";
    } else if (!answer.address) {
      looked = "none";
    } else if (typed.trim()) {
      // They typed one meanwhile: theirs stays, and the line claims nothing.
      looked = undefined;
    } else {
      found = typed = answer.address;
      looked = "found";
    }
  }

  async function notNow() {
    asking = false;
    looked = undefined;
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
    window.location.href = writeBackLink(typed.trim().replace(/^mailto:/i, ""), subject);
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
    looked = undefined;
    typed = "";
    // The keyboard stays where it was: on Write back, now a link to the email app.
    await tick();
    (written ?? opener)?.focus();
  }
</script>

{#if place}
  <div class={["write-back", !article && "on-page"]} lang="en">
    {#if asking}
      <form class="ask flex flex-col gap-4" aria-labelledby="write-back-title" onsubmit={write}>
        <div class="flex flex-col gap-1">
          <p id="write-back-title" class="text-base font-semibold text-ink">{verb} {name}</p>
          <p class="text-small text-ink-2" aria-live="polite">
            {#if looked === "looking"}Looking on their site…{:else if showingFound}Found on their site. Check it, then press {article ? "Write back" : "Write"}.{:else if looked === "none"}No email address on their site. Paste it here and it's saved.{:else if looked === "couldn't"}Their site couldn't be checked for an address. Paste it here and it's saved.{:else}nine turtles doesn't have their address yet. Paste it here and it's saved.{/if}
          </p>
        </div>
        {#if site && !showingFound}
          <!-- Left out once an address is filled in: it would only add a choice. -->
          <a class="btn self-start" href={site} target="_blank" rel="noopener noreferrer"><Icon name="open" size={16} />Find it on their site<span class="sr-only"> (opens in a new tab)</span></a>
        {/if}
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
          <button type="submit" class="btn-primary" aria-disabled={busy}>{article ? "Write back" : "Write"}</button>
          <button type="button" class="btn-quiet" onclick={notNow}>Not now</button>
        </div>
        <p class="text-small text-ink-2">It sends from your own email.</p>
      </form>
    {:else if address}
      <a class="btn-primary" bind:this={written} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} href={writeBackLink(address, subject)}><Icon name="send" size={18} />{verb} {name}</a>
      <p class="to">{address}</p>
    {:else}
      <button type="button" class="btn-primary" bind:this={opener} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} onclick={start}><Icon name="send" size={18} />{verb} {name}</button>
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
  /* On their page: under their name, on the page's left edge, a little closer. */
  .write-back.on-page {
    align-items: flex-start;
    margin-top: 0;
  }
  /* A long name wraps rather than running off a phone. */
  .write-back > .btn-primary {
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
  /* The same quiet bordered box as Add a source, across the text column. */
  .ask {
    align-self: stretch;
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
    text-align: left;
  }
</style>
