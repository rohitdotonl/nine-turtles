<!--
  The box a note is written in (SPEC section 42), the same for each kind of
  note: on a whole article, on highlighted words (in the small menu, or at
  the article's end), and on a person. Its name, the words, a quiet line
  saying who sees it, then Save and Not now.

  Nothing typed is thrown away (decision 0235): the box stays open with the
  words until the save is confirmed, and Save says "Saving…" while it
  waits. If it fails, the message sits right under the words, in oxblood
  with the alert icon, and Save becomes Try again. A box opened onto words
  kept from before says so above them, "Not saved yet.", with Discard, the
  one way to throw them away (with Undo).
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import Waiting from "./Waiting.svelte";
  import { LONGEST_NOTE } from "./notes.svelte";

  let {
    id,
    about,
    label,
    help,
    words = $bindable(),
    kept,
    small = false,
    on = "article",
    onSave,
    onNotNow,
    onDiscard,
  }: {
    /** The words' box's id, for its label. */
    id: string;
    /** The id of what the note is on (its highlighted words), read after the box's name, so several boxes are told apart. */
    about?: string;
    label: string;
    /** Who sees it, under the words. */
    help: string;
    words: string;
    /** The words were kept from before: "left" when the reader went elsewhere, "here" when the box was closed in place. */
    kept?: "left" | "here";
    /** In the small menu over the text: the smaller type, with no edge of its own. */
    small?: boolean;
    /** What the reader left, for "Kept from when you left this article." */
    on?: "article" | "page";
    /** Saves the words; answers why, if they couldn't be saved. */
    onSave: (words: string) => Promise<string | undefined>;
    onNotNow: () => void;
    /** Throws the kept words away (with Undo, the caller's). */
    onDiscard?: () => void;
  } = $props();

  let busy = $state(false);
  let message = $state("");
  let box: HTMLTextAreaElement | undefined = $state();

  /** The keyboard goes into the words, at their end. */
  export async function focus() {
    await tick();
    box?.focus();
    box?.setSelectionRange(words.length, words.length);
  }

  /** Scrolls the box into the middle of the view. */
  export function show() {
    box?.scrollIntoView({ block: "center" });
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const problem = await onSave(words);
    busy = false;
    message = problem ?? "";
    // Saved: the caller closes the box. Not saved: the keyboard stays with the words, under which the message now sits.
    if (problem) box?.focus();
  }
</script>

<form class={["flex flex-col gap-3", small ? "p-3" : "note-form"]} onsubmit={save}>
  <label class={["font-semibold text-ink", small ? "text-meta" : "text-base"]} for={id}>{label}</label>
  {#if kept}
    <p id="{id}-kept" class="kept text-meta text-ink-2">
      <span><strong class="font-semibold text-ink">Not saved yet.</strong>{#if kept === "left"}{" "}Kept from when you left this {on}.{/if}</span>
      {#if onDiscard}<button type="button" class="text-link discard" onclick={onDiscard}>Discard</button>{/if}
    </p>
  {/if}
  <textarea dir="auto" {id} bind:this={box} bind:value={words} maxlength={LONGEST_NOTE} rows="4" aria-describedby={[about, kept && `${id}-kept`, `${id}-message`].filter(Boolean).join(" ")} class="field note-box"></textarea>
  <p id="{id}-message" role="status" class={["flex items-start gap-2 text-meta text-danger", !message && "sr-only"]}>
    {#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{message}{/if}
  </p>
  <p class={small ? "text-meta text-muted" : "text-meta text-ink-2"}>{help}</p>
  <div class="flex flex-wrap gap-2">
    <button type="submit" class="btn-primary" aria-disabled={busy}><Waiting {busy} word={message ? "Try again" : "Save"} doing="Saving…" /></button>
    <button type="button" class="btn-quiet" onclick={onNotNow}>Not now</button>
  </div>
</form>

<style>
  .note-form {
    padding: 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-hold);
  }
  .note-box {
    min-height: 6rem;
    resize: vertical;
    line-height: 1.5;
  }
  /* "Not saved yet." and Discard on one line, Discard's 44px reaching into the space around it rather than pushing the box down. */
  .kept {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.5rem;
  }
  .discard {
    margin-block: -0.75rem;
  }
</style>
