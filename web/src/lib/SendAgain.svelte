<!--
  The quiet line under "Check your email" (SPEC section 1): where the
  address is a big provider's, a link to open its inbox (decision 0195),
  pressed or not, never followed by itself; then "Didn't get it?
  Look in your spam folder." and Send again, a link in words. Nothing on it
  changes by itself (nothing moves unless you move it): Send again is there
  from the start, and pressed within a minute of the last link it sends
  nothing and says to give it a minute. The server sends one password link a
  minute anyway (decision 0092).
-->
<script lang="ts">
  import { RESEND_AFTER_SECONDS, inboxFor } from "./accounts";

  let {
    to,
    onSend,
  }: {
    /** Where the link went. */
    to: string;
    /** Sends the link again; answers what to say ("Another link is on its way." or why not). */
    onSend: () => Promise<string>;
  } = $props();

  const inbox = $derived(inboxFor(to));

  /** When the last link was sent: this line appears just after one is. */
  let sentAt = Date.now();
  let busy = $state(false);
  let note = $state("");

  async function again() {
    if (busy) return;
    if (Date.now() - sentAt < RESEND_AFTER_SECONDS * 1000) {
      note = "The link went less than a minute ago. Give it a minute, then send again if it hasn't come.";
      return;
    }
    busy = true;
    note = await onSend();
    busy = false;
    sentAt = Date.now();
  }
</script>

<div class="flex flex-col items-center gap-1 text-center">
  {#if inbox}
    <a href={inbox.url} target="_blank" rel="noopener noreferrer" class="text-link mb-2"
      >Open {inbox.name}<span class="sr-only"> (opens in a new tab)</span></a
    >
  {/if}
  <p class="text-small text-muted">Didn't get it? Look in your spam folder.</p>
  <button type="button" onclick={again} aria-disabled={busy} class="text-link">Send again</button>
  <p role="status" class={["text-small", !note && "sr-only"]}>{note}</p>
</div>
