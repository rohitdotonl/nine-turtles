<!--
  The page a password link opens (/reset-password#ticket=…, SPEC section 1,
  decision 0088): built as the sign-in page is, one centred column with a new
  password and Set password. The link works once, for an hour. A new password
  signs out every other device and signs this one in, so the reader arrives in
  nine turtles. A link that has run out says so calmly and offers Sign in.
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { PASSWORD_MINIMUM } from "./readers";
  import { explainLink, resetPassword, ticketFrom } from "./accounts";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  // Read from after the # (which no server ever sees), then taken out of the
  // address bar at once, so it isn't left in the browser's history.
  const ticket = ticketFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  let password = $state("");
  let message = $state("");
  let refused = $state(false);
  /** The link has run out or was used: the form goes, the message stays. */
  let spent = $state((() => ticket === "")());
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || password === "") return;
    busy = true;
    const result = await resetPassword(ticket, password);
    busy = false;
    if (result === "ok") {
      // The app lives at the site's root; the ticket leaves the address bar.
      history.replaceState(null, "", "/");
      onSignedIn();
      return;
    }
    message = explainLink(result, "reset");
    refused = result === "password-short" || result === "password-long";
    spent = result === "expired";
    if (spent) history.replaceState(null, "", "/reset-password");
  }

  function signIn(event: MouseEvent) {
    event.preventDefault();
    history.replaceState(null, "", "/");
    onSignedIn();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={57} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">Choose a new password.</p>
  </div>
  {#if spent}
    <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
      <p role="status">{message || explainLink("expired", "reset")}</p>
      <a href="/" onclick={signIn} class="btn rounded-lg">Sign in</a>
    </div>
  {:else}
    <form class="flex w-full flex-col gap-3 sm:max-w-xs" onsubmit={submit}>
      <label for="password" class="sr-only">New password, at least {PASSWORD_MINIMUM} characters</label>
      <!-- svelte-ignore a11y_autofocus: the only thing to do on this page. -->
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="new-password"
        placeholder="New password"
        required
        autofocus
        bind:value={password}
        aria-describedby="reset-help reset-message"
        aria-invalid={refused ? "true" : undefined}
        class="field"
      />
      <p id="reset-help" class="text-center text-meta text-muted">
        At least {PASSWORD_MINIMUM} characters. Your other devices will be signed out.
      </p>
      <!-- Room for a message kept below the button, as on sign-in (decision 0045). -->
      <div class="flex min-h-[6rem] flex-col gap-3">
        <p id="reset-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
          {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
        </p>
        <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Set password</button>
      </div>
    </form>
  {/if}
</main>
