<script lang="ts">
  // What the reading area says when an article's text couldn't come (SPEC section 7):
  // without a connection, when it opens; signed out (an expired sign-in), Sign in, since
  // Try again would never work; otherwise Try again (decision 0312).
  import TextButton from "./TextButton.svelte";
  import { connection } from "./connection.svelte";
  import { notKept } from "./offline";
  import { currentSession } from "./session";

  let { retry }: { retry: () => void } = $props();

  // Asked only once it failed, and only when there's a connection to ask over. Nothing is said
  // until the answer comes, so a screen reader never hears a line that's about to change.
  const asking = !connection.offline;
  let signedOut: boolean | undefined = $state(asking ? undefined : false);
  if (asking) currentSession().then((now) => (signedOut = !now.signedIn), () => (signedOut = false));
</script>

{#if connection.offline || signedOut !== undefined}
  <p role="status" class="mt-6 flex flex-wrap items-center gap-x-2" lang="en">
    {#if connection.offline}{notKept()}{:else if signedOut}You're signed out, so the article couldn't be loaded.
      <TextButton onclick={() => location.reload()}>Sign in</TextButton>{:else}This article couldn't be loaded.
      <TextButton onclick={retry}>Try again</TextButton>{/if}
  </p>
{/if}
