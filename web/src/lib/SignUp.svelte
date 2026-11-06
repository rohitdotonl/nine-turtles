<!--
  The sign-up page (/sign-up, SPEC section 1, decisions 0122 and 0154), open
  to anyone: built as the sign-in page is, one centred column of "Email",
  "Password" (each named above its field, "At least 12 characters." under the
  password), the optional "How did you hear about nine turtles?" (decision
  0155), Sign up, and "Have an account? Sign in". Signing up emails a
  link that finishes it: the form gives way to "Check your email", as
  Forgot? does, with a quiet Send again and a way back to the form. (Where
  nine turtles can't send email, the account is made at once and the
  reader arrives in nine turtles.)
-->
<script lang="ts">
  import { tick } from "svelte";
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import PasswordField from "./PasswordField.svelte";
  import SendAgain from "./SendAgain.svelte";
  import { HEARD_ABOUT, PASSWORD_MINIMUM, explainSignUp, signUp, type HeardAbout } from "./readers";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  let email = $state("");
  let password = $state("");
  /** Empty is "Rather not say". */
  let heardAbout: HeardAbout | "" = $state("");
  let message = $state("");
  /** Which field the message is about, so it alone is marked. */
  let refusedField: "email" | "password" | undefined = $state();
  let busy = $state(false);
  /** Where the link to finish went: the form gives way to "Check your email". */
  let sent = $state("");
  let sentHeading: HTMLHeadingElement | undefined = $state();
  let emailField: HTMLInputElement | undefined = $state();

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || email.trim() === "" || password === "") return;
    busy = true;
    const result = await signUp(email.trim(), password, heardAbout || undefined);
    busy = false;
    if (result.ok && result.sentTo) {
      sent = result.sentTo;
      message = "";
      refusedField = undefined;
      // The form and its button are gone: the keyboard goes to what replaced them.
      tick().then(() => sentHeading?.focus());
      return;
    }
    if (result.ok) {
      // The app lives at the site's root.
      history.replaceState(null, "", "/");
      onSignedIn();
      return;
    }
    message = explainSignUp(result);
    refusedField =
      result.reason === "email" || result.reason === "already"
        ? "email"
        : result.reason === "password-short" || result.reason === "password-long"
          ? "password"
          : undefined;
  }

  /** "Send again", a minute after: the same sign-up again, said shortly. */
  async function signUpAgain(): Promise<string> {
    const result = await signUp(sent, password, heardAbout || undefined);
    return result.ok ? "Another link is on its way." : explainSignUp(result);
  }

  /** Back to the form, the email kept, to fix a mistyped address. */
  function back(event: MouseEvent) {
    event.preventDefault();
    sent = "";
    password = "";
    tick().then(() => emailField?.focus());
  }

  function signIn(event: MouseEvent) {
    event.preventDefault();
    history.replaceState(null, "", "/");
    onSignedIn();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-8">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={56} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">Read people. Write back.</p>
  </div>
  {#if sent}
    <!-- Said once, in the text color: where the link went and how long it works. -->
    <div class="flex w-full flex-col items-stretch gap-3 text-center sm:max-w-xs">
      <h2 bind:this={sentHeading} tabindex="-1" class="font-semibold">Check your email</h2>
      <p role="status" class="break-words">
        A link is on its way to <span class="font-semibold">{sent}</span>. Open it and type your password to finish signing up. It works once, within 24 hours.
      </p>
      <SendAgain onSend={signUpAgain} />
      <a href="/sign-up" class="btn rounded-lg" onclick={back}>Use another email</a>
    </div>
  {:else}
  <form class="flex w-full flex-col gap-3 sm:max-w-xs" onsubmit={submit}>
    <div class="flex flex-col gap-1.5">
      <label for="email" class="text-small text-ink-2">Email</label>
      <!-- svelte-ignore a11y_autofocus: the first thing to do on this page. -->
      <input
        id="email"
        name="email"
        type="text"
        inputmode="email"
        autocomplete="email"
        autocapitalize="none"
        spellcheck="false"
        required
        autofocus
        bind:this={emailField}
        bind:value={email}
        aria-describedby="sign-up-message"
        aria-invalid={refusedField === "email" ? "true" : undefined}
        class="field"
      />
    </div>
    <!-- The same room above the password's name as on sign-in, where "Forgot?" sits, so the two pages line up. -->
    <div class="flex flex-col gap-1.5 pt-3">
      <label for="password" class="text-small text-ink-2">Password</label>
      <PasswordField
        id="password"
        autocomplete="new-password"
        bind:value={password}
        describedby="sign-up-help sign-up-message"
        invalid={refusedField === "password"}
      />
      <p id="sign-up-help" class="field-help mt-0">At least {PASSWORD_MINIMUM} characters.</p>
    </div>
    <!-- One optional question (decision 0155): a plain list, "Rather not say" until something is chosen. -->
    <div class="flex flex-col gap-1.5 pt-3">
      <label for="heard-about" class="text-small text-ink-2">How did you hear about nine turtles?</label>
      <select id="heard-about" name="heard-about" bind:value={heardAbout} aria-describedby="heard-about-help" class="field">
        <option value="">Rather not say</option>
        {#each HEARD_ABOUT as answer (answer.value)}
          <option value={answer.value}>{answer.words}</option>
        {/each}
      </select>
      <p id="heard-about-help" class="field-help mt-0">Optional. Only ever counted, never shown with your name.</p>
    </div>
    <!-- Room for a message kept at the column's foot, as on sign-in (decision 0045), so a message moves only what's under it. -->
    <div class="flex min-h-[10.5rem] flex-col gap-3">
      <p id="sign-up-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
        {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
      </p>
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Sign up</button>
      <p class="text-center text-small">Have an account? <a href="/" onclick={signIn} class="text-link">Sign in</a></p>
    </div>
  </form>
  {/if}
</main>
