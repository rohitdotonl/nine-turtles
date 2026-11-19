<!--
  Decides between the sign-in page (shown signed out at any address, and at
  /sign-in, decision 0206), the sign-up page (/sign-up, open
  to anyone, decision 0115), the pages an
  emailed link opens (/reset-password and /confirm-email, decision 0088;
  /sign-in-link, decision 0096; /finish-sign-up, decision 0154; /weekly-email, which
  stops the weekly email, decision 0150), the page where an AI assistant asks to
  connect (/oauth/authorize, shown once signed in; signed out, sign-in
  comes first and the address, with its query, stays) and
  the signed-in screen, or "Wrong turn?" for an address it doesn't know. Until the server has answered, nothing is shown, so
  the reader never sees the wrong one. Without a connection, a device that
  keeps articles for reading offline opens the signed-in screen as it last
  saw it (SPEC section 32); being signed out deletes those copies, and stops
  and empties the podcast player (SPEC section 35).
-->
<script lang="ts">
  import Wordmark from "./lib/Wordmark.svelte";
  import Shell from "./lib/Shell.svelte";
  import SwipeBack from "./lib/SwipeBack.svelte";
  import SignIn from "./lib/SignIn.svelte";
  import SignUp from "./lib/SignUp.svelte";
  import ResetPassword from "./lib/ResetPassword.svelte";
  import ConfirmEmail from "./lib/ConfirmEmail.svelte";
  import FinishSignUp from "./lib/FinishSignUp.svelte";
  import SignInLink from "./lib/SignInLink.svelte";
  import WeeklyEmailStop from "./lib/WeeklyEmailStop.svelte";
  import { WEEKLY_PAGE } from "./lib/weekly";
  import ConnectAssistant from "./lib/ConnectAssistant.svelte";
  import { CONNECT_PAGE } from "./lib/assistants";
  import NotFound from "./lib/NotFound.svelte";
  import { knownPath } from "./lib/router";
  import { FINISH_SIGN_UP_PAGE } from "./lib/readers";
  import { CONFIRM_PAGE, RESET_PAGE, SIGN_IN_LINK_PAGE, SIGN_UP_PAGE, signedInPath } from "./lib/accounts";
  import { currentSession, deviceReader, noteReader, readerChanged, type Session } from "./lib/session";
  import { noteTabReader } from "./lib/updates.svelte";
  import { forgetLoaded } from "./lib/articles";
  import { away, noConnection } from "./lib/connection.svelte";
  import LoadFailed from "./lib/LoadFailed.svelte";
  import { forget, keepSession, keptSession } from "./lib/offline";
  import { forgetDrafts } from "./lib/drafts";
  import { forgetListening } from "./lib/player.svelte";
  import { forgetEarly } from "./lib/early";
  import { forgetRecent } from "./lib/recent";

  let session: Session | undefined = $state();
  let unreachable = $state(false);
  /** Which page the address asks for, outside the signed-in screen. */
  let path = $state(location.pathname);

  /**
   * Everything a reader left on this device: the player and its places in episodes (decision 0113),
   * the articles fetched so far, and the copies kept for reading offline with their waiting marks.
   */
  async function forgetDevice() {
    forgetDrafts();
    forgetListening();
    forgetLoaded();
    forgetRecent();
    await forget();
  }

  async function check() {
    try {
      const now = await currentSession();
      if (now.signedIn) {
        // Another reader than last time: nothing of the last one's is shown, and their waiting marks are never sent as this one's.
        if (readerChanged(now.reader)) await forgetDevice();
        // Noted only now: a tab closed halfway through still forgets next time.
        noteReader(now.reader);
        noteTabReader(now.reader);
        keepSession({ version: now.version, owner: now.owner, email: now.email, emailSending: now.emailSending });
      } else {
        forgetEarly();
        await forgetDevice();
      }
      session = now;
      unreachable = false;
      path = location.pathname;
      // Signed in: the sign-in and sign-up pages open nine turtles itself, rather than "Wrong turn?".
      if (session.signedIn && signedInPath(path) !== path) {
        path = signedInPath(path);
        history.replaceState(null, "", path);
      }
    } catch (problem) {
      const kept = noConnection(problem) ? await keptSession() : undefined;
      if (kept) {
        session = { signedIn: true, reader: 0, ...kept };
        // Opened without a connection: the tab is the reader's who was last signed in here.
        noteTabReader(deviceReader() ?? 0);
      } else unreachable = true;
    }
  }

  /** Signed out from inside the app: forgotten at once, so a lost connection now can't reopen the signed-in screen. */
  async function signedOut() {
    forgetEarly();
    await forgetDevice();
    await check();
  }

  check();

  /**
   * Can't be reached (an outage, or no connection): never a dead end. It asks again by itself
   * every 10 seconds while the tab is in view, on coming back into view and when the device
   * comes back online, so the app opens on its own once nine turtles answers; Try again asks
   * at once, its line going meanwhile, so a second failure is heard again (decision 0312).
   */
  let trying = $state(false);
  async function tryAgain() {
    trying = true;
    await check();
    trying = false;
  }
  $effect(() => {
    if (!unreachable) return;
    const ask = () => void (document.hidden || check());
    const again = setInterval(ask, 10_000);
    addEventListener("online", ask);
    document.addEventListener("visibilitychange", ask);
    return () => {
      clearInterval(again);
      removeEventListener("online", ask);
      document.removeEventListener("visibilitychange", ask);
    };
  });

  /** The tab's title on the pages outside the signed-in screen, which names its own (Shell.svelte): what the page is for, so a signed-out tab no longer names the list it showed. */
  let pageTitle = $derived.by(() => {
    if (!session) return unreachable ? "nine turtles" : undefined;
    const own: Record<string, string> = {
      [RESET_PAGE]: "Choose a new password",
      [CONFIRM_PAGE]: "Confirm your email",
      [FINISH_SIGN_UP_PAGE]: "Finish signing up",
      [SIGN_IN_LINK_PAGE]: "Sign in",
      [WEEKLY_PAGE]: "The weekly email",
    };
    if (own[path]) return `${own[path]} · nine turtles`;
    if (session.signedIn) return path === CONNECT_PAGE ? "Connect an assistant · nine turtles" : undefined;
    return path === SIGN_UP_PAGE ? "Sign up · nine turtles" : "Sign in · nine turtles";
  });

  $effect(() => {
    if (pageTitle) document.title = pageTitle;
  });
</script>

<!-- An emailed link's page shows whoever is signed in: the link is what was asked for. -->
{#if session && path === RESET_PAGE}
  <ResetPassword onSignedIn={check} />
{:else if session && path === CONFIRM_PAGE}
  <ConfirmEmail onSignedIn={check} />
{:else if session && path === FINISH_SIGN_UP_PAGE}
  <FinishSignUp onSignedIn={check} />
{:else if session && path === SIGN_IN_LINK_PAGE}
  <SignInLink onSignedIn={check} />
{:else if session && path === WEEKLY_PAGE}
  <WeeklyEmailStop onDone={check} />
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
  <SwipeBack />
{:else if session && path === SIGN_UP_PAGE}
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
    <Wordmark id="wordmark" />
    {#if away().offline}
      <!-- The device's own connection: calmly, as every offline line (SPEC section 32); it opens by itself once back. -->
      <p role="status">You're offline. nine turtles opens once you're back online.</p>
    {:else if !trying}
      <LoadFailed words={away().why} heading="wordmark" onRetry={tryAgain} class="justify-center" />
    {/if}
  </main>
{/if}
