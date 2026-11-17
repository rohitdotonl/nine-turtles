<!--
  Write back (SPEC section 37, decision 0147): at the end of every article of
  someone the reader follows, under its closing rule, one outlined button
  (`.btn`) with a paper plane, as Mark all as read ends a list (decision
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

  At an article's end the button is split (decision 0286): beside Write back, an arrow opens the
  other ways back, each with its icon: Email app (with its key), Gmail, Outlook.com, Copy their
  address, and, after a rule, Comment on their site (the comments the feed names, else the article
  itself). Choosing one does it at once, and the main button then does that for this person
  ("Copy address", "Comment"), kept for them by the server; where email opens stays this device's
  choice. On their page, Copy address follows Change beside the address; "Copied." takes a line
  of its own.

  Once pressed, one line under it says "Opening your email app…". On a computer the other ways
  to write (Gmail, Outlook.com, copying the address) wait behind two words on that line, "Didn't
  open?", so a press that worked leaves one line and no more (decision 0265).

  The paper plane, its key (`w`), a row's menu and the menu beside chosen words do the same
  (`start`). Started while this is off screen, "Opening your email app…" is said at the reading
  area's foot instead, where the reader is (`away`, drawn by the article's AwayNote; decision 0229).

  In the box on the page of someone whose feed isn't working (NotWorkingBox, decision 0279;
  `quiet`), Write to is one of the box's plain links, with no paper plane; the address with
  Change, and what follows a press, the line or the box, each take a line of their own straight
  after it.

  A publication has none of this (decision 0192), nor a person the reader switched Write back off
  for (decision 0286): nothing shows, and `start` does nothing. For
  someone nine turtles couldn't sort, at an article's end, the question stands in its place
  instead (SettleAsk, decision 0264).
