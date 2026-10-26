<!--
  The page a sign-in link opens (/sign-in-link#ticket=…, SPEC section 1,
  decision 0095). Nothing happens until the reader presses Sign in, so a
  mail program that opens links to check them can't use the link up first.
  This device is then signed in and nine turtles opens. A link that has run
  out says so calmly.
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { explainLink, signInByLink, ticketFrom } from "./accounts";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  // Read from after the # (which no server ever sees), then taken out of the
  // address bar at once, so it isn't left in the browser's history.
  const ticket = ticketFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  let message = $state("");
  /** The link has run out or was used: the button goes, the message stays. */
  let spent = $state((() => ticket === "")());
  let busy = $state(false);

  async function signIn() {
    if (busy) return;
    busy = true;
    const result = await signInByLink(ticket);
    busy = false;
    if (result === "ok") {
      history.replaceState(null, "", "/");
      onSignedIn();
      return;
    }
    message = explainLink(result, "sign-in");
    spent = result === "expired";
  }

  function leave(event: MouseEvent) {
    event.preventDefault();
    history.replaceState(null, "", "/");
    onSignedIn();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={57} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
  <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
    {#if spent}
      <p role="status">{message || explainLink("expired", "sign-in")}</p>
      <a href="/" onclick={leave} class="btn rounded-lg">Sign in</a>
    {:else}
      <p id="link-help">Press Sign in to read on this device.</p>
      <div class="flex w-full min-h-[6rem] flex-col gap-3">
        <p id="link-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
          {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
        </p>
        <!-- svelte-ignore a11y_autofocus: the only thing to do on this page. -->
        <button type="button" autofocus aria-disabled={busy} aria-describedby="link-help link-message" onclick={signIn} class="btn-primary rounded-lg">Sign in</button>
      </div>
    {/if}
  </div>
</main>
