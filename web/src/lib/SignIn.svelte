<!--
  The sign-in page (SPEC section 1): the wordmark and a password field,
  nothing about the reader's feeds.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
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
  <div class="text-center">
    <h1 class="font-serif text-display">slowfeed</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
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
      aria-invalid={message ? "true" : undefined}
      class="field"
    />
    <!-- Right under the field it's about, with a mark so it isn't told by place alone. -->
    <p id="sign-in-message" role="status" class="flex min-h-6 items-start gap-1.5 text-small">
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>
    <button type="submit" disabled={busy} class="btn-primary">Sign in</button>
  </form>
</main>
