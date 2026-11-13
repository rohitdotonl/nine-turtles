<!--
  Write back (SPEC section 37, decision 0147): at the end of every article of
  someone the reader follows, under its closing rule, one outlined button
  with a paper plane, as Mark all as read ends a list (`quiet`, decision
  0242), "Write back", with "to Tomas Berg, tomas@example.com" (their full
  name, the one in the sidebar, the owner's core path, points 6 and 7; and the
  address it writes to) in a quiet line under it, so a long name never swells
  the button (decision 0260): the way on, quieter than the writing it follows. It opens
  the reader's own email app with the address and "Re: the title" filled in;
  nine turtles never sends or reads that email.

  On their page (no article), the same outlined button says "Write to
  Tomas Berg", under their name, and opens the email app with the address only and an
  empty subject (point 9). Outlined there too (decision 0267): their name leads that page.

  When nine turtles doesn't know their address (neither their feed nor its
  articles' text gives one), the button opens a small box in place, as Add a
  source does, and nine turtles looks on their site once for it (decision
  0168: their home page and one contact or about page, by the server, never
  twice for the same writer). What it finds fills in the field for the reader
  to check; else "look on their site" (their website, in a new tab, a link in its line), one
  field to paste it in, Write back and Not now. The address is kept for the person (their page
  shows it, Change beside it changes it), so it's asked for once. The email app
  opens at once, while the address is being kept.

  Where it opens is this device's choice (decision 0259): the email app (`mailto:`), or, once
  "Write in Gmail" or "Write in Outlook.com" is pressed under it, a new draft there in a new tab.

  Once pressed, one line under it says "Opening your email app…". On a computer the other ways
  to write (Gmail, Outlook.com, copying the address) wait behind two words on that line, "Didn't
  open?", so a press that worked leaves one line and no more (decision 0265).

  The paper plane, its key (`w`), a row's menu and the menu beside chosen words do the same
  (`start`). Started while this is off screen, "Opening your email app…" is said at the reading
  area's foot instead, where the reader is (`away`, drawn by the article's AwayNote; decision 0229).

  A publication has none of this (decision 0192): nothing shows, and `start` does nothing. For
  someone nine turtles couldn't sort, at an article's end, the question stands in its place
  instead (SettleAsk, decision 0264).
