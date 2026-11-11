<!--
  The small box that asks for someone's email address in place (SPEC section 37, decisions 0168
  and 0212), shared by Write back and Write to (`WriteBack`) and Ask them for a feed (`AskForFeed`):
  what to do, in one line that says what looking on their site found and, until an address is
  filled in, ends "or look on their site" (a link to it, in a new tab); "Their email address", the
  message line, then Write (or Write back), the box's one solid button, and Not now (decision
  0257). A quiet bordered box with a faint edge, across the column. Its ids are its own, so several can
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
    say,
    typed = $bindable(""),
    field = $bindable(),
    onsubmit,
    onNotNow,
    onEscape,
  }: {
    /** "Write back to Tomas Berg", "Write to june.example". */
    title: string;
    /** Their website, for the line's "look on their site". */
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
    /** The line under the title, in place of "Paste it here." (Change on their page). */
    say?: string;
    typed?: string;
    field?: HTMLInputElement;
    onsubmit: (event: SubmitEvent) => void;
    onNotNow: () => void;
    /** Escape in the box: as Not now (Write back's box, and Change on their page), so it never leaves the page as well. */
    onEscape?: () => void;
  } = $props();

  const id = $props.id();
  /** What the line says before "Paste it here…": what looking on their site found, or that nothing is known yet. */
  let lead = $derived(
    looked === "none"
      ? "No email address on their site."
      : looked === "couldn't"
        ? "Their site couldn't be checked for an address."
        : saved
          ? "nine turtles doesn't have their address yet."
          : "",
  );
</script>

<form class="ask flex flex-col gap-4" aria-labelledby={`${id}-title`} {onsubmit}>
  <div class="flex flex-col gap-1">
    <p id={`${id}-title`} class="text-base font-semibold text-ink">{title}</p>
    <p class="text-meta text-ink-2" aria-live="polite">
      {#if looked === "looking"}Looking on their site…{:else if showingFound}Found on their site. Check it, then press {submit}.{:else if say && !lead}{say}{:else}{lead}
        Paste it here{#if site}, or
          <!-- Left out once an address is filled in: it would only add a choice. -->
          <a class="text-link" href={site} target="_blank" rel="noopener noreferrer">look on their site<span class="sr-only"> (opens in a new tab)</span></a>{/if}.{/if}
    </p>
  </div>
  <div class="flex flex-col gap-2">
    <label for={`${id}-address`} class="text-meta text-ink-2">Their email address</label>
    <input
      id={`${id}-address`}
      bind:this={field}
      bind:value={typed}
      type="text"
      inputmode="email"
      placeholder="name@example.com"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      aria-invalid={message ? "true" : undefined}
      aria-describedby={`${id}-message`}
      onkeydown={(event) => event.key === "Escape" && onEscape && (event.stopPropagation(), onEscape())}
      class="field min-w-0"
    />
  </div>
  <p id={`${id}-message`} role="status" class={["flex items-start gap-2 text-meta text-danger", !message && "sr-only"]}>
    {#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{message}{/if}
  </p>
  <div class="flex flex-wrap gap-2">
    <button type="submit" class={quiet ? "btn" : "btn-primary"} aria-disabled={busy}>{submit}</button>
    <button type="button" class="btn-quiet" onclick={onNotNow}>Not now</button>
  </div>
  <p class="text-meta text-ink-2">{foot}</p>
</form>

<style>
  /* The same quiet bordered box as Add a source, across the column. */
  .ask {
    align-self: stretch;
    padding: 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-hold);
    text-align: left;
  }
</style>
