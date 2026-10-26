<!--
  The sign-in page (SPEC section 1): the wordmark, an email field and a
  password field, nothing about the reader's feeds. The owner may leave the
  email empty and sign in with the password alone, as before there were
  readers (decision 0087). While nine turtles can send email, "Forgot your
  password?" turns the page into a request for a password link, and while
  sign-up is Open, "Sign up" leads to the sign-up page (decision 0088).
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { explain, signIn } from "./session";
  import { explainForgot, forgotPassword } from "./accounts";

  let {
    onSignedIn,
    emailSending = false,
    signUpOpen = false,
    onSignUp,
  }: {
    onSignedIn: () => void;
    /** nine turtles can send email: "Forgot your password?" is offered. */
    emailSending?: boolean;
    /** Sign-up is Open: "Sign up" is offered. */
    signUpOpen?: boolean;
    onSignUp?: () => void;
  } = $props();

  /** Asking for a password link instead of signing in. */
  let forgetting = $state(false);
  let emailField: HTMLInputElement | undefined = $state();
  /** The message after asking for a link is news, not a refusal: it's in the text color. */
  let calm = $state(false);

  let email = $state("");
  let password = $state("");
  let message = $state("");
  /** The password itself was refused, so the field is marked; other problems aren't the field's. */
  let refused = $state(false);
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (forgetting) return ask();
    if (busy || password === "") return;
    busy = true;
    const result = await signIn(email, password);
    busy = false;
    if (result.ok) {
      onSignedIn();
    } else {
      message = explain(result, email.trim() !== "");
      refused = result.reason === "wrong-password";
      calm = result.reason === "unconfirmed";
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
    const result = await forgotPassword(email);
    busy = false;
    message = explainForgot(result, email);
    calm = result === "asked";
    refused = result === "email";
  }

  /** Between signing in and asking for a link: the email stays, the keyboard goes to it. */
  function forget(event: MouseEvent, on: boolean) {
    event.preventDefault();
    forgetting = on;
    message = "";
    refused = false;
    password = "";
    queueMicrotask(() => emailField?.focus());
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
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
      placeholder="Email"
      autofocus
      bind:this={emailField}
      bind:value={email}
      aria-describedby={forgetting ? "forgot-help sign-in-message" : "sign-in-message"}
      aria-invalid={refused && email.trim() !== "" ? "true" : undefined}
      class="field"
    />
    {#if forgetting}
      <p id="forgot-help" class="text-center text-meta text-muted">nine turtles emails you a link to choose a new password.</p>
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
      <p id="sign-in-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small", calm ? "text-ink" : "text-danger", !message && "sr-only"]}>
        {#if message}{#if !calm}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{/if}{message}{/if}
      </p>
      <!-- Busy is said with aria-disabled, not disabled, so the button keeps its look and the keyboard's place (decision 0045). Its corners match the field's. -->
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">{forgetting ? "Send link" : "Sign in"}</button>
    </div>
    <!-- Quiet links in words, under the room kept for a message, so nothing above them moves. -->
    {#if forgetting}
      <p class="text-center"><a href="/" class="text-link" onclick={(event) => forget(event, false)}>Back to sign in</a></p>
    {:else if emailSending || signUpOpen}
      <p class="flex flex-wrap justify-center gap-x-6 text-center">
        {#if emailSending}<a href="/" class="text-link" onclick={(event) => forget(event, true)}>Forgot your password?</a>{/if}
        {#if signUpOpen}<a href="/sign-up" class="text-link" onclick={signUp}>Sign up</a>{/if}
      </p>
    {/if}
  </form>
</main>
