<!--
  The page a sign-up's emailed link opens (/finish-sign-up#ticket=…, SPEC
  section 1, decision 0154). Built like sign-in: Password (named above its
  field, "The one you chose when you signed up." under it), Confirm email,
  and a quiet "Forgot it? Sign up again". The link shows the address is the reader's; the password shows the
  sign-up is theirs, so a stranger who signed up with the same address
  can't hand them an account with the stranger's password. Nothing happens
  until the reader presses Confirm email, so a mail program checking links
  can't use the link up. Then "You're signed up", with Open nine turtles. A
  link that has run out says so calmly, and the keyboard goes to what it
  says.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import PasswordField from "./PasswordField.svelte";
  import { ticketFrom } from "./accounts";
  import { explainFinish, finishSignUp } from "./readers";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  // Read from after the # (which no server ever sees), then taken out of the
  // address bar at once, so it isn't left in the browser's history.
  const ticket = ticketFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  let password = $state("");
  let message = $state("");
  /** The password itself was refused, so the field is marked. */
  let refused = $state(false);
  /** The link has run out, was used, or the address has an account: the form goes, the message stays. */
  let spent = $state((() => ticket === "")());
  let signedUp = $state(false);
  let busy = $state(false);
  let doneHeading: HTMLHeadingElement | undefined = $state();
  let spentMessage: HTMLParagraphElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || password === "") return;
    busy = true;
    const result = await finishSignUp(ticket, password);
    busy = false;
    if (result.ok) {
      signedUp = true;
      // The form and its button are gone: the keyboard goes to what replaced them.
      tick().then(() => doneHeading?.focus());
      return;
    }
    message = explainFinish(result);
    refused = result.reason === "wrong-password" || result.reason === "wait";
    spent = result.reason === "expired" || result.reason === "already";
    password = "";
    // The form is gone: the keyboard (and a screen reader) goes to why.
    if (spent) tick().then(() => spentMessage?.focus());
  }

  function signUpAgain(event: MouseEvent) {
    event.preventDefault();
    history.replaceState(null, "", "/sign-up");
    onSignedIn();
  }

  function leave(event: MouseEvent) {
    event.preventDefault();
    history.replaceState(null, "", "/");
    onSignedIn();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-8">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={56} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">Confirm your email.</p>
  </div>
  {#if signedUp}
    <div class="flex w-full flex-col items-stretch gap-3 text-center sm:max-w-xs">
      <h2 bind:this={doneHeading} tabindex="-1" class="font-semibold">You're signed up</h2>
      <p>You're signed in on this device.</p>
      <a href="/" onclick={leave} class="btn-primary rounded-lg">Open nine turtles</a>
    </div>
  {:else if spent}
    <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
      <p bind:this={spentMessage} tabindex="-1">{message || explainFinish({ ok: false, reason: "expired" })}</p>
      <a href="/" onclick={leave} class="btn rounded-lg">Sign in</a>
    </div>
  {:else}
    <form class="flex w-full flex-col gap-3 sm:max-w-xs" onsubmit={submit}>
      <div class="flex flex-col gap-1.5">
        <label for="password" class="text-small text-ink-2">Password</label>
        <!-- The only thing to do on this page, so it has the focus. -->
        <PasswordField
          id="password"
          autocomplete="current-password"
          autofocus
          bind:value={password}
          describedby="finish-help finish-message"
          invalid={refused}
        />
        <p id="finish-help" class="field-help mt-0">The one you chose when you signed up.</p>
      </div>
      <!-- Room for a message kept at the foot, as on sign-in (decision 0045). -->
      <div class="flex min-h-[6rem] flex-col gap-3">
        <p id="finish-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
          {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
        </p>
        <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Confirm email</button>
        <p class="text-center text-small">Forgot it? <a href="/sign-up" onclick={signUpAgain} class="text-link">Sign up again</a></p>
      </div>
    </form>
  {/if}
</main>
