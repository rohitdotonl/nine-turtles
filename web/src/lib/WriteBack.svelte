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
  import AddressBox from "./AddressBox.svelte";
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";
  import { plainSourceName } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import type { Article } from "./shapes";
  import { addressFor, keepAddress, lookOnTheirSite, looksLikeAddress, quotedBody, siteOf, writeBackLink, writesBack } from "./writeBack";

  let {
    article,
    feedId,
    library,
    quotes = () => [],
    quiet = false,
  }: {
    /** The article it writes back about; none on their page, where it writes to them. */
    article?: Article;
    /** On their page: their row's place. */
    feedId?: number;
    library: LoadedLibrary;
    /** The words the reader highlighted in the article: the email starts with them quoted (decision 0205). */
    quotes?: () => string[];
    /** Beside another main action (a card's Find new address): an everyday bordered button, not the solid one. */
    quiet?: boolean;
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
  /** What the email starts with: the words of Write back about this, else every highlight. */
  let chosen: string[] | undefined = $state();
  let quoted = $derived(article ? (chosen ?? quotes()) : []);

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
  /** The email app was asked to open (decision 0229): a line under the address says so, with Copy their address in case nothing opened. */
  let opening = $state(false);
  let copied = $state("");

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address ?? "");
      copied = "Copied.";
    } catch {
      copied = "The address couldn't be copied. Select it above and copy it yourself.";
    }
  }

  // Another article starts with the button, not a half-typed address.
  $effect(() => {
    void (article?.id ?? feedId);
    asking = false;
    looked = undefined;
    typed = "";
    message = "";
    chosen = undefined;
    opening = false;
    copied = "";
  });

  /** Write back: the email app, or the box asking for their address. `about`: the words to quote, else every highlight. */
  export async function start(about?: string[]) {
    if (!place) return;
    chosen = about;
    if (address) {
      window.location.href = writeBackLink(address, subject, quoted);
      chosen = undefined;
      opening = true;
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
    chosen = undefined;
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
    window.location.href = writeBackLink(typed.trim().replace(/^mailto:/i, ""), subject, quoted);
    chosen = undefined;
    opening = true;
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
      <AddressBox
        title={`${verb} ${name}`}
        {site}
        {looked}
        {showingFound}
        saved
        submit={article ? "Write back" : "Write"}
        {quiet}
        {busy}
        {message}
        foot="It sends from your own email."
        bind:typed
        bind:field
        onsubmit={write}
        onNotNow={() => void notNow()}
      />
    {:else if address}
      <a class={quiet ? "btn" : "btn-primary"} bind:this={written} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} href={writeBackLink(address, subject, quoted)} onclick={() => (opening = true)}><Icon name="send" size={18} /><span>{verb} <bdi>{name}</bdi></span></a>
      <p class="to">{address}</p>
      {#if quotedBody(quoted)}<p class="to">Your email starts with the words you {chosen ? "chose" : "highlighted"}.</p>{/if}
      <p class={["opening", !opening && "sr-only"]} role="status">
        {#if opening}Opening your email app…<br />{#if copied}<span>{copied}</span>{:else}Nothing opened? <TextButton onclick={copyAddress}>Copy their address</TextButton>{/if}{/if}
      </p>
    {:else}
      <button type="button" class={quiet ? "btn" : "btn-primary"} bind:this={opener} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} onclick={() => void start()}><Icon name="send" size={18} /><span>{verb} <bdi>{name}</bdi></span></button>
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
  .write-back > .btn-primary,
  .write-back > .btn {
    max-width: 100%;
    white-space: normal;
    text-align: center;
  }
  /* Once pressed: the email app is opening, and the way out if it didn't (decision 0229). */
  .opening {
    margin-top: 0.25rem;
    color: var(--ink-2);
    font-size: var(--text-meta);
    text-align: center;
  }
  .on-page .opening {
    text-align: start;
  }
  /* Where it goes, quietly, so the press holds no surprise. */
  .to {
    color: var(--muted);
    font-size: var(--text-meta);
    overflow-wrap: anywhere;
  }
</style>