-->
<script lang="ts">
  import { keyFor, tip } from "./keyboard";
  import { tick } from "svelte";
  import AddressBox from "./AddressBox.svelte";
  import Icon from "./Icon.svelte";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import TextButton from "./TextButton.svelte";
  import SettleAsk from "./SettleAsk.svelte";
  import { editFeed, plainSourceName } from "./feeds";
  import type { LoadedLibrary } from "./library.svelte";
  import type { ListNote } from "./listNote";
  import type { Article } from "./shapes";
  import { aboutLine, addressFor, commentsOf, composeLink, keepAddress, keepMailPlace, lookOnTheirSite, looksLikeAddress, MAIL_NAMES, mailPlace, quotedBody, siteOf, wayOf, writesBack, type MailPlace, type WriteBackWay } from "./writeBack";

  let {
    article,
    comments,
    feedId,
    library,
    quotes = () => [],
    quiet = false,
    within,
    away = $bindable(),
  }: {
    /** The article it writes back about; none on their page, where it writes to them. */
    article?: Article;
    /** Where the article's feed says its comments are, if it says. */
    comments?: string | null;
    /** On their page: their row's place. */
    feedId?: number;
    library: LoadedLibrary;
    /** The words the reader highlighted in the article: the email starts with them quoted (decision 0205). */
    quotes?: () => string[];
    /** In a row of plain links (the box of who isn't working, decision 0279): Write to is a plain link among them, the address with Change and what follows it takes a line of its own straight after it, and the address box's own button is bordered, not the solid one. */
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
  /** Where to comment on this article: the comments its feed names, else the article on their site. */
  let talk = $derived(article ? commentsOf(comments, article.link) : undefined);
  /** Its site, said under Comment: "on example.com". */
  let talkSite = $derived(talk ? new URL(talk).host.replace(/^www\./, "") : "");
  /** The way just chosen from the arrow's menu, until the server's copy of it comes back. */
  let picked: { id: number; way: WriteBackWay } | undefined = $state();
  /** What the main button does for this person (decision 0286): only at an article's end, and only a way that can be done here. */
  let way: WriteBackWay = $derived.by(() => {
    if (!article || quiet || !place) return "email";
    const chosen = picked?.id === place.id ? picked.way : wayOf(place, library.feeds ?? [], address);
    return (chosen === "copy" && !address) || (chosen === "comment" && !talk) ? "email" : chosen;
  });
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

  /** Kept for this person on the server, so their articles open with it next time; said here at once. */
  async function keepWay(next: WriteBackWay) {
    if (!place) return;
    const id = place.id;
    const before = wayOf(place, library.feeds ?? [], address);
    picked = { id, way: next };
    unkept = false;
    if (next === before) return;
    if (!(await editFeed(id, { writeBackWay: next }))) return void (await library.loadFeeds());
    // Not kept: the button goes back to what's kept, and says so.
    if (picked?.id === id) picked = undefined;
    unkept = true;
  }
  /** The way chosen couldn't be kept for them (offline, say): said under the button, which stays as it was. */
  let unkept = $state(false);

  /** The arrow's ways (decision 0286), the one the main button does ticked. On a computer, the email app's row shows its key. */
  let menu: MenuGroup[] = $derived([
    {
      items: [
        ...(["app", "gmail", "outlook"] as const).map((other) => ({
          label: other === "app" ? "Email app" : MAIL_NAMES[other],
          icon: "send" as const,
          shortcut: other === writesIn && computer ? keyFor("write-back") : undefined,
          checked: way === "email" && writesIn === other,
          onSelect: () => void emailIn(other),
        })),
        ...(address ? [{ label: `Copy ${address}`, icon: "copy" as const, checked: way === "copy", onSelect: () => void copyWay() }] : []),
      ],
    },
    ...(talk ? [{ items: [{ label: "Comment on their site", icon: "comments" as const, checked: way === "comment", onSelect: () => void commentWay() }] }] : []),
  ]);

  /** An email, from here on written in `other` on this device. */
  async function emailIn(other: MailPlace) {
    keepMailPlace(other);
    writesIn = other;
    void keepWay("email");
    await start();
  }

  async function copyWay() {
    void keepWay("copy");
    opening = false;
    away = undefined;
    await copyAddress();
  }

  function commentWay() {
    void keepWay("comment");
    opening = false;
    copied = "";
    away = undefined;
    if (talk) window.open(talk, "_blank", "noopener,noreferrer");
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
    unkept = false;
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
  <div bind:this={root} class={["write-back", !article && "on-page", quiet && "in-row"]} lang="en">
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
    {:else}
      {#snippet email()}
        {#if address}
          <a class={quiet ? "text-link text-ui" : "btn"} bind:this={written} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} href={composeLink(writesIn, address, subject, quoted)} target={writesIn === "app" ? undefined : "_blank"} rel={writesIn === "app" ? undefined : "noopener noreferrer"} onclick={() => pressed(quoted)}>{#if !quiet}<Icon name="send" />{/if}{@render label()}</a>
        {:else}
          <button type="button" class={quiet ? "text-link text-ui" : "btn"} bind:this={opener} title={article ? tip(`${verb} ${name}`, "write-back") : undefined} onclick={() => void start()}>{#if !quiet}<Icon name="send" />{/if}{@render label()}</button>
        {/if}
      {/snippet}
      {#if article && !quiet}
        <!-- The split button (decision 0286): the way chosen for this person, and the arrow with every way. -->
        <div class="split">
          {#if way === "comment"}
            <a class="btn" href={talk} target="_blank" rel="noopener noreferrer"><Icon name="comments" /><span>Comment<span class="sr-only">{" "}on <bdi>{name}</bdi>'s site</span></span></a>
          {:else if way === "copy"}
            <button type="button" class="btn" onclick={() => void copyWay()}><Icon name="copy" /><span>Copy address<span class="sr-only">{" "}of <bdi>{name}</bdi></span></span></button>
          {:else}
            {@render email()}
          {/if}
          <MoreMenu id={`ways-back-${article.id}`} label={`Other ways to reply to ${name}`} groups={menu} look="btn split-arrow">
            {#snippet face()}<Icon name="chevron-down" />{/snippet}
          </MoreMenu>
        </div>
      {:else}
        {@render email()}
      {/if}
      {#if way === "comment"}
        <p class="to" aria-hidden="true">on {talkSite}</p>
      {:else if article}
        <!-- The name only: their address is never printed on the article's page, where a screenshot or a shared screen would carry it (decision 0298). -->
        <p class="to" aria-hidden="true">to <bdi>{name}</bdi></p>
      {:else}
        <!-- On their page the address is theirs to correct, where it's shown, and to copy, for writing from somewhere nine turtles can't open. -->
        <p class="to">{address} <button type="button" class="text-link change" bind:this={changer} aria-label="Change {name}'s email address" onclick={() => void change()}>Change</button><button type="button" class="text-link change" onclick={() => void copyAddress()}>Copy address<span class="sr-only">{" "}of <bdi>{name}</bdi></span></button></p>
      {/if}
      <!-- Always in the page, so screen readers hear "Copied." as it arrives: a polite live line, not a second "status" (the toolbar's line is the pane's one status). -->
      <p class={[copied && !opening ? "to" : "sr-only", copyFailed && "text-danger"]} aria-live="polite">{#if copied && !opening}<span class="inline-flex items-start gap-2">{#if copyFailed}<span class="mt-px shrink-0"><Icon name="alert" /></span>{/if}{copied}</span>{/if}</p>
      {#if unkept}<p class="to text-danger" role="alert"><span class="inline-flex items-start gap-2"><span class="mt-px shrink-0"><Icon name="alert" /></span>That choice couldn't be kept for {name}. Try again in a moment.</span></p>{/if}
      {#if address && way === "email"}
        {#if writesIn !== "app"}<p class="to">Opens {MAIL_NAMES[writesIn]} in a new tab. <TextButton onclick={() => void useApp()}>Use your email app</TextButton></p>{/if}
        {#if quotedBody(quoted)}<p class="to">Your email starts with the words you {chosen ? "chose" : "highlighted"}.</p>{/if}
      {/if}
      {#if address}
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
              <button type="button" class={["text-link more", !returned && "after-words"]} aria-expanded={asked} onclick={() => (asked = !asked)}>{question}</button>
              {#if asked}{@render ways()}{/if}
            {:else}
              {#if !returned}<br />{/if}{question}{@render ways()}
            {/if}
          {/if}
        </p>
      {/if}
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
  /*
    In a row of plain links (the box of who isn't working, decision 0279): Write to is one of the row's own
    links, at their size, and whatever follows a press (the line, the box) takes a line of its own
    straight after it, before the links that follow, so the eye and the keyboard meet them in the
    same order.
  */
  .write-back.in-row {
    display: contents;
    font-size: inherit;
  }
  .in-row > :global(:not(.text-link)) {
    flex-basis: 100%;
  }
  /* Its 44px "Didn't open?" already holds it apart from the links around it. */
  .in-row > .opening-line:not(.sr-only) {
    margin: 0;
  }
  /* A long name wraps rather than running off a phone. */
  .write-back > .btn {
    max-width: 100%;
    white-space: normal;
    text-align: center;
  }
  /*
    The split button (decision 0286): the way and its arrow, one outlined shape with a hairline
    between them. The arrow is a full 44px square; whichever half has the keyboard sits on top,
    so its outline shows whole.
  */
  .split {
    display: flex;
    max-width: 100%;
  }
  .split > .btn {
    flex-shrink: 1;
    min-width: 0;
    white-space: normal;
    text-align: center;
    border-inline-end-width: 0;
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }
  .split :global(.split-arrow) {
    width: 2.75rem;
    padding-inline: 0;
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }
  .split > .btn:focus-visible,
  .split :global(.split-arrow:focus-visible) {
    position: relative;
    z-index: 1;
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
  /* The two quiet words on the line, as Change is beside the address: a small gap from "Opening…" while it's there, none once they stand alone. */
  .more {
    color: var(--ink-2);
  }
  .more.after-words {
    margin-left: 0.5rem;
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
