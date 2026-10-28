<!--
  The sign-in page (SPEC section 1, decision 0122): the wordmark, then
  "Email" and "Password", each named above its field, nothing about the
  reader's feeds. Everyone, the owner too, signs in with both (decision 0116).
  One main action, Sign in; under it, where passkeys work, the quieter "Sign
  in with a passkey" (decision 0109); then "New here? Sign up" (decision 0115).
  While nine turtles can send email, a small "Forgot?" at the right of the
  password's name turns the page into a request for a link that signs in,
  after which the reader may choose a new password (it replaced "Email me a
  sign-in link" and "Forgot your password?", decisions 0096 and 0088). Once a
  link is asked for, the form gives way to "Check your email": where it went,
  for how long it works, and a quiet Send again (decision 0092).
  Where passkeys work (this is their address and the browser has WebAuthn),
  the email field also offers the device's passkeys among its suggestions
  (the browser's passkey autofill).
-->
<script lang="ts">
  import { tick } from "svelte";
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import SendAgain from "./SendAgain.svelte";
  import { explain, signIn } from "./session";
  import { SIGN_IN_LINK_MINUTES, askForLink, explainAsked } from "./accounts";
  import {
    type PasskeySignIn,
    autofillAvailable,
    browserHasPasskeys,
    explainPasskeySignIn,
    passkeysHere,
    signInWithPasskey,
  } from "./passkeys";

  let {
    onSignedIn,
    emailSending = false,
    onSignUp,
    passkeys = null,
  }: {
    onSignedIn: () => void;
    /** nine turtles can send email: "Forgot?" is offered. */
    emailSending?: boolean;
    onSignUp?: () => void;
    /** Where passkeys work (decision 0109); null when they're off. */
    passkeys?: string | null;
  } = $props();

  /** Passkeys can sign in on this page: offered as a button and in the email field's suggestions. */
  const offered = $derived(passkeysHere(passkeys, location, browserHasPasskeys()));

  /** The email field's passkey suggestions, while they wait to be picked. */
  let autofill: AbortController | undefined;
  let rearm: ReturnType<typeof setTimeout> | undefined;
  /** Counts each stop, so an offer still starting when the page moves on never begins. */
  let offers = 0;
  /** When the last offer began, and how far apart offers are kept. */
  let lastOffer = 0;
  const AUTOFILL_GAP = 5_000;

  /**
   * Offers this site's passkeys among the email field's suggestions. A
   * challenge lasts five minutes on the server, so a fresh one replaces it
   * a little before; nothing on the page changes.
   */
  async function offerAutofill() {
    stopAutofill();
    // A browser that turns the offer down at once (no passkeys here, or it
    // won't wait) would otherwise be asked again and again, each time taking
    // a challenge on the server: offers are at least 5 seconds apart.
    const wait = lastOffer + AUTOFILL_GAP - Date.now();
    if (wait > 0) {
      rearm = setTimeout(offerAutofill, wait);
      return;
    }
    const mine = offers;
    // Stopped while the browser answered: the page has moved on.
    if (!offered || !(await autofillAvailable()) || mine !== offers) return;
    lastOffer = Date.now();
    const waiting = new AbortController();
    autofill = waiting;
    rearm = setTimeout(offerAutofill, 4 * 60 * 1000);
    const result = await signInWithPasskey(true, waiting.signal);
    if (waiting.signal.aborted) return;
    passkeyAnswered(result);
  }

  function stopAutofill() {
    offers += 1;
    clearTimeout(rearm);
    autofill?.abort();
    autofill = undefined;
  }

  $effect(() => {
    if (offered) void offerAutofill();
    return stopAutofill;
  });

  /** "Sign in with a passkey": the browser's own passkey sheet, at once. */
  async function passkey() {
    if (busy) return;
    stopAutofill();
    busy = true;
    const result = await signInWithPasskey(false);
    busy = false;
    passkeyAnswered(result);
  }

  function passkeyAnswered(result: PasskeySignIn) {
    if (result === "ok") {
      stopAutofill();
      onSignedIn();
      return;
    }
    // Cancelling says nothing; anything else is said where every refusal is.
    const said = explainPasskeySignIn(result);
    if (said) {
      message = said;
      refused = false;
    }
    void offerAutofill();
  }

  /** "Forgot?" was pressed: the page asks for a link that signs in. */
  let asking = $state(false);
  let emailField: HTMLInputElement | undefined = $state();

  let email = $state("");
  let password = $state("");
  let message = $state("");
  /** The password itself was refused, so the field is marked; other problems aren't the field's. */
  let refused = $state(false);
  let busy = $state(false);
  /** Where a link was asked for: the form gives way to "Check your email". */
  let sent = $state("");
  let sentHeading: HTMLHeadingElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (asking) return ask();
    if (busy) return;
    if (email.trim() === "") {
      message = explain({ ok: false, reason: "email-needed" });
      refused = false;
      emailField?.focus();
      return;
    }
    if (password === "") return;
    busy = true;
    const result = await signIn(email, password);
    busy = false;
    if (result.ok) {
      onSignedIn();
    } else {
      message = explain(result);
      refused = result.reason === "wrong-password";
      password = "";
    }
  }

  async function ask() {
    if (busy) return;
    if (email.trim() === "") {
      emailField?.focus();
      return;
    }
    busy = true;
    const result = await askForLink(email);
    busy = false;
    if (result === "asked") {
      sent = email.trim();
      message = "";
      refused = false;
      // The form and its button are gone: the keyboard goes to what replaced them.
      tick().then(() => sentHeading?.focus());
      return;
    }
    message = explainAsked(result, email);
    refused = result === "email";
  }

  /** "Send again", a minute after: the same answer, said shortly. */
  async function askAgain(): Promise<string> {
    const result = await askForLink(sent);
    return result === "asked" ? "Another link is on its way." : explainAsked(result, sent);
  }

  /** Between signing in and asking for a link: the email stays, the keyboard goes to it. */
  function switchTo(event: MouseEvent, forgot: boolean) {
    event.preventDefault();
    asking = forgot;
    sent = "";
    message = "";
    refused = false;
    password = "";
    tick().then(() => emailField?.focus());
  }

  function signUp(event: MouseEvent) {
    event.preventDefault();
    history.pushState(null, "", "/sign-up");
    onSignUp?.();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-8">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={57} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
  {#if asking && sent}
    <!-- Said once, in the text color: where the link went and how long it works; nothing says whether the email has an account. -->
    <div class="flex w-full flex-col items-stretch gap-3 text-center sm:max-w-xs">
      <h2 bind:this={sentHeading} tabindex="-1" class="font-semibold">Check your email</h2>
      <p id="link-sent" role="status" class="break-words">
        If <span class="font-semibold">{sent}</span> has an account here, a link is on its way. It works once, within {SIGN_IN_LINK_MINUTES} minutes.
      </p>
      <SendAgain onSend={askAgain} />
      <a href="/" class="btn rounded-lg" onclick={(event) => switchTo(event, false)}>Back to sign in</a>
    </div>
  {:else}
  <!--
    One centred column (decision 0048): the full width between the phone's
    20px margins, at most 320px wide on a larger screen. Each field's name
    stands above it, in small second-ink words on its left edge, as in a
    sheet (decision 0122). The email comes first, as password managers expect.
  -->
  <form class="flex w-full flex-col gap-3 sm:max-w-xs" onsubmit={submit}>
    <div class="flex flex-col gap-1.5">
      <label for="email" class="text-small text-ink-2">Email</label>
      <!-- svelte-ignore a11y_autofocus: the first thing to do on this page. -->
      <input
        id="email"
        name="email"
        type="text"
        inputmode="email"
        autocomplete={offered ? "username webauthn" : "email"}
        autocapitalize="none"
        spellcheck="false"
        autofocus
        bind:this={emailField}
        bind:value={email}
        aria-describedby={asking ? "link-help sign-in-message" : "sign-in-message"}
        aria-invalid={refused && email.trim() !== "" ? "true" : undefined}
        class="field"
      />
      {#if asking}
        <p id="link-help" class="field-help mt-0">We'll email you a link that signs you in. You can choose a new password after.</p>
      {/if}
    </div>
    {#if !asking}
      <!--
        The password's name, with "Forgot?" at the right of its line: small to the eye,
        but 44px tall to touch, its box rising into the room above the line so it never
        reaches over a field. It comes after the field in the page, so Tab goes
        Email, Password, Forgot?, Sign in; the grid only draws it on the name's line.
      -->
      <div class="-mt-3 grid grid-cols-[1fr_auto] items-end gap-x-3">
        <label for="password" class="col-start-1 row-start-1 text-small text-ink-2">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          bind:value={password}
          aria-describedby="sign-in-message"
          aria-invalid={refused ? "true" : undefined}
          class="field col-span-2 row-start-2 mt-1.5"
        />
        {#if emailSending}
          <a
            href="/"
            class="text-link forgot col-start-2 row-start-1"
            onclick={(event) => switchTo(event, true)}>Forgot?</a
          >
        {:else}
          <!-- Without email there's no Forgot?; the line keeps its height, so the page looks the same. -->
          <span class="col-start-2 row-start-1 h-11" aria-hidden="true"></span>
        {/if}
      </div>
    {/if}
    <!--
      Under the fields and above the button, the room for a message kept at the
      column's foot instead, as in the welcome (decision 0045): the page is centred,
      so a message arriving moves only what's under it, never the fields or the title.
      In red words after an icon, so it isn't told by color or place alone.
    -->
    <div class={["flex flex-col gap-3", asking ? "min-h-[8.5rem]" : offered ? "min-h-[13.75rem]" : "min-h-[10.5rem]"]}>
      <p id="sign-in-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small", "text-danger", !message && "sr-only"]}>
        {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
      </p>
      <!-- Busy is said with aria-disabled, not disabled, so the button keeps its look and the keyboard's place (decision 0045). Its corners match the field's. -->
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">{asking ? "Email me a link" : "Sign in"}</button>
      {#if asking}
        <p class="text-center"><a href="/" class="text-link" onclick={(event) => switchTo(event, false)}>Back to sign in</a></p>
      {:else}
        <!-- A passkey signs in without the fields: a quieter button, edged rather than filled. -->
        {#if offered}<button type="button" class="btn rounded-lg" aria-disabled={busy} onclick={passkey}>Sign in with a passkey</button>{/if}
        <p class="text-center text-small">New here? <a href="/sign-up" class="text-link" onclick={signUp}>Sign up</a></p>
      {/if}
    </div>
  </form>
  {/if}
</main>

<style>
  /*
    "Forgot?": the meta size, its words on the password name's line, its box
    44px tall and at least 44px wide, reaching up into the room between the
    fields (decision 0122).
  */
  .forgot {
    align-items: flex-end;
    justify-content: flex-end;
    min-width: 2.75rem;
    font-size: var(--text-meta);
    line-height: var(--text-small--line-height);
  }
</style>