-->
<script lang="ts">
  import { tip } from "./keyboard";
  import { tick } from "svelte";
  import AddressBox from "./AddressBox.svelte";
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";
  import SettleAsk from "./SettleAsk.svelte";
  import { plainSourceName } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import type { ListNote } from "./listNote";
  import type { Article } from "./shapes";
  import { aboutLine, addressFor, composeLink, keepAddress, keepMailPlace, lookOnTheirSite, looksLikeAddress, MAIL_NAMES, mailPlace, quotedBody, siteOf, writesBack, type MailPlace } from "./writeBack";

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
    /** Beside another main action (a card's Find new address): the address box's own button is bordered too, not the solid one. */
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
  /** The email app was asked to open (decision 0229): a line under the address says so, with the ways on in case nothing opened.
   * A polite live line, not a second "status": the toolbar's line is the pane's one status. */
  let opening = $state(false);
  /** On a computer, "Didn't open?" was pressed: the other ways to write are shown (decision 0265). */
  let asked = $state(false);
  /** Back from the email app (the page was hidden while it opened): "Opening…" has done its job, but the ways on stay, for an app that opened wrong (decision 0259). */
  let returned = $state(false);
  let copied = $state("");
  let copyFailed = $state(false);
  $effect(() => {
    const back = () => document.visibilityState === "visible" && opening && ((returned = true), (away = undefined));
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  });

  /** Where this device writes email (decision 0259): its email app, or Gmail or Outlook.com in a new tab. */
  let writesIn: MailPlace = $state(mailPlace());
  /** What the last email started with, to start it again in another place. */
  let lastQuotes: string[] = [];
  /** On a computer, every other place; on a touch screen, whose email app always answers, only the way back to it. */
  const computer = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
  let others = $derived((["app", "gmail", "outlook"] as const).filter((other) => other !== writesIn && (computer || other === "app")));
  let where = $derived(writesIn === "app" ? "your email app" : `${MAIL_NAMES[writesIn]} in a new tab`);
  /** What the line asks: on a computer, the two words that open the other ways; on a touch screen, plain words over its one way. */
  let question = $derived(writesIn !== "app" ? "Wrong place?" : computer ? "Didn't open?" : "Nothing opened?");

  /** The email is opening: the line under the button says so, afresh. */
  function pressed(quotes: string[]) {
    lastQuotes = quotes;
    copied = "";
    copyFailed = false;
    returned = false;
    asked = false;
    opening = true;
  }

  /** Opens the new email where this device writes, and says so under the button. */
  function send(to: string, quotes: string[]) {
    const link = composeLink(writesIn, to, subject, quotes);
    if (writesIn === "app") window.location.href = link;
    else window.open(link, "_blank", "noopener,noreferrer");
    pressed(quotes);
  }

  /** Write in another place: kept on this device, and the same email opened there at once. The keyboard goes back to Write back, as the button pressed goes. */
  async function writeIn(other: MailPlace, fromLine = false) {
    keepMailPlace(other);
    writesIn = other;
    if (address) send(address, lastQuotes);
    if (away) away = awayNote();
    if (!fromLine) return;
    await tick();
    written?.focus();
  }

  /** The line's words and buttons, as the note at the reading area's foot says them: on a computer, the other ways wait behind the question there too. */
  function awayNote(): ListNote {
    const close = () => (away = undefined);
    if (computer && !asked) return { words: `Opening ${where}…`, retry: () => ((asked = true), (away = awayNote())), retryWord: question, retryOpens: true, close };
    return {
      words: computer ? question : `Opening ${where}… ${question}`,
      also: others.map((other) => ({ word: `Write in ${MAIL_NAMES[other]}`, press: () => void writeIn(other) })),
      retry: () => void copyAddress(),
      retryWord: "Copy their address",
      close,
    };
  }

  /** Copy their address, saying how it went here, or in the note at the reading area's foot when that's where it was pressed. */
  async function copyAddress(fromLine = false) {
    const done = await navigator.clipboard.writeText(address ?? "").then(
      () => true,
      () => false,
    );
    copyFailed = !done;
    copied = done ? "Copied." : `The address couldn't be copied. It's ${address}: select it and copy it yourself.`;
    if (away) away = { words: copied, refusal: copyFailed, close: () => (away = undefined) };
    // The button pressed goes as the words replace it: the keyboard goes back to Write back.
    if (!fromLine) return;
    await tick();
    written?.focus();
  }

  /** Back to the email app, without writing: always offered under the address while Gmail or Outlook.com is chosen, so a choice is never stuck. */
  async function useApp() {
    keepMailPlace("app");
    writesIn = "app";
    opening = false;
    await tick();
    written?.focus();
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
    returned = false;
    asked = false;
    away = undefined;
    copied = "";
    copyFailed = false;
  });

  /** Write back: the email app, or the box asking for their address. `about`: the words to quote, else every highlight. */
  export async function start(about?: string[]) {
    if (!place) return;
    chosen = about;
    if (address) {
      // Started later than the press (a row's menu, while the article loaded): a browser may block a new tab it didn't see pressed for, so the keyboard goes to Write back for one more press instead.
      if (writesIn !== "app" && navigator.userActivation?.isActive === false) {
        chosen = undefined;
        await tick();
        return written?.focus();
      }
      // Off screen, the line under the button would answer where nobody sees it: the reading area's foot says it too. Screen readers hear it from the line, which is always in the page.
      const offScreen = !shown();
      send(address, quoted);
      away = offScreen ? awayNote() : undefined;
      chosen = undefined;
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
    send(typed.trim().replace(/^mailto:/i, ""), quoted);
    chosen = undefined;
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

<!--
  At an article's end the button stays one short "Write back", whatever the name's length, with who
  it goes to in the quiet line under it (decision 0260); screen readers hear the whole "Write back to
  {name}" as the button's name, so the line under it is theirs only to see. On their page, under
  their name, it says "Write to {name}".
-->
{#snippet label()}
  {#if article}<span>Write back<span class="sr-only">{" "}to <bdi>{name}</bdi></span></span>{:else}<span>{verb} <bdi>{name}</bdi></span>{/if}
{/snippet}

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
        foot="It sends from your own email, and nine turtles keeps the address for next time."
        bind:typed
        bind:field
        onsubmit={write}
        onNotNow={() => void notNow()}
        onEscape={() => void notNow()}
      />
    {:else if address}
      <a class="btn" bind:this={written} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} href={composeLink(writesIn, address, subject, quoted)} target={writesIn === "app" ? undefined : "_blank"} rel={writesIn === "app" ? undefined : "noopener noreferrer"} onclick={() => pressed(quoted)}><Icon name="send" />{@render label()}</a>
      {#if article}
        <p class="to"><span aria-hidden="true">to <bdi>{name}</bdi>,{" "}</span>{address}</p>
      {:else}
        <!-- On their page the address is theirs to correct, where it's shown. -->
        <p class="to">{address} <button type="button" class="text-link change" bind:this={changer} aria-label="Change {name}'s email address" onclick={() => void change()}>Change</button></p>
      {/if}
      {#if writesIn !== "app"}<p class="to">Opens {MAIL_NAMES[writesIn]} in a new tab. <TextButton onclick={() => void useApp()}>Use your email app</TextButton></p>{/if}
      {#if quotedBody(quoted)}<p class="to">Your email starts with the words you {chosen ? "chose" : "highlighted"}.</p>{/if}
      {#snippet ways()}
        <span class="ways"
          >{#each others as other (other)}<button type="button" class="text-link" onclick={() => void writeIn(other, true)}>Write in {MAIL_NAMES[other]}</button>{/each}<button
            type="button"
            class="text-link"
            onclick={() => void copyAddress(true)}>Copy their address</button
          ></span
        >
      {/snippet}
      <p class={["opening-line", !opening && "sr-only"]} aria-live="polite">
        {#if opening}
          {#if !returned}Opening {where}…{" "}{/if}
          {#if copied}
            {#if !returned}<br />{/if}<span class={["inline-flex items-start gap-2", copyFailed && "text-danger"]}>{#if copyFailed}<span class="mt-px shrink-0"><Icon name="alert" /></span>{/if}{copied}</span>
          {:else if computer}
            <!-- One line when the press worked: the other ways wait behind the question (decision 0265). -->
            <button type="button" class="text-link more" aria-expanded={asked} onclick={() => (asked = !asked)}>{question}</button>
            {#if asked}{@render ways()}{/if}
          {:else}
            {#if !returned}<br />{/if}{question}{@render ways()}
          {/if}
        {/if}
      </p>
    {:else}
      <button type="button" class="btn" bind:this={opener} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} onclick={() => void start()}><Icon name="send" />{@render label()}</button>
      {#if article}<p class="to" aria-hidden="true">to <bdi>{name}</bdi></p>{/if}
    {/if}
  </div>
{:else if article && source?.open}
  <SettleAsk {article} {library} bind:away />
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
  .write-back > .btn {
    max-width: 100%;
    white-space: normal;
    text-align: center;
  }
  /* Once pressed: the email app is opening, and the way out if it didn't (decision 0229). Not ".opening": that's the app's own first line (opening.css), whose serif and 64px of room would land here too. */
  .opening-line {
    margin-top: 0.25rem;
    color: var(--ink-2);
    font-size: var(--text-meta);
    text-align: center;
  }
  .on-page .opening-line {
    text-align: start;
  }
  /* The ways on, side by side on a line of their own, wrapping on a phone. */
  .ways {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    column-gap: 1.25rem;
  }
  .on-page .ways {
    justify-content: flex-start;
  }
  /* The two quiet words on the line, as Change is beside the address. */
  .more {
    margin-left: 0.5rem;
    color: var(--ink-2);
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
  /* At an article's end, centred under the button as the button is, a long name wrapping evenly. */
  .write-back:not(.on-page) .to {
    text-align: center;
    text-wrap: balance;
  }
</style>
