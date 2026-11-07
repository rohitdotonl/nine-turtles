<!--
  The small box that asks for someone's email address in place (SPEC section 37, decisions 0168
  and 0212), shared by Write back and Write to (`WriteBack`) and Ask them for a feed (`AskForFeed`):
  what to do, in a line that says what looking on their site found, "Find it on their site" until an
  address is filled in, "Their email address", the message line, then Write (or Write back) and Not
  now. A quiet bordered box with a faint edge, across the column. Its ids are its own, so several can
  be open on one page.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    title,
    site,
    looked,
    showingFound,
    saved,
    submit,
    quiet = false,
    busy = false,
    message,
    foot,
    typed = $bindable(""),
    field = $bindable(),
    onsubmit,
    onNotNow,
  }: {
    /** "Write back to Tomas Berg", "Write to june.example". */
    title: string;
    /** Their website, for Find it on their site. */
    site?: string;
    /** Looking on their site for the address, that it found none, or couldn't look. */
    looked: "looking" | "found" | "none" | "couldn't" | undefined;
    /** The address found is still what's in the field. */
    showingFound: boolean;
    /** The address typed is kept for them ("Paste it here and it's saved."). */
    saved: boolean;
    /** The main button's words: "Write back" or "Write". */
    submit: string;
    /** Beside another main action: an everyday bordered button, not the solid one. */
    quiet?: boolean;
    busy?: boolean;
    message: string;
    /** The quiet line under the buttons. */
    foot: string;
    typed?: string;
    field?: HTMLInputElement;
    onsubmit: (event: SubmitEvent) => void;
    onNotNow: () => void;
  } = $props();

  const id = $props.id();
  let paste = $derived(saved ? "Paste it here and it's saved." : "Paste it here.");
</script>

<form class="ask flex flex-col gap-4" aria-labelledby={`${id}-title`} {onsubmit}>
  <div class="flex flex-col gap-1">
    <p id={`${id}-title`} class="text-base font-semibold text-ink">{title}</p>
    <p class="text-small text-ink-2" aria-live="polite">
      {#if looked === "looking"}Looking on their site…{:else if showingFound}Found on their site. Check it, then press {submit}.{:else if looked === "none"}No email address on their site. {paste}{:else if looked === "couldn't"}Their site couldn't be checked for an address. {paste}{:else if saved}nine turtles doesn't have their address yet. {paste}{:else}{paste}{/if}
    </p>
  </div>
  {#if site && !showingFound}
    <!-- Left out once an address is filled in: it would only add a choice. -->
    <a class="btn self-start" href={site} target="_blank" rel="noopener noreferrer"><Icon name="open" size={16} />Find it on their site<span class="sr-only"> (opens in a new tab)</span></a>
  {/if}
  <div class="flex flex-col gap-1.5">
    <label for={`${id}-address`} class="text-small text-ink-2">Their email address</label>
    <input
      id={`${id}-address`}
      bind:this={field}
      bind:value={typed}
      type="text"
      inputmode="email"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      aria-invalid={message ? "true" : undefined}
      aria-describedby={`${id}-message`}
      class="field min-w-0"
    />
  </div>
  <p id={`${id}-message`} role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
    {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
  </p>
  <div class="flex flex-wrap gap-2">
    <button type="submit" class={quiet ? "btn" : "btn-primary"} aria-disabled={busy}>{submit}</button>
    <button type="button" class="btn-quiet" onclick={onNotNow}>Not now</button>
  </div>
  <p class="text-small text-ink-2">{foot}</p>
</form>

<style>
  /* The same quiet bordered box as Add a source, across the column. */
  .ask {
    align-self: stretch;
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
    text-align: left;
  }
</style>
