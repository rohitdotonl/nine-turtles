<!--
  The hiding editor (SPEC section 27): one sentence whose blanks are its
  fields, "Hide articles about [a word] from [everyone]." The person blank
  lists everyone the reader follows, people and publications, by name.
  Built as every sheet is (DESIGN.md → "Visual language"): on a wide window
  a sheet over Settings, with Delete in red words at the far left of its one
  row of actions when the rule already exists, then Cancel and Save; on a
  phone, the phone sheet's one build (decision 0052): an X beside the title,
  Delete as a group of its own and Save at the screen's foot.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import { rowFor } from "./people";
  import type { Feed } from "./shapes";
  import { HIDING_HELP, blankWidth, createRule, editRule, ruleRefused, whoChoice, type Rule, type RuleDraft } from "./rules";

  let {
    rule,
    feedId,
    people,
    heading = $bindable(),
    sheet = false,
    onSaved,
    onCancel,
    onDelete,
  }: {
    /** The rule being changed; absent for a new one. */
    rule?: Rule;
    /** A new rule starts from this person ("Hide articles about…" on an article or a person's page). */
    feedId?: number;
    /** Everyone the reader follows, one row each, A to Z (the sidebar's rows). */
    people: Feed[];
    heading?: HTMLHeadingElement;
    /** Shown as a sheet over Settings, not as a page. */
    sheet?: boolean;
    /** Saved: a new rule answers its number and how many unread articles already match. */
    onSaved: (draft: RuleDraft, made?: { id: number; matching: number }) => void;
    onCancel: () => void;
    onDelete: (rule: Rule) => void;
  } = $props();

  // The form starts from the rule as it is now (or a fresh one), once.
  const start = (() => rule)();
  const startFeed = (() => feedId)();
  const startPeople = (() => people)();
  /** A place's person, by the number of their row (the menu's value). */
  const rowOf = (id: number) => String(rowFor(id, startPeople)?.id ?? id);
  let words = $state(start?.words ?? "");
  /** Who: "all", a person's row number, or "" while the person it was for is gone. */
  let who = $state(start?.placeGone ? "" : start?.feedId != null ? rowOf(start.feedId) : startFeed !== undefined ? rowOf(startFeed) : "all");

  let busy = $state(false);
  let message = $state("");
  let wordsField: HTMLInputElement | undefined = $state();

  function draft(): RuleDraft {
    return {
      words,
      feedId: who === "all" || who === "" ? null : Number(who),
      titleOnly: rule?.titleOnly ?? false,
      paused: rule?.paused ?? false,
    };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (!words.trim()) {
      message = ruleRefused("nothing-to-match");
      wordsField?.focus();
      return;
    }
    if (who === "") {
      message = "Choose who: you no longer follow the one it was for.";
      return;
    }
    busy = true;
    message = "";
    const sending = draft();
    if (rule) {
      const refusal = await editRule(rule.id, sending);
      busy = false;
      if (refusal) message = ruleRefused(refusal);
      else onSaved(sending);
    } else {
      const made = await createRule(sending);
      busy = false;
      if (typeof made === "string") message = ruleRefused(made);
      else onSaved(sending, made);
    }
  }

  let title = $derived(rule ? "Edit" : "Hide articles");

  // The title takes the keyboard's place as the editor opens, so screen
  // readers start there (as every sheet's does), also on a phone, where it's
  // a screen of Settings' own rather than a place of its own.
  $effect(() => {
    tick().then(() => heading?.focus());
  });

  /** Escape closes the editor unchanged, before anything else hears it (Settings itself would close). */
  function escape(event: KeyboardEvent) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    onCancel();
  }
</script>

<svelte:window onkeydowncapture={escape} />

