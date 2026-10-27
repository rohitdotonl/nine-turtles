<!--
  The sign-up page (/sign-up, SPEC section 1, decisions 0115 and 0121), open
  to anyone: built as the sign-in page is, one centred column of "Email",
  "Password" (each named above its field, "At least 12 characters." under the
  password), Sign up, and "Have an account? Sign in". On success the account
  is made at once, with no email sent, this device is signed in and the
  reader arrives in nine turtles.
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { PASSWORD_MINIMUM, explainSignUp, signUp } from "./readers";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  let email = $state("");
  let password = $state("");
  let message = $state("");
  /** Which field the message is about, so it alone is marked. */
  let refusedField: "email" | "password" | undefined = $state();
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || email.trim() === "" || password === "") return;
    busy = true;
    const result = await signUp(email.trim(), password);
    busy = false;
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

  function signIn(event: MouseEvent) {
    event.preventDefault();
    history.replaceState(null, "", "/");
    onSignedIn();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-8">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={57} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
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
        bind:value={email}
        aria-describedby="sign-up-message"
        aria-invalid={refusedField === "email" ? "true" : undefined}
        class="field"
      />
    </div>
    <!-- The same room above the password's name as on sign-in, where "Forgot?" sits, so the two pages line up. -->
    <div class="flex flex-col gap-1.5 pt-3">
      <label for="password" class="text-small text-ink-2">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="new-password"
        required
        bind:value={password}
        aria-describedby="sign-up-help sign-up-message"
        aria-invalid={refusedField === "password" ? "true" : undefined}
        class="field"
      />
      <p id="sign-up-help" class="field-help mt-0">At least {PASSWORD_MINIMUM} characters.</p>
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
</main>
