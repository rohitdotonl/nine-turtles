<!--
  The sign-in page (SPEC section 1): the wordmark, an email field and a
  password field, nothing about the reader's feeds. The owner may leave the
  email empty and sign in with the password alone, as before there were
  readers (decision 0087). While nine turtles can send email, "Email me a
  sign-in link" turns the page into a request for a link that signs in
  (decision 0096) and "Forgot your password?" into one for a password link;
  "Sign up" always leads to the sign-up page (decision 0115).
  Once a link is asked for, the form gives way to "Check your email": where
  it went, for how long it works, and a quiet Send again (decision 0092).
  Where passkeys work (this is their address and the browser has WebAuthn),
  "Sign in with a passkey" opens the browser's own passkey sheet, and the
  email field offers the device's passkeys among its suggestions (the
  browser's passkey autofill), decision 0109.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import SendAgain from "./SendAgain.svelte";
  import { explain, signIn } from "./session";
  import { type LinkKind, askForLink, explainAsked } from "./accounts";
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
    /** nine turtles can send email: "Email me a sign-in link" and "Forgot your password?" are offered. */
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

  /** Asking for a link instead of signing in: one that signs in, or one to choose a new password. */
  let asking: LinkKind | "" = $state("");
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
    if (asking) return ask(asking);
    if (busy || password === "") return;
    busy = true;
    const result = await signIn(email, password);
    busy = false;
    if (result.ok) {
      onSignedIn();
    } else {
      message = explain(result, email.trim() !== "");
      refused = result.reason === "wrong-password";
      password = "";
    }
  }

  async function ask(kind: LinkKind) {
    if (busy) return;
    if (email.trim() === "") {
      emailField?.focus();
      return;
    }
    busy = true;
    const result = await askForLink(kind, email);
    busy = false;
    if (result === "asked") {
      sent = email.trim();
      message = "";
      refused = false;
      // The form and its button are gone: the keyboard goes to what replaced them.
      tick().then(() => sentHeading?.focus());
      return;
    }
    message = explainAsked(kind, result, email);
    refused = result === "email";
  }

  /** "Send again", a minute after: the same answer, said shortly. */
  async function askAgain(): Promise<string> {
    if (!asking) return "";
    const result = await askForLink(asking, sent);
    return result === "asked" ? "Another link is on its way." : explainAsked(asking, result, sent);
  }

  /** Between signing in and asking for a link: the email stays, the keyboard goes to it. */
  function switchTo(event: MouseEvent, kind: LinkKind | "") {
    event.preventDefault();
    asking = kind;
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

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={57} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
  {#if asking && sent}
    <!-- Said once, in the text color: where the link went and how long it works; nothing says whether the email has an account. -->
    <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
      <h2 bind:this={sentHeading} tabindex="-1" class="font-semibold">Check your email</h2>
      <p id="link-sent" role="status" class="break-words">
        {#if asking === "sign-in"}
          If <span class="font-semibold">{sent}</span> has an account here, a link to sign in is on its way. It works once, for 15
          minutes.
        {:else}
          If <span class="font-semibold">{sent}</span> has an account here, a link to choose a new password is on its way. It works
          for an hour.
        {/if}
      </p>
      <SendAgain onSend={askAgain} />
      <p><a href="/" class="text-link" onclick={(event) => switchTo(event, "")}>Back to sign in</a></p>
    </div>
  {:else}
  <!--
    One centred column (decision 0048): the field and the button 12px apart,
    the full width between the phone's 20px margins, at most 320px wide on a
    larger screen. Each field's name is said to screen readers and shown as
    its placeholder, so nothing in the column is left-aligned under a centred
    title. The email comes first, as password managers expect.
  -->
  <form class="flex w-full flex-col gap-3 sm:max-w-xs" onsubmit={submit}>
    <label for="email" class="sr-only">Email</label>
    <!-- svelte-ignore a11y_autofocus: the first thing to do on this page. -->
    <input
      id="email"
      name="email"
      type="text"
      inputmode="email"
      autocomplete={offered ? "username webauthn" : "username"}
      autocapitalize="none"
      spellcheck="false"
      placeholder="Email"
      autofocus
      bind:this={emailField}
      bind:value={email}
      aria-describedby={asking ? "link-help sign-in-message" : "sign-in-message"}
      aria-invalid={refused && email.trim() !== "" ? "true" : undefined}
      class="field"
    />
    {#if asking}
      <p id="link-help" class="text-center text-meta text-muted">
        {asking === "sign-in" ? "nine turtles emails you a link that signs you in." : "nine turtles emails you a link to choose a new password."}
      </p>
    {:else}
    <label for="password" class="sr-only">Password</label>
    <input
      id="password"
      name="password"
      type="password"
      autocomplete="current-password"
      placeholder="Password"
      required
      bind:value={password}
      aria-describedby="sign-in-message"
      aria-invalid={refused ? "true" : undefined}
      class="field"
    />
    {/if}
    <!--
      Under the field it's about and above the button, the room for a message
      kept below the button instead, as in the welcome (decision 0045): the
      page is centred, so a message arriving moves only the button. In red
      words after an icon, so it isn't told by color or place alone.
    -->
    <div class="flex min-h-[6rem] flex-col gap-3">
      <p id="sign-in-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small", "text-danger", !message && "sr-only"]}>
        {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
      </p>
      <!-- Busy is said with aria-disabled, not disabled, so the button keeps its look and the keyboard's place (decision 0045). Its corners match the field's. -->
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">{asking ? "Send link" : "Sign in"}</button>
    </div>
    <!-- Quiet links in words, under the room kept for a message, so nothing above them moves. -->
    {#if asking}
      <p class="text-center"><a href="/" class="text-link" onclick={(event) => switchTo(event, "")}>Back to sign in</a></p>
    {:else}
      <!-- The sign-in link on a line of its own, so the lines never wrap differently from one screen to the next. -->
      <div class="flex flex-col items-center">
        <!-- A passkey signs in without the fields: a quiet action in words, like the links under it. -->
        {#if offered}<button type="button" class="text-link" aria-disabled={busy} onclick={passkey}>Sign in with a passkey</button>{/if}
        {#if emailSending}<a href="/" class="text-link" onclick={(event) => switchTo(event, "sign-in")}>Email me a sign-in link</a>{/if}
        <p class="flex flex-wrap justify-center gap-x-6 text-center">
          {#if emailSending}<a href="/" class="text-link" onclick={(event) => switchTo(event, "password")}>Forgot your password?</a>{/if}
          <a href="/sign-up" class="text-link" onclick={signUp}>Sign up</a>
        </p>
      </div>
    {/if}
  </form>
  {/if}
</main>
