<!--
  The page a sign-in link opens (/sign-in-link#ticket=…, SPEC section 1,
  decisions 0096 and 0121): the link "Forgot?" emails. Nothing happens until
  the reader presses Sign in, so a mail program that opens links to check
  them can't use the link up first. This device is then signed in, and the
  reader may choose a new password straight away, or press Not now and
  read. A link that has run out says so calmly.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { PASSWORD_MINIMUM } from "./readers";
  import { explainLink, resetPassword, signInByLink, ticketFrom } from "./accounts";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  // Read from after the # (which no server ever sees), then taken out of the
  // address bar at once, so it isn't left in the browser's history.
  const ticket = ticketFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  let message = $state("");
  /** The link has run out or was used: the button goes, the message stays. */
  let spent = $state((() => ticket === "")());
  let busy = $state(false);

  /** Signed in, with the server's ticket for choosing a new password now ("" once it's gone). */
  let choosing = $state("");
  let password = $state("");
  let refused = $state(false);
  /** The choice ran out (an hour, or nine turtles restarted): the password stays, the reader goes on. */
  let lapsed = $state(false);
  let signedInHeading: HTMLHeadingElement | undefined = $state();

  async function signIn() {
    if (busy) return;
    busy = true;
    const result = await signInByLink(ticket);
    busy = false;
    if (result.ok) {
      if (!result.passwordTicket) return open();
      choosing = result.passwordTicket;
      message = "";
      // The button is gone: the keyboard goes to what replaced it.
      tick().then(() => signedInHeading?.focus());
      return;
    }
    message = explainLink(result.reason, "sign-in");
    spent = result.reason === "expired";
  }

  async function choose(event: SubmitEvent) {
    event.preventDefault();
    if (busy || password === "") return;
    busy = true;
    const result = await resetPassword(choosing, password);
    busy = false;
    if (result === "ok") return open();
    if (result === "expired") {
      lapsed = true;
      message = "That took too long, so your password stays as it is. To choose a new one, sign out and press Forgot? again.";
      return;
    }
    message = explainLink(result, "reset");
    refused = result === "password-short" || result === "password-long";
  }

  /** Into nine turtles, signed in. */
  function open() {
    history.replaceState(null, "", "/");
    onSignedIn();
  }

  function leave(event: MouseEvent) {
    event.preventDefault();
    open();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-8">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={57} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
  {#if choosing}
    <div class="flex w-full flex-col gap-3 sm:max-w-xs">
      <div class="flex flex-col gap-1 text-center">
        <h2 bind:this={signedInHeading} tabindex="-1" class="font-semibold">You're signed in</h2>
        <p>Choose a new password, if you like.</p>
      </div>
      {#if lapsed}
        <p role="status" class="text-center">{message}</p>
        <a href="/" onclick={leave} class="btn-primary rounded-lg">Open nine turtles</a>
      {:else}
        <form class="flex flex-col gap-3" onsubmit={choose}>
          <div class="flex flex-col gap-1.5">
            <label for="password" class="text-small text-ink-2">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
              bind:value={password}
              aria-describedby="choose-help choose-message"
              aria-invalid={refused ? "true" : undefined}
              class="field"
            />
            <p id="choose-help" class="field-help mt-0">At least {PASSWORD_MINIMUM} characters. Your other devices will be signed out.</p>
          </div>
          <!-- Room for a message kept at the foot, as on sign-in (decision 0045). -->
          <div class="flex min-h-[8.5rem] flex-col gap-3">
            <p id="choose-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
              {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
            </p>
            <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Set password</button>
            <p class="text-center"><a href="/" onclick={leave} class="text-link">Not now</a></p>
          </div>
        </form>
      {/if}
    </div>
  {:else}
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
  {/if}
</main>
