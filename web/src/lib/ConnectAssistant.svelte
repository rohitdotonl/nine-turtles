<!--
  "Connect this assistant?" (/oauth/authorize): an AI assistant (Claude,
  ChatGPT…) sends the reader here to ask for their nine turtles. The page
  asks the server what is asking, says plainly what it will and won't be
  able to do, and waits for Connect or Cancel. Either answer goes to the
  server, which says where to send the reader back to; nothing happens by
  itself, and a link that isn't valid never sends the reader anywhere. The
  assistant's name is its own choice, so it is shown only as plain words,
  cut short if it's very long. Built like the sign-in page: one calm,
  centred column.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { answerRequest, connectRequest, shortName, type ConnectRequest } from "./assistants";

  let { onSignedOut }: { onSignedOut: () => void } = $props();

  // Passed on to the server exactly as the assistant sent it.
  const search = location.search;
  let request: ConnectRequest | undefined = $state();
  let message = $state("");
  let busy = $state(false);
  let heading: HTMLHeadingElement | undefined = $state();

  const INVALID = "This connection link isn't valid. Start again from your assistant.";
  const TROUBLE = "nine turtles couldn't be reached. Try again in a moment.";

  async function load() {
    request = await connectRequest(search);
    if (request.kind === "signed-out") return onSignedOut();
    // Screen readers start at the question (or at what went wrong); no ring, as a sheet's title.
    await tick();
    heading?.focus();
  }

  async function answer(kind: "approve" | "deny") {
    if (busy) return;
    busy = true;
    message = "";
    const result = await answerRequest(kind, search);
    if (result.kind === "redirect") {
      // Not a form: the page's rules would stop a form sending the reader to another site.
      location.assign(result.url);
      return;
    }
    busy = false;
    if (result.kind === "signed-out") return onSignedOut();
    if (result.kind === "invalid") {
      request = { kind: "invalid" };
      await tick();
      heading?.focus();
      return;
    }
    message = TROUBLE;
  }

  load();
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-10">
  <div class="mb-1"><Logo height={57} /></div>
  {#if request?.kind === "ok"}
    {@const name = shortName(request.clientName)}
    <div class="connect flex w-full flex-col gap-5">
      <h1 bind:this={heading} tabindex="-1" class="text-center font-serif text-xlarge font-semibold leading-tight break-words">
        Connect {name} to nine turtles?
      </h1>
      <div class="flex flex-col gap-2">
        <h2 class="font-semibold">{name} will be able to</h2>
        <ul class="list">
          <li>read your feeds, articles, starred articles and rules</li>
          <li>mark articles read or starred</li>
          <li>add, rename, move and unsubscribe from feeds</li>
          <li>make and remove folders and rules</li>
          <li>download your feed list</li>
        </ul>
      </div>
      <div class="flex flex-col gap-2">
        <h2 class="font-semibold">It won't be able to</h2>
        <ul class="list">
          <li>see your password or email</li>
          <li>see or change your payments</li>
          <li>change or delete your account</li>
        </ul>
      </div>
      <div class="flex flex-col gap-2 text-ink-2">
        <p>Feeds it unsubscribes from are kept for 30 days; you can bring them back in Settings.</p>
        <p>You can disconnect it any time in Settings.</p>
        <p>Afterwards you'll go back to <span class="font-semibold break-words" translate="no">{request.redirectHost}</span>.</p>
      </div>
      <div class="flex flex-col gap-3">
        <p id="connect-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
          {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
        </p>
        <!-- Cancel, then the main action at the right end, as in a sheet. Busy is said with aria-disabled, so the buttons keep their look and the keyboard's place. -->
        <div class="sheet-actions">
          <button type="button" aria-disabled={busy} onclick={() => answer("deny")} class="btn rounded-lg">Cancel</button>
          <button type="button" aria-disabled={busy} aria-describedby="connect-message" onclick={() => answer("approve")} class="btn-primary rounded-lg"
            >Connect</button
          >
        </div>
      </div>
    </div>
  {:else if request?.kind === "invalid" || request?.kind === "trouble"}
    <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
      <h1 bind:this={heading} tabindex="-1" class="font-serif text-xlarge font-semibold leading-tight">
        {request.kind === "invalid" ? "This link can't be used" : "Not connected"}
      </h1>
      <p role="status">{request.kind === "invalid" ? INVALID : TROUBLE}</p>
      {#if request.kind === "trouble"}
        <button type="button" onclick={() => location.reload()} class="btn rounded-lg">Try again</button>
      {/if}
    </div>
  {/if}
</main>

<style>
  /* Wider than sign-in's 320px, so the lists read as lines, not a narrow column. */
  .connect {
    max-width: 26rem;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 1.25rem;
    list-style: disc;
  }
</style>
