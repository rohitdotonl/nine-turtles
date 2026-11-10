<!--
  Connected assistants, a group of Settings: an AI assistant (Claude,
  ChatGPT or any other that speaks MCP) can be connected to the reader's
  nine turtles, to find, sort and tidy things for them; nine turtles runs no
  AI itself. The group shows the server address to add in the assistant,
  with Copy, lists each connection with when it was made and last used, and
  disconnects one with a press. The assistant is stopped at once; Undo on
  the line brings the same connection back until the next action here
  (decision 0236), so a slip never means connecting again from inside the
  assistant. For an assistant that can't show the connect
  page, "Make an assistant key" makes a key, shown once with Copy. Feeds an assistant unsubscribed from are
  kept for 30 days and listed below, each with Bring back.
-->
<script lang="ts">
  import LoadFailed from "./LoadFailed.svelte";
  import NoteLine from "./NoteLine.svelte";
  import { tick } from "svelte";
  import { UNDONE, UNDO_FAILED } from "./messages";
  import { date } from "./times";
  import { resubscribe } from "./feeds";
  import {
    disconnect,
    listAssistants,
    makeKey,
    mcpAddress,
    reconnect,
    TOO_LATE_TO_RECONNECT,
    shortName,
    type Assistant,
    type Unsubscribed,
  } from "./assistants";

  let { onFeedsChanged }: { onFeedsChanged?: () => void } = $props();

  /** Unknown until the server answers. */
  let assistants: Assistant[] | undefined = $state();
  let unsubscribed: Unsubscribed[] = $state([]);
  let failed = $state(false);
  /** What the last action did, in oxblood when it failed (`refusal`), with Undo after a disconnect. */
  let message = $state("");
  let refusal = $state(false);
  let undo: (() => Promise<void>) | undefined = $state();
  let busy = $state(false);
  let keyName = $state("");
  /** A key just made, shown only until Settings closes. */
  let key = $state("");
  let copyKey: HTMLButtonElement | undefined = $state();
  let section: HTMLElement | undefined = $state();
  let heading: HTMLHeadingElement | undefined = $state();
  const address = mcpAddress(location.origin);

  function load() {
    listAssistants().then(
      (list) => {
        assistants = list.assistants;
        unsubscribed = list.unsubscribed;
        failed = false;
      },
      () => {
        assistants = [];
        failed = true;
      },
    );
  }
  load();

  /** The line says what just happened; any Undo before it ends (Undo reverses the last action only). */
  function say(words: string, failed = false, reverse?: () => Promise<void>) {
    [message, refusal, undo] = [words, failed, reverse];
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      say(`${what} copied.`);
    } catch {
      say(`The ${what.toLowerCase()} couldn't be copied. Select it and copy it yourself.`, true);
    }
  }

  /** After a row goes, the keyboard moves to the same place in what's left: the next row's button, the one before, or the heading. */
  async function refocus(group: string, index: number) {
    await tick();
    const buttons = section?.querySelectorAll<HTMLButtonElement>(`[data-group="${group}"]`) ?? [];
    const next = buttons[Math.min(index, buttons.length - 1)];
    if (next) next.focus();
    else heading?.focus();
  }

  async function end(assistant: Assistant, index: number) {
    if (busy) return;
    busy = true;
    say("");
    const name = shortName(assistant.name);
    try {
      await disconnect(assistant.id);
      assistants = (assistants ?? []).filter((each) => each.id !== assistant.id);
      say(`${name} is disconnected. It can no longer reach your nine turtles.`, false, async () => {
        const back = await reconnect(assistant.id);
        if (back === "too-late") throw new Error("too-late");
        assistants = [...(assistants ?? []).filter((each) => each.id !== assistant.id), assistant].sort(
          (one, other) => one.connectedAt - other.connectedAt || one.id - other.id,
        );
      });
      busy = false;
      await refocus("assistant", index);
    } catch {
      say(`${name} couldn't be disconnected. Try again in a moment.`, true);
    }
    busy = false;
  }

  /** Undo after Disconnect: the same connection is back, as it was. */
  async function takeBack() {
    if (!undo || busy) return;
    const doing = undo;
    busy = true;
    try {
      await doing();
      say(UNDONE);
    } catch (why) {
      say(why instanceof Error && why.message === "too-late" ? TOO_LATE_TO_RECONNECT : UNDO_FAILED, true);
    }
    busy = false;
    await tick();
    heading?.focus();
  }

  /** × on the line: it goes, and the keyboard's place goes to the group's heading. */
  async function closeNote() {
    say("");
    await tick();
    heading?.focus();
  }

  async function make(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    say("");
    try {
      const made = await makeKey(keyName);
      key = made.key;
      keyName = "";
      assistants = [...(assistants ?? []).filter((each) => each.id !== made.assistant.id), made.assistant];
      say("A new assistant key is ready.");
      busy = false;
      await tick();
      copyKey?.focus();
    } catch {
      say("The assistant key couldn't be made. Try again in a moment.", true);
    }
    busy = false;
  }

  async function bringBack(feed: Unsubscribed, index: number) {
    if (busy) return;
    busy = true;
    say("");
    const why = await resubscribe(feed.feedId);
    busy = false;
    const name = shortName(feed.title || "This feed");
    if (why === undefined || why === "too-late" || why === "gone") {
      unsubscribed = unsubscribed.filter((each) => each.feedId !== feed.feedId);
      if (why === undefined) say(`${name} is back in your feeds.`);
      else say(`${name} can't be brought back: it's already gone.`, true);
      if (why === undefined) onFeedsChanged?.();
      await refocus("unsubscribed", index);
      return;
    }
    say(`${name} couldn't be brought back. Try again in a moment.`, true);
  }
