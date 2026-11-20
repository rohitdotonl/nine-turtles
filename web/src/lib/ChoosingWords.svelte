<!--
  Notes' empty list shows how a highlight starts (decision 0325, the owner's
  choice on 20 November 2026): a still picture, drawn by the app so it takes
  the reader's page (White, Paper or Night) and reading font, at the interface's size, of a few words
  chosen in an article with the small menu that comes beside them,
  Highlight and Add a note…. It sits in a card of the sidebar's tone so it
  reads as a picture, apart from the page. It's only a picture: nothing in
  it can be pressed or reached, and screen readers skip it, since the words
  above it say the same. On a computer the menu shows Highlight's key, as
  the real one does; a phone has none.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { keyCap, keyFor } from "./keyboard";
</script>

<div class="choosing" aria-hidden="true" inert>
  <div class="page">
    <p class="words" lang="en">
      “Anyone can be confident with a full head of hair. But <span class="chosen">a confident bald man — there’s your diamond in the rough.</span>” — Larry David
    </p>
    <div class="floating menu">
      <span class="row"><span class="icon"><Icon name="highlight" /></span>Highlight<kbd>{keyCap(keyFor("highlight") ?? "")}</kbd></span>
      <span class="row"><span class="icon"><Icon name="note" /></span>Add a note…</span>
    </div>
  </div>
</div>

<style>
  .choosing {
    width: min(100%, 21.25rem);
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: var(--radius-hold);
    background-color: var(--sidebar);
    text-align: left;
  }
  /* On a computer the empty list is centred (lists.css), and so is its picture. */
  :global(.list-pane:not(.phone)) .choosing {
    margin-inline: auto;
  }
  .page {
    padding: 0.75rem 1rem 1rem;
    border-radius: var(--radius-press);
    background-color: var(--paper);
  }
  .words {
    font-family: var(--reading-font);
    font-size: var(--text-base);
    line-height: 1.55;
    color: var(--ink);
  }
  /* As words chosen anywhere are drawn (app.css, ::selection). */
  .chosen {
    background-color: var(--strong);
  }
  .menu {
    display: flex;
    width: max-content;
    min-width: 11rem;
    max-width: 100%;
    flex-direction: column;
    margin-top: 0.5rem;
    padding: 0.25rem;
    font-family: var(--font-sans);
  }
  .row {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.75rem;
    color: var(--ink);
    font-size: var(--text-meta);
  }
  .icon {
    display: flex;
    width: 1.25rem;
    flex-shrink: 0;
    justify-content: center;
    color: var(--ink-2);
  }
  kbd {
    margin-left: auto;
    padding-left: 1rem;
    color: var(--muted);
    font-family: inherit;
  }
  :global(.list-pane.phone) kbd {
    display: none;
  }
</style>
