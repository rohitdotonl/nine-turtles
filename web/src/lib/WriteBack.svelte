<!--
  Write back (SPEC section 37, decision 0147): at the end of every article of
  someone the reader follows, under its closing rule, one outlined button
  with a paper plane, as Mark all as read ends a list (`quiet`, decision
  0242), "Write back to Tomas Berg" (their full name, the one in the sidebar;
  the owner's core path, points 6 and 7), with the address it writes to under
  it: the way on, quieter than the writing it follows. It opens
  the reader's own email app with the address and "Re: the title" filled in;
  nine turtles never sends or reads that email.

  On their page (no article), the same button, solid there, says "Write to
  Tomas Berg", under their name, and opens the email app with the address only and an
  empty subject (point 9).

  When nine turtles doesn't know their address (neither their feed nor its
  articles' text gives one), the button opens a small box in place, as Add a
  source does, and nine turtles looks on their site once for it (decision
  0168: their home page and one contact or about page, by the server, never
  twice for the same writer). What it finds fills in the field for the reader
  to check; else "Find it on their site" (their website, in a new tab), one
  field to paste it in, Write back and Not now. The address is kept for the person (their page
  shows it, Change beside it changes it), so it's asked for once. The email app
  opens at once, while the address is being kept.

  The paper plane, its key (`w`), a row's menu and the menu beside chosen words do the same
  (`start`). Started while this is off screen, "Opening your email app…" is said at the reading
  area's foot instead, where the reader is (`away`, drawn by the article's AwayNote; decision 0229).

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
  import type { ListNote } from "./listNote";
  import type { Article } from "./shapes";
  import { aboutLine, addressFor, keepAddress, lookOnTheirSite, looksLikeAddress, quotedBody, siteOf, writeBackLink, writesBack } from "./writeBack";

  let {
    article,
    feedId,
    library,
    quotes = () => [],
    quiet = false,
    within,
    away = $bindable(),
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
    /** The article's scroller, to tell whether this is on screen. */
    within?: HTMLElement;
    /** Started while this is off screen (the paper plane, `w`): what to say at the reading area's foot instead (decision 0229). */
    away?: ListNote;
  } = $props();

  let source = $derived(library.feeds?.find((feed) => feed.id === (article?.feedId ?? feedId)));
  /** Their place, when they're someone to write to: a publication has none (decision 0192). */
  let place = $derived(writesBack(source) ? source : undefined);
  let name = $derived(plainSourceName(library.shownAs(place)?.title ?? article?.feedTitle ?? ""));
  let address = $derived(place && addressFor(place, library.feeds ?? []));
  let site = $derived(siteOf(place, article?.link));
  /** On their page: "Write to", an empty subject, under their name on the page's left edge. */
  let verb = $derived(article ? "Write back to" : "Write to");
  let subject = $derived(article ? aboutLine(article) : "");
  /** What the email starts with: the words of Write back about this, else every highlight. */
  let chosen: string[] | undefined = $state();
  let quoted = $derived(article ? (chosen ?? quotes()) : []);

  let asking = $state(false);
  /** On their page: the address is being changed, in the same box, saved without writing. */
  let changing = $state(false);
  let changer: HTMLButtonElement | undefined = $state();
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
  /** The email app was asked to open (decision 0229): a line under the address says so, with Copy their address in case nothing opened.
   * A polite live line, not a second "status": the toolbar's line is the pane's one status. */
  let opening = $state(false);
  let copied = $state("");
  let copyFailed = $state(false);
  // Back from the email app: the page was hidden while it opened, so the line has done its job.
  $effect(() => {
    const back = () => document.visibilityState === "visible" && ((opening = false), (away = undefined));
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  });

  /** Copy their address, saying how it went here, or in the note at the reading area's foot when that's where it was pressed. */
  async function copyAddress() {
    const done = await navigator.clipboard.writeText(address ?? "").then(
      () => true,
      () => false,
    );
    copyFailed = !done;
    copied = done ? "Copied." : `The address couldn't be copied. It's ${address}: select it and copy it yourself.`;
    if (away) away = { words: copied, refusal: copyFailed, close: () => (away = undefined) };
  }

  /** Whether all of this, and so the line under the button, is on screen in the article's scroller. */
  let root: HTMLDivElement | undefined = $state();
  function shown(): boolean {
    if (!root || !within) return true;
    const it = root.getBoundingClientRect();
    const view = within.getBoundingClientRect();
    return it.top >= view.top && it.bottom + 64 <= view.bottom;
  }

  // Another article starts with the button, not a half-typed address.
  $effect(() => {
    void (article?.id ?? feedId);
    asking = false;
    changing = false;
    looked = undefined;
    typed = "";
    message = "";
    chosen = undefined;
    opening = false;
    away = undefined;
    copied = "";
    copyFailed = false;
  });

  /** Write back: the email app, or the box asking for their address. `about`: the words to quote, else every highlight. */
  export async function start(about?: string[]) {
    if (!place) return;
    chosen = about;
    if (address) {
      // Off screen, the line under the button would answer where nobody sees it: the reading area's foot says it too. Screen readers hear it from the line, which is always in the page.
      away = shown() ? undefined : { words: "Opening your email app… Nothing opened?", retry: () => void copyAddress(), retryWord: "Copy their address", close: () => (away = undefined) };
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

  /** Change, beside the address on their page: the box opens with it, to correct or replace. */
  async function change() {
    typed = address ?? "";
    message = "";
    changing = true;
    await tick();
    field?.select();
  }

  async function keep(event: SubmitEvent) {
    event.preventDefault();
    if (!place || busy) return;
    message = "";
    // Emptied, it forgets the reader's own, and the one their feed gives (if any) is used again.
    if (typed.trim() && !looksLikeAddress(typed)) {
      message = "That doesn't look like an email address. Check it and try again.";
      field?.focus();
      return;
    }
    busy = true;
    const problem = await keepAddress(place.id, typed);
    if (!problem) await library.loadFeeds();
    busy = false;
    if (problem) return void (message = problem);
    changing = false;
    typed = "";
    await tick();
    // Emptied, no address is shown, so no Change: the keyboard goes to Write to instead.
    (changer ?? opener)?.focus();
  }

  async function notNow() {
    if (changing) {
      changing = false;
      message = "";
      await tick();
      return (changer ?? opener)?.focus();
    }
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
  <div bind:this={root} class={["write-back", !article && "on-page"]} lang="en">
    {#if changing}
      <AddressBox
        title={`${name}'s email address`}
        {site}
        looked={undefined}
        showingFound={false}
        saved={false}
        submit="Save"
        {busy}
        {message}
        foot="Write to and Write back open your own email app with this address."
        say="Correct it, or paste a new one."
        bind:typed
        bind:field
        onsubmit={keep}
        onNotNow={() => void notNow()}
        onEscape={() => void notNow()}
      />
    {:else if asking}
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
        onEscape={() => void notNow()}
      />
    {:else if address}
      <a class={quiet ? "btn" : "btn-primary"} bind:this={written} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} href={writeBackLink(address, subject, quoted)} onclick={() => (opening = true)}><Icon name="send" /><span>{verb} <bdi>{name}</bdi></span></a>
      {#if article}
        <p class="to">{address}</p>
      {:else}
        <!-- On their page the address is theirs to correct, where it's shown. -->
        <p class="to">{address} <button type="button" class="text-link change" bind:this={changer} aria-label="Change {name}'s email address" onclick={() => void change()}>Change</button></p>
      {/if}
      {#if quotedBody(quoted)}<p class="to">Your email starts with the words you {chosen ? "chose" : "highlighted"}.</p>{/if}
      <p class={["opening", !opening && "sr-only"]} aria-live="polite">
        {#if opening}Opening your email app…<br />{#if copied}<span class={["inline-flex items-start gap-2", copyFailed && "text-danger"]}>{#if copyFailed}<span class="mt-px shrink-0"><Icon name="alert" /></span>{/if}{copied}</span>{:else}Nothing opened? <TextButton onclick={copyAddress}>Copy their address</TextButton>{/if}{/if}
      </p>
    {:else}
      <button type="button" class={quiet ? "btn" : "btn-primary"} bind:this={opener} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} onclick={() => void start()}><Icon name="send" /><span>{verb} <bdi>{name}</bdi></span></button>
    {/if}
  </div>
{/if}

<style>
  /* Under the article's closing rule, centred as its end matter is, in the interface's type. */
  .write-back {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
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
  .change {
    margin-left: 0.5rem;
    color: var(--ink-2);
  }
  /* Where it goes, quietly, so the press holds no surprise. */
  .to {
    color: var(--muted);
    font-size: var(--text-meta);
    overflow-wrap: anywhere;
  }
</style>
