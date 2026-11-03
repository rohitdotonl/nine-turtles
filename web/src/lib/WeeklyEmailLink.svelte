<!--
  The pages the weekly email's links open (SPEC section 39, decision 0150):
  /weekly-email/start#ticket=…, sent once to a reader's address before the
  first weekly email goes there, and /weekly-email#ticket=…, at the foot of
  every weekly email, which turns it off in one press. Each works signed in
  or not. Nothing happens until its one button is pressed, so a mail program
  that opens links to check them can't press it. A link that no longer
  works says so, rather than claim it did something. Laid out as the other
  pages an emailed link opens (ConfirmEmail.svelte).
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { ticketFrom } from "./accounts";
  import { pressLink, type Pressed } from "./weekly";

  let { which, onDone }: { which: "stop" | "start"; onDone: () => void } = $props();

  const WORDS = {
    stop: {
      help: "Press Stop to turn the weekly email off.",
      button: "Stop the weekly email",
      busy: "Stopping…",
      done: "The weekly email is off. No more will come. You can turn it on again in Settings.",
      unknown: "This link no longer works: the email is already off, or the link is from an older email. If weekly emails still come, turn them off in Settings.",
    },
    start: {
      help: "Press Start to get the weekly email at this address.",
      button: "Start the weekly email",
      busy: "Starting…",
      done: "The weekly email will come to this address. Each one ends with a link that stops it.",
      unknown: "This link no longer works: it was already used, or is more than a week old. Choose the weekly email again in Settings for a new one.",
    },
  } as const;
  const words = $derived(WORDS[which]);

  // Read from after the #, then taken out of the address bar at once.
  const ticket = ticketFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  let result: Pressed | undefined = $state();
  let busy = $state(false);

  async function press() {
    if (busy) return;
    busy = true;
    result = await pressLink(which, ticket);
    busy = false;
  }

  function leave(event: MouseEvent) {
    event.preventDefault();
    history.replaceState(null, "", "/");
    onDone();
  }
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-8 px-5">
  <div class="flex flex-col items-center text-center">
    <div class="mb-5"><Logo height={56} /></div>
    <h1 class="font-serif text-display">nine turtles</h1>
    <p class="mt-3 font-serif text-large text-muted">The weekly email.</p>
  </div>
  <div class="flex w-full flex-col items-center gap-3 text-center sm:max-w-xs">
    {#if result === "done" || result === "unknown" || ticket === ""}
      <p role="status">{result === "done" ? words.done : words.unknown}</p>
      <!-- svelte-ignore a11y_autofocus: the only thing to do now. -->
      <a href="/" onclick={leave} autofocus class="btn rounded-lg">Open nine turtles</a>
    {:else}
      <p id="weekly-help">{words.help}</p>
      <div class="flex w-full min-h-[6rem] flex-col gap-3">
        <p id="weekly-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-small text-danger", result !== "trouble" && "sr-only"]}>
          {#if result === "trouble"}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>That didn't go through. Check your connection and try again.{/if}
        </p>
        <!-- svelte-ignore a11y_autofocus: the only thing to do on this page. -->
        <button type="button" autofocus aria-disabled={busy} aria-describedby="weekly-help weekly-message" onclick={press} class="btn-primary rounded-lg"
          >{busy ? words.busy : words.button}</button
        >
      </div>
    {/if}
  </div>
</main>
