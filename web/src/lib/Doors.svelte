<!--
  The pages outside the signed-in screen, in a file of their own (decision
  0315): the sign-in and sign-up pages, the pages an emailed link opens, and
  where an AI assistant asks to connect. A signed-in reader's opening never
  waits for them; App.svelte decides when one shows (its comment says which
  page goes where) and fetches this file at once when one is likely.
-->
<script lang="ts">
  import SignIn from "./SignIn.svelte";
  import SignUp from "./SignUp.svelte";
  import ResetPassword from "./ResetPassword.svelte";
  import ConfirmEmail from "./ConfirmEmail.svelte";
  import FinishSignUp from "./FinishSignUp.svelte";
  import SignInLink from "./SignInLink.svelte";
  import WeeklyEmailStop from "./WeeklyEmailStop.svelte";
  import ConnectAssistant from "./ConnectAssistant.svelte";
  import { WEEKLY_PAGE } from "./weekly";
  import { CONNECT_PAGE } from "./assistants";
  import { FINISH_SIGN_UP_PAGE } from "./readers";
  import { CONFIRM_PAGE, RESET_PAGE, SIGN_IN_LINK_PAGE, SIGN_UP_PAGE } from "./accounts";
  import type { Session } from "./session";

  let {
    session,
    path,
    onSignedIn,
    onSignedOut,
    onSignUp,
  }: { session: Session; path: string; onSignedIn: () => void; onSignedOut: () => void; onSignUp: () => void } = $props();
</script>

<!-- An emailed link's page shows whoever is signed in: the link is what was asked for. -->
{#if path === RESET_PAGE}
  <ResetPassword {onSignedIn} />
{:else if path === CONFIRM_PAGE}
  <ConfirmEmail {onSignedIn} />
{:else if path === FINISH_SIGN_UP_PAGE}
  <FinishSignUp {onSignedIn} />
{:else if path === SIGN_IN_LINK_PAGE}
  <SignInLink {onSignedIn} />
{:else if path === WEEKLY_PAGE}
  <WeeklyEmailStop onDone={onSignedIn} />
{:else if session.signedIn && path === CONNECT_PAGE}
  <ConnectAssistant {onSignedOut} />
{:else if path === SIGN_UP_PAGE}
  <SignUp {onSignedIn} />
{:else}
  <SignIn {onSignedIn} emailSending={session.emailSending} passkeys={session.passkeys ?? null} {onSignUp} />
{/if}
