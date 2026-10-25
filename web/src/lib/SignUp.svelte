<!--
  The sign-up page (SPEC section 1, decision 0087), reached from the owner's
  invite link (/sign-up#invite=…): built as the sign-in page is, one centred
  column of an email field, a password field and Sign up. The ticket is read
  from after the # (which no server ever sees), then taken out of the address
  bar at once, so it isn't left in the browser's history; it travels to the
  server only inside the sign-up itself. Without a ticket, or once the server
  says sign-up isn't open, it says so calmly and offers Sign in instead. On
  success the device is signed in and the reader arrives in nine turtles.
  While sign-up is Open (decision 0088) the page works without a ticket too:
  signing up then sends a link to the email, and the page says to open it;
  the account is made when it's followed.
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { PASSWORD_MINIMUM, explainSignUp, inviteFrom, signUp } from "./readers";

  let {
    onSignedIn,
    open = false,
  }: {
    onSignedIn: () => void;
    /** Sign-up is Open: anyone may sign up, by confirming their email. */
    open?: boolean;
  } = $props();

  const invite = inviteFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  /** Where the link to finish signing up went, once it's on its way. */
  let sentTo = $state("");
  let email = $state("");
  let password = $state("");
  let message = $state("");
  /** Which field the message is about, so it alone is marked. */
  let refusedField: "email" | "password" | undefined = $state();
  /** Sign-up isn't open (no ticket, an old one, or closed): the form goes, the message stays. */
  let closed = $state((() => invite === "" && !open)());
  let busy = $state(false);
  /** The email already has an account: Sign in is offered under the form. */
  let already = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || email.trim() === "" || password === "") return;
    busy = true;
    const result = await signUp(email.trim(), password, invite);
    busy = false;
    if (result.ok && result.confirm) {
      sentTo = result.confirm;
      return;
    }
    if (result.ok) {
      // The app lives at the site's root; the ticket leaves the address bar.
      history.replaceState(null, "", "/");
      onSignedIn();
      return;
    }
    message = explainSignUp(result);
    closed = result.reason === "closed";
    already = result.reason === "already";
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

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={57} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
  {#if sentTo}
    <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
      <p role="status">
        A link to finish signing up is on its way to <span class="font-semibold">{sentTo}</span>. Open it within 24
        hours; your account is made then.
      </p>
      <a href="/" onclick={signIn} class="btn rounded-lg">Sign in</a>
    </div>
  {:else if closed}
    <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
      <p role="status">{message || "Sign-up isn't open. Ask whoever runs this nine turtles for an invite link."}</p>
      <a href="/" onclick={signIn} class="btn rounded-lg">Sign in</a>
    </div>
  {:else}
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
        required
        autofocus
        bind:value={email}
        aria-describedby="sign-up-message"
        aria-invalid={refusedField === "email" ? "true" : undefined}
        class="field"
      />
      <label for="password" class="sr-only">Password, at least {PASSWORD_MINIMUM} characters</label>
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="new-password"
        placeholder="Password"
        required
        bind:value={password}
        aria-describedby="sign-up-help sign-up-message"
        aria-invalid={refusedField === "password" ? "true" : undefined}
        class="field"
      />
      <p id="sign-up-help" class="text-center text-meta text-muted">At least {PASSWORD_MINIMUM} characters.</p>
      <!-- Room for a message kept below the button, as on sign-in (decision 0045), so a message moves only the button. -->
      <div class="flex min-h-[6rem] flex-col gap-3">
        <p id="sign-up-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
          {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
        </p>
        <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Sign up</button>
        {#if already}<a href="/" onclick={signIn} class="btn rounded-lg">Sign in</a>{/if}
      </div>
    </form>
  {/if}
</main>
