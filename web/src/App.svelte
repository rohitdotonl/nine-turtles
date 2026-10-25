<!--
  Decides between the sign-in page, the sign-up page (an invite link's
  /sign-up, decision 0087) and the signed-in screen. Until the server has
  answered, nothing is shown, so the reader never sees the wrong one.
-->
<script lang="ts">
  import Shell from "./lib/Shell.svelte";
  import SignIn from "./lib/SignIn.svelte";
  import SignUp from "./lib/SignUp.svelte";
  import { currentSession, type Session } from "./lib/session";

  let session: Session | undefined = $state();
  let unreachable = $state(false);
  /** Opened from an invite link. */
  let signingUp = $state(location.pathname === "/sign-up");

  async function check() {
    try {
      session = await currentSession();
      unreachable = false;
      signingUp = location.pathname === "/sign-up";
      // Already signed in: an invite link opens nine turtles itself.
      if (session.signedIn && signingUp) history.replaceState(null, "", "/");
    } catch {
      unreachable = true;
    }
  }

  check();
</script>

{#if session?.signedIn}
  <Shell version={session.version} owner={session.owner} email={session.email} onSignedOut={check} />
{:else if session && signingUp}
  <SignUp onSignedIn={check} />
{:else if session}
  <SignIn onSignedIn={check} />
{:else if unreachable}
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
    <h1 class="font-serif text-display">nine turtles</h1>
    <p>nine turtles can't be reached right now. Reload the page to try again.</p>
  </main>
{/if}
