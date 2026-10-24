<!--
  The add-a-feed field (SPEC sections 2 and 3): the welcome on a fresh
  slowfeed, and the "+ Add feed" sheet. It takes a feed's address or a
  website's; slowfeed finds the feed. Several feeds become a choice; problems
  are said in plain words. While slowfeed looks, a line of text says so: no
  spinner.

  In a sheet (or its page on a phone) the field takes the full width and
  "Add feed" sits in the foot row beside Cancel. In the welcome, with no
  Cancel, "Add feed" sits beside the field.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import { addFeed, explain, type Choice, type Feed } from "./feeds";

  let {
    field = $bindable(),
    feeds,
    onAdded,
    onOpen,
    onCancel,
    alternative,
  }: {
    field?: HTMLInputElement;
    /** The feeds already followed, to name one that's added twice. */
    feeds: Feed[];
    onAdded: (feed: Feed) => void;
    onOpen: (feedId: number) => void;
    /** In a sheet or its page: Cancel, beside Add feed in one row at the foot. */
    onCancel?: () => void;
    /**
     * In the welcome: another way in (importing an OPML file), just under the
     * field, so it reads as an alternative to it rather than a footer.
     */
    alternative?: Snippet;
  } = $props();

  let address = $state("");
  let busy = $state(false);
  let message = $state("");
  /** The message is a problem, not a next step. */
  let problem = $state(false);
  /** The problem is the address itself (not the site or slowfeed being unreachable), so the field is marked. */
  let badAddress = $state(false);
  let choices: Choice[] = $state([]);
  let alreadyId: number | undefined = $state();

  let alreadyTitle = $derived(feeds.find((feed) => feed.id === alreadyId)?.title);

  // The choices stay on screen while one is being added, so the button just
  // pressed (and the keyboard's place on it) never vanishes, and a choice
  // that fails can be swapped for another. Buttons say they're busy with
  // `aria-disabled` rather than `disabled`, which would drop the keyboard's
  // place too.
  async function add(text: string, fromChoices = false) {
    if (busy) return;
    busy = true;
    message = "";
    problem = false;
    badAddress = false;
    if (!fromChoices) choices = [];
    alreadyId = undefined;
    const result = await addFeed(text);
    busy = false;
    switch (result.kind) {
      case "added":
        address = "";
        choices = [];
        onAdded(result.feed);
        break;
      case "choose":
        choices = result.choices;
        message = "This site offers more than one feed. Choose one:";
        break;
      case "already":
        alreadyId = result.feedId;
        message = "You already follow this feed.";
        break;
      case "problem":
        message = explain(result.reason);
        problem = true;
        badAddress = result.reason !== "unreachable" && result.reason !== "trouble";
        break;
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (address.trim()) add(address);
    else {
      message = "Paste an address first.";
      problem = true;
      badAddress = true;
    }
  }
</script>

<!--
  In the welcome everything is centred, under a centred title (decision 0047):
  the field's name is said to screen readers and shown as its placeholder, so
  no line of it sits left-aligned. In a sheet its name stands above it.
-->
<form onsubmit={submit} class="flex flex-col gap-2">
  <label for="feed-address" class={onCancel ? "text-small text-ink-2" : "sr-only"}>Paste a website or feed URL</label>
  <div class="flex gap-2">
    <input
      id="feed-address"
      bind:this={field}
      bind:value={address}
      type="text"
      inputmode="url"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      placeholder={onCancel ? "example.com" : "Paste a website or feed URL"}
      aria-describedby="feed-address-status"
      aria-invalid={badAddress ? "true" : undefined}
      class="field min-w-0 flex-1"
    />
    {#if !onCancel}
      <!-- Beside the field, its corners match the field's. -->
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Add feed</button>
    {/if}
  </div>
  <!--
    In the welcome, everything under the field sits in a block that keeps
    room for a two-line message and the line after it (the page is centred,
    so a message arriving moves nothing above it). In a sheet the block
    isn't drawn at all, so the sheet's own spacing stands. The other way in sits just under the field, and
    a message, when there is one, takes its place there and moves it down
    within that room (decision 0045).
  -->
  <div class={onCancel ? "contents" : "flex min-h-[5.8rem] flex-col items-center text-center"}>
    <!--
      Screen readers hear each new line here without moving the keyboard's place.
      A problem is in red words after an icon. In a sheet the line takes room
      only once there's something to say, and the sheet grows down by it (its
      top stays put). In the welcome the block around it keeps the room.
    -->
    <p
      id="feed-address-status"
      role="status"
      class={[
        "flex items-start gap-1.5 text-small",
        problem && !busy && "text-danger",
        onCancel ? !busy && !message && "sr-only" : (busy || message) && "pb-2",
      ]}
    >
      {#if busy}Looking for a feed…{:else}{#if problem}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{/if}{message}{/if}
    </p>

    {#if choices.length > 0}
      <ul class="mb-2 flex flex-col gap-2 self-stretch text-left">
        {#each choices as choice (choice.url)}
          <li>
            <button
              type="button"
              aria-disabled={busy}
              onclick={() => add(choice.url, true)}
              class="flex min-h-11 w-full cursor-pointer flex-col items-start rounded-md border border-muted px-4 py-2 text-left hover:bg-[var(--hover)]"
            >
              <span>{choice.title}</span>
              <span class="text-small break-all text-muted">{choice.url}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if alreadyId !== undefined}
      <p class="-mt-1 mb-2">
        <a
          href={`/feeds/${alreadyId}`}
          onclick={(event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (alreadyId !== undefined) onOpen(alreadyId);
          }}
          class="inline-flex min-h-11 items-center underline underline-offset-4">Go to {alreadyTitle ?? "this feed"}</a
        >
      </p>
    {/if}

    {#if alternative}{@render alternative()}{/if}
  </div>

  {#if onCancel}
    <!-- The sheet's one row of actions, 20px under the field (with the form's 8px gap): Cancel, then Add feed at the right end. -->
    <div class="sheet-actions mt-3">
      <button type="button" onclick={onCancel} class="btn">Cancel</button>
      <button type="submit" aria-disabled={busy} class="btn-primary">Add feed</button>
    </div>
  {/if}
</form>