</script>

<section bind:this={section} aria-labelledby="assistants-heading">
  <h3 bind:this={heading} id="assistants-heading" tabindex="-1" class="inset-head">Connected assistants</h3>
  <div class="inset-group">
    <div class="inset-row">
      <p class="min-w-0">
        Server address<br /><span class="value text-muted" translate="no">{address}</span>
      </p>
      <button type="button" class="btn btn-small" onclick={() => copy(address, "Server address")}
        >Copy<span class="sr-only"> server address</span></button
      >
    </div>
    {#if key}
      <div class="inset-row">
        <p class="min-w-0">
          Assistant key<br /><span class="value text-muted" translate="no">{key}</span>
        </p>
        <button bind:this={copyKey} type="button" class="btn btn-small" onclick={() => copy(key, "Assistant key")}
          >Copy<span class="sr-only"> assistant key</span></button
        >
      </div>
    {/if}
    {#each assistants ?? [] as assistant, index (assistant.id)}
      {@const name = shortName(assistant.name)}
      <div class="inset-row item-row">
        <p class="min-w-0 flex-1 break-words">
          {name}<br /><span class="text-meta text-muted"
            >Connected {date(assistant.connectedAt)} · {assistant.lastUsedAt === null ? "Not used yet" : `Last used ${date(assistant.lastUsedAt)}`}</span
          >
        </p>
        <button
          type="button"
          data-group="assistant"
          aria-disabled={busy}
          title="Ends this connection; your feeds and articles stay as they are"
          onclick={() => end(assistant, index)}
          class="btn-danger text-small">Disconnect<span class="sr-only"> {name}</span></button
        >
      </div>
    {:else}
      {#if assistants !== undefined}
        <p class="inset-row text-muted">No assistants connected.</p>
      {/if}
    {/each}
    <form class="inset-row" onsubmit={make}>
      <label for="assistant-key-name" class="sr-only">Name for a new assistant key (optional; “Assistant key” if left empty)</label>
      <input
        id="assistant-key-name"
        type="text"
        maxlength="100"
        autocomplete="off"
        placeholder="Name for a new key (optional)"
        bind:value={keyName}
        class="inset-input"
      />
      <button type="submit" aria-disabled={busy} class="btn btn-small">Make an assistant key</button>
    </form>
  </div>
  <!-- What the last action did, with Undo after a disconnect, until the next one (SPEC section 8). -->
  <div class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1", refusal ? "text-danger" : "text-ink", !message && "sr-only"]}>
    <NoteLine announce {message} {refusal} {busy} onUndo={undo ? takeBack : undefined} onClose={closeNote} />
  </div>
  {#if key}
    <p class="inset-foot text-ink">
      Copy it now: it won't be shown again. In your assistant, add the server address above and send this key as a
      bearer token (Authorization: Bearer &lt;key&gt;).
    </p>
  {/if}
  {#if failed}
    <LoadFailed class="inset-foot" words="The connected assistants couldn't be loaded." heading="assistants-heading" onRetry={() => ((failed = false), load())} />
  {/if}
  <p class="inset-foot">
    Connect an AI assistant such as Claude or ChatGPT to your nine turtles, so it can find, sort and tidy things for
    you. nine turtles runs no AI itself. To connect, add the server address as a connector (MCP server) in your
    assistant. An assistant that can't show nine turtles' connect page can use an assistant key instead.
  </p>

  {#if unsubscribed.length > 0}
    <h4 id="assistant-unsubscribed-heading" class="inset-head mt-6">Unsubscribed by an assistant</h4>
    <div class="inset-group" role="group" aria-labelledby="assistant-unsubscribed-heading">
      {#each unsubscribed as feed, index (feed.feedId)}
        {@const name = shortName(feed.title || "Untitled feed")}
        <div class="inset-row item-row">
          <p class="min-w-0 flex-1 break-words">
            {name}<br /><span class="text-meta text-muted"
              >Unsubscribed {date(feed.unsubscribedAt)} · kept until {date(feed.keptUntil)}</span
            >
          </p>
          <button type="button" data-group="unsubscribed" aria-disabled={busy} onclick={() => bringBack(feed, index)} class="btn btn-small"
            >Bring back<span class="sr-only"> {name}</span></button
          >
        </div>
      {/each}
    </div>
    <p class="inset-foot">
      Feeds an assistant unsubscribes from are kept for 30 days, with their articles, so you can bring them back.
    </p>
  {/if}
</section>

<style>
  /* The address and key: long words that may break anywhere, never off the row. */
  .value {
    overflow-wrap: anywhere;
    font-size: var(--text-meta);
  }
  .item-row {
    flex-wrap: nowrap;
    padding-block: 0.5rem;
  }
  .item-row > p {
    line-height: 1.4;
  }
  @media (width < 30rem) {
    .item-row {
      flex-wrap: wrap;
    }
    .item-row > button {
      margin-left: auto;
    }
  }
</style>
