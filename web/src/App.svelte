<!--
  Decides between the sign-in page, the sign-up page (/sign-up, open
  to anyone, decision 0115), the pages an
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
  import { currentSession, readerChanged, type Session } from "./lib/session";
  import { forgetLoaded } from "./lib/feeds";
  import { noConnection } from "./lib/connection.svelte";
  import { forget, keepSession, keptSession } from "./lib/offline";
  import { forgetChosenKeys } from "./lib/keys.svelte";
  import { forgetListening } from "./lib/player.svelte";

  let session: Session | undefined = $state();
  let unreachable = $state(false);
  /** Which page the address asks for, outside the signed-in screen. */
  let path = $state(location.pathname);

  /**
   * Everything a reader left on this device: chosen keys, the player and its places in episodes (decision 0113),
   * the articles fetched so far, and the copies kept for reading offline with their waiting marks.
   */
  async function forgetDevice() {
    forgetChosenKeys();
    forgetListening();
    forgetLoaded();
    await forget();
  }

  async function check() {
    try {
      const now = await currentSession();
      if (now.signedIn) {
        // Another reader than last time: nothing of the last one's is shown, and their waiting marks are never sent as this one's.
        if (readerChanged(now.reader)) await forgetDevice();
        keepSession({ version: now.version, owner: now.owner, email: now.email, emailSending: now.emailSending });
      } else await forgetDevice();
      session = now;
      unreachable = false;
      path = location.pathname;
      // Already signed in: the sign-up page opens nine turtles itself.
      if (session.signedIn && path === "/sign-up") {
        history.replaceState(null, "", "/");
        path = "/";
      }
    } catch (problem) {
      const kept = noConnection(problem) ? await keptSession() : undefined;
      if (kept) session = { signedIn: true, reader: 0, ...kept };
      else unreachable = true;
    }
  }

  /** Signed out from inside the app: forgotten at once, so a lost connection now can't reopen the signed-in screen. */
  async function signedOut() {
    await forgetDevice();
    await check();
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
  <ConnectAssistant onSignedOut={signedOut} />
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
    passkeys={session.passkeys ?? null}
    onSignedOut={signedOut}
  />
{:else if session && path === "/sign-up"}
  <SignUp onSignedIn={check} />
{:else if session}
  <SignIn
    onSignedIn={check}
    emailSending={session.emailSending}
    passkeys={session.passkeys}
    onSignUp={() => (path = location.pathname)}
  />
{:else if unreachable}
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
    <h1 class="font-serif text-display">nine turtles</h1>
    <p>nine turtles can't be reached right now. Reload the page to try again.</p>
  </main>
{/if}