{#snippet remover(look: string)}
  {#if rule}
    <button
      type="button"
      aria-disabled={busy}
      aria-describedby="delete-rule-help"
      title="Stops hiding these. What's already hidden stays hidden. You can undo it straight afterwards."
      onclick={() => !busy && rule && onDelete(rule)}
      class={look}>Delete</button
    >
    <span id="delete-rule-help" class="sr-only">Stops hiding these. What's already hidden stays hidden. You can undo it straight afterwards.</span>
  {/if}
{/snippet}

{#snippet form()}
  <form onsubmit={save} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <!--
      The rule as one sentence, its blanks the fields (decision 0123): "Hide
      articles about ___ from everyone." Each blank is a real field or menu,
      named for screen readers, with a dashed line under it and 44px to press.
      The word blank is never narrower than its placeholder ("a word", 6 letters).
    -->
    <div role="group" aria-label="Hide articles" class="rule-sentence">
      Hide articles about
      <input
        bind:this={wordsField}
        bind:value={words}
        type="text"
        autocomplete="off"
        placeholder="a word"
        aria-label="About"
        aria-describedby="rule-help"
        aria-invalid={message !== "" && !words.trim()}
        class="blank"
        style:width={blankWidth(words.padEnd(6), 0.3)}
      />
      from
      <span class="blank-pick"
        ><select bind:value={who} aria-label="From" aria-invalid={who === ""} class="blank" style:width={blankWidth(whoChoice(who, people), 2)}>
          {#if who === ""}<option value="" disabled>choose someone…</option>{/if}
          <option value="all">everyone</option>
          {#each people as person (person.id)}
            <option value={String(person.id)}>{person.title}</option>
          {/each}
        </select><Icon name="chevron-down" size={14} /></span
      >.
    </div>

    <p id="rule-help" class="text-small text-muted">{HIDING_HELP}</p>

    <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>

    {#if sheet}
      <div class="sheet-actions">
        {@render remover("btn-danger")}
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {:else}
      {#if rule}
        <div class="inset-group">
          {@render remover("inset-row inset-action text-danger font-semibold")}
        </div>
      {/if}
      <div class="page-action">
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {/if}
  </form>
{/snippet}

<style>
  /*
    The hiding sentence (decision 0123): set in the reading serif, large
    enough that the blanks read as part of it. A blank is a field or menu
    with no box, only a dashed line under it in a soft tone of the text, so
    it reads as a space to fill; the keyboard's outline marks the one in use.
  */
  .rule-sentence {
    font-family: var(--font-serif);
    font-size: 1.375rem;
    line-height: 2.75rem;
    color: var(--ink-2);
  }
  .blank {
    min-height: 2.75rem;
    max-width: 100%;
    padding: 0 0.125rem;
    border: 0;
    border-bottom: 1px dashed color-mix(in srgb, var(--ink) 60%, transparent);
    border-radius: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    vertical-align: baseline;
  }
  .blank::placeholder {
    color: var(--muted);
    opacity: 1;
  }
  .blank[aria-invalid="true"] {
    border-bottom: 1px solid var(--danger);
  }
  .blank:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--ink) 65%, transparent);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .blank-pick {
    position: relative;
    display: inline-flex;
    max-width: 100%;
    align-items: center;
    color: var(--muted);
  }
  select.blank {
    appearance: none;
    padding-right: 1.25rem;
    text-overflow: ellipsis;
    cursor: pointer;
  }
  .blank-pick :global(svg) {
    position: absolute;
    right: 0.125rem;
    pointer-events: none;
  }
</style>

{#if sheet}
  <Sheet {title} bind:heading onClose={onCancel}>
    {@render form()}
  </Sheet>
{:else}
  <section aria-labelledby="list-heading" class="page-sheet">
    <!-- The phone sheet's build (decisions 0052, 0055), as Edit feed's. -->
    <div class="page-sheet-card">
      <PageHead {title} bind:heading onClose={onCancel} closeLabel="Close" />
      <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
        <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
          {@render form()}
        </div>
      </div>
    </div>
  </section>
{/if}
