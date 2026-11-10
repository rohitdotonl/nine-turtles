<!--
  The page the weekly email's stop link opens (/weekly-email#ticket=…, SPEC
  section 39, decision 0150): one press of Stop the weekly email turns it
  off, signed in or not. Nothing happens until it's pressed, so a mail
  program that opens links to check them can't stop it by itself. A link
  that no longer works says so, rather than claim it stopped something.
  Laid out as the other pages an emailed link opens (ConfirmEmail.svelte).
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { ticketFrom } from "./accounts";
  import { stopByTicket, type Pressed } from "./weekly";

  let { onDone }: { onDone: () => void } = $props();

  // Read from after the #, then taken out of the address bar at once.
  const ticket = ticketFrom(location.hash);
  if (location.hash) history.replaceState(history.state, "", location.pathname);
  let result: Pressed | undefined = $state();
  let busy = $state(false);

  async function stop() {
    if (busy) return;
    busy = true;
    result = await stopByTicket(ticket);
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
      <p role="status">
        {result === "done"
          ? "The weekly email is off. No more will come. You can turn it on again in Settings."
          : "This link no longer works: the email is already off, or the link is from an older email. If weekly emails still come, turn them off in Settings."}
      </p>
      <!-- svelte-ignore a11y_autofocus: the only thing to do now. -->
      <a href="/" onclick={leave} autofocus class="btn">Open nine turtles</a>
    {:else}
      <p id="stop-help">Press Stop to turn the weekly email off.</p>
      <div class="flex w-full min-h-[6rem] flex-col gap-3">
        <p id="stop-message" role="status" class={["flex items-start justify-center gap-1.5 text-center text-meta text-danger", result !== "trouble" && "sr-only"]}>
          {#if result === "trouble"}<span class="mt-px shrink-0"><Icon name="alert" /></span>The weekly email couldn't be turned off. Try again in a moment.{/if}
        </p>
        <!-- svelte-ignore a11y_autofocus: the only thing to do on this page. -->
        <button type="button" autofocus aria-disabled={busy} aria-describedby="stop-help stop-message" onclick={stop} class="btn-primary"
          >{busy ? "Stopping…" : "Stop the weekly email"}</button
        >
      </div>
    {/if}
  </div>
</main>
