<!--
  What a signed-in reader sees until the real app arrives (Milestone 4):
  the version in use and Sign out. These move into Settings then.
-->
<script lang="ts">
  import { signOut } from "./session";

  let { version, onSignedOut }: { version: string; onSignedOut: () => void } = $props();

  let message = $state("");

  async function leave() {
    try {
      await signOut();
      onSignedOut();
    } catch {
      message = "Couldn't sign out. Try again in a moment.";
    }
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
  <h1 class="font-serif text-5xl">slowfeed</h1>
  <p class="text-muted">Nothing here yet.</p>
  <section aria-labelledby="status-heading" class="flex flex-col items-center gap-2">
    <h2 id="status-heading" class="font-semibold">Status</h2>
    <p>Version {version}</p>
  </section>
  <button type="button" onclick={leave} class="min-h-11 rounded border border-ink px-4">Sign out</button>
  <p role="status">{message}</p>
</main>
