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
  /** The password itself was refused, so the field is marked; other problems aren't the field's. */
  let refused = $state(false);
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
      refused = result.reason === "wrong-password";
      password = "";
    }
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
  <div class="text-center">
    <h1 class="font-serif text-display">slowfeed</h1>
    <p class="mt-3 font-serif text-large text-muted">A quiet place to read.</p>
  </div>
  <!--
    One centred column (decision 0048): the field and the button 12px apart,
    the full width between the phone's 20px margins, at most 320px wide on a
    larger screen. The field's name is said to screen readers and shown as
    its placeholder, so nothing in the column is left-aligned under a centred
    title.
  -->
  <form class="flex w-full flex-col gap-3 sm:max-w-xs" onsubmit={submit}>
    <label for="password" class="sr-only">Password</label>
    <!-- svelte-ignore a11y_autofocus: the only thing to do on this page. -->
    <input
      id="password"
      name="password"
      type="password"
      autocomplete="current-password"
      placeholder="Password"
      required
      autofocus
      bind:value={password}
      aria-describedby="sign-in-message"
      aria-invalid={refused ? "true" : undefined}
      class="field"
    />
    <!--
      Under the field it's about and above the button, the room for a message
      kept below the button instead, as in the welcome (decision 0045): the
      page is centred, so a message arriving moves only the button. In red
      words after an icon, so it isn't told by color or place alone.
    -->
    <div class="flex min-h-[6rem] flex-col gap-3">
      <p id="sign-in-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", !message && "sr-only"]}>
        {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
      </p>
      <!-- Busy is said with aria-disabled, not disabled, so the button keeps its look and the keyboard's place (decision 0045). Its corners match the field's. -->
      <button type="submit" aria-disabled={busy} class="btn-primary rounded-lg">Sign in</button>
    </div>
  </form>
</main>
