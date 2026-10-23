<!--
  Decides between the sign-in page and the signed-in screen. Until the server
  has answered, nothing is shown, so the reader never sees the wrong one.
-->
<script lang="ts">
  import Shell from "./lib/Shell.svelte";
  import SignIn from "./lib/SignIn.svelte";
  import { currentSession, type Session } from "./lib/session";

  let session: Session | undefined = $state();
  let unreachable = $state(false);

  async function check() {
    try {
      session = await currentSession();
      unreachable = false;
    } catch {
      unreachable = true;
    }
  }

  check();
</script>

{#if session?.signedIn}
  <Shell version={session.version} onSignedOut={check} />
{:else if session}
  <SignIn onSignedIn={check} />
{:else if unreachable}
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
    <h1 class="font-serif text-display">slowfeed</h1>
    <p>slowfeed can't be reached right now. Reload the page to try again.</p>
  </main>
{/if}
