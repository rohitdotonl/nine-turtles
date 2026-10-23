<!--
  The sign-in page (SPEC section 1): the wordmark and a password field,
  nothing about the reader's feeds.
-->
<script lang="ts">
  import { explain, signIn } from "./session";

  let { onSignedIn }: { onSignedIn: () => void } = $props();

  let password = $state("");
  let message = $state("");
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || password === "") return;
    busy = true;
    const result = await signIn(password);
    busy = false;
    if (result.ok) {
      onSignedIn();
    } else {
      message = explain(result);
      password = "";
    }
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
  <h1 class="font-serif text-display">slowfeed</h1>
  <form class="flex w-full max-w-xs flex-col gap-3" onsubmit={submit}>
    <label for="password">Password</label>
    <!-- svelte-ignore a11y_autofocus: the only thing to do on this page. -->
    <input
      id="password"
      name="password"
      type="password"
      autocomplete="current-password"
      required
      autofocus
      bind:value={password}
      aria-describedby="sign-in-message"
      class="field"
    />
    <button type="submit" disabled={busy} class="btn-primary">Sign in</button>
    <p id="sign-in-message" role="status" class="min-h-12">{message}</p>
  </form>
</main>
