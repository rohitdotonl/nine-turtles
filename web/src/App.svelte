<!--
  Decides between the sign-in page, the sign-up page (an invite link's
  /sign-up, decision 0087, or anyone's while sign-up is Open), the pages an
  emailed link opens (/reset-password and /confirm-email, decision 0088;
  /sign-in-link, decision 0096), the page where an AI assistant asks to
  connect (/oauth/authorize, shown once signed in; signed out, sign-in
  comes first and the address, with its query, stays) and
  the signed-in screen, or "Wrong turn?" for an address it doesn't know. Until the server has answered, nothing is shown, so
  the reader never sees the wrong one. Without a connection, a device that
  keeps articles for reading offline opens the signed-in screen as it last
  saw it (SPEC section 32); being signed out deletes those copies, and stops
  and empties the podcast player (SPEC section 35).
-->
<script lang="ts">
  import Shell from "./lib/Shell.svelte";
  import SignIn from "./lib/SignIn.svelte";
  import SignUp from "./lib/SignUp.svelte";
  import ResetPassword from "./lib/ResetPassword.svelte";
  import ConfirmEmail from "./lib/ConfirmEmail.svelte";
  import SignInLink from "./lib/SignInLink.svelte";
  import ConnectAssistant from "./lib/ConnectAssistant.svelte";
  import { CONNECT_PAGE } from "./lib/assistants";
  import NotFound from "./lib/NotFound.svelte";
  import { knownPath } from "./lib/router";
  import { CONFIRM_PAGE, RESET_PAGE, SIGN_IN_LINK_PAGE } from "./lib/accounts";
  import { currentSession, type Session } from "./lib/session";
  import { noConnection } from "./lib/connection.svelte";
  import { forget, keepSession, keptSession } from "./lib/offline";
  import { forgetChosenKeys } from "./lib/keys.svelte";
  import { forgetListening } from "./lib/player.svelte";

  let session: Session | undefined = $state();
  let unreachable = $state(false);
  /** Which page the address asks for, outside the signed-in screen. */
  let path = $state(location.pathname);

  async function check() {
    try {
      session = await currentSession();
      if (session.signedIn) keepSession({ version: session.version, owner: session.owner, email: session.email, emailSending: session.emailSending });
      else {
        forgetChosenKeys();
        // Nobody signed in: the episode in the player stops, and this device's places in episodes go too (decision 0113).
        forgetListening();
        await forget();
      }
      unreachable = false;
      path = location.pathname;
      // Already signed in: an invite link opens nine turtles itself.
      if (session.signedIn && path === "/sign-up") {
        history.replaceState(null, "", "/");
        path = "/";
      }
    } catch (problem) {
      const kept = noConnection(problem) ? await keptSession() : undefined;
      if (kept) session = { signedIn: true, ...kept };
      else unreachable = true;
    }
  }

  check();
</script>

<!-- An emailed link's page shows whoever is signed in: the link is what was asked for. -->
{#if session && path === RESET_PAGE}
  <ResetPassword onSignedIn={check} />
{:else if session && path === CONFIRM_PAGE}
  <ConfirmEmail onSignedIn={check} />
{:else if session && path === SIGN_IN_LINK_PAGE}
  <SignInLink onSignedIn={check} />
{:else if session?.signedIn && path === CONNECT_PAGE}
  <ConnectAssistant onSignedOut={check} />
{:else if session?.signedIn && !knownPath(path)}
  <!-- An address that isn't one of nine turtles' places: "Wrong turn?" (SPEC section 4). -->
  <NotFound
    onBack={() => {
      history.replaceState(null, "", "/");
      path = "/";
    }}
  />
{:else if session?.signedIn}
  <Shell
    version={session.version}
    owner={session.owner}
    email={session.email}
    emailSending={session.emailSending}
    onSignedOut={check}
  />
{:else if session && path === "/sign-up"}
  <SignUp onSignedIn={check} open={session.signUpOpen} />
{:else if session}
  <SignIn
    onSignedIn={check}
    emailSending={session.emailSending}
    signUpOpen={session.signUpOpen}
    onSignUp={() => (path = location.pathname)}
  />
{:else if unreachable}
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
    <h1 class="font-serif text-display">nine turtles</h1>
    <p>nine turtles can't be reached right now. Reload the page to try again.</p>
  </main>
{/if}
