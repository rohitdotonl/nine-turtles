<!--
  The page a confirmation link opens (/confirm-email#ticket=…, SPEC sections 1
  and 18, decision 0088): a new account's address while sign-up is Open, or a
  reader's new address. Nothing happens until the reader presses Confirm
  email, so a mail program that opens links to check them can't use the link
  up first. A new account is then made and this device signed in; a changed
  address is said, with Continue. A link that has run out says so calmly.
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { confirmEmail, explainLink, ticketFrom } from "./accounts";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  // Read from after the # (which no server ever sees), then taken out of the
  // address bar at once, so it isn't left in the browser's history.
  const ticket = ticketFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  let message = $state("");
  /** The link has run out, was used, or can't make the account: the button goes, the message stays. */
  let spent = $state((() => ticket === "")());
  /** The reader's new address, once it has changed. */
  let changedTo = $state("");
  let busy = $state(false);

  async function confirm() {
    if (busy) return;
    busy = true;
    const result = await confirmEmail(ticket);
    busy = false;
    if (typeof result === "object") {
      if (result.done === "signed-up") {
        history.replaceState(null, "", "/");
        onSignedIn();
        return;
      }
      history.replaceState(null, "", "/confirm-email");
      changedTo = result.email;
      return;
    }
    message = explainLink(result, "confirm");
    spent = result !== "unreachable";
    if (spent) history.replaceState(null, "", "/confirm-email");
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
    <p class="mt-3 font-serif text-large text-muted">Confirm your email.</p>
  </div>
  <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
    {#if changedTo}
      <p role="status">Your email is now <span class="font-semibold">{changedTo}</span>. Sign in with it from now on.</p>
      <!-- svelte-ignore a11y_autofocus: the only thing to do now. -->
      <a href="/" onclick={leave} autofocus class="btn rounded-lg">Continue</a>
    {:else if spent}
      <p role="status">{message || explainLink("expired", "confirm")}</p>
      <a href="/" onclick={leave} class="btn rounded-lg">Sign in</a>
    {:else}
      <p id="confirm-help">Press Confirm email to finish.</p>
      <div class="flex w-full min-h-[6rem] flex-col gap-3">
        <p id="confirm-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
          {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
        </p>
        <!-- svelte-ignore a11y_autofocus: the only thing to do on this page. -->
        <button type="button" autofocus aria-disabled={busy} aria-describedby="confirm-help confirm-message" onclick={confirm} class="btn-primary rounded-lg">Confirm email</button>
      </div>
    {/if}
  </div>
</main>
