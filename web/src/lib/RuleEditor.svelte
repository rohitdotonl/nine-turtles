<!--
  The rule editor (SPEC section 27): "when a new article matches this, do
  that", in plain fields. What to look for (a word or phrase, in the title or
  in the title or text, and an author), where (every feed, a folder or a
  feed), and what to do (mute, star or mark as read). Built as every sheet
  is (DESIGN.md → "Visual language"): on a wide window a sheet over
  Settings, with Delete in red words at the far left of its one row of
  actions when the rule already exists, then Cancel and Save; on a phone,
  the phone sheet's one build (decision 0052): an X beside the title, Delete
  as a group of its own and Save at the screen's foot.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import type { Feed, Folder } from "./shapes";
  import { ACTIONS, blankWidth, createRule, editRule, placeChoice, ruleRefused, type Rule, type RuleAction, type RuleDraft } from "./rules";

  let {
    rule,
    feedId,
    feeds,
    folders,
    heading = $bindable(),
    sheet = false,
    onSaved,
    onCancel,
    onDelete,
  }: {
    /** The rule being changed; absent for a new one. */
    rule?: Rule;
    /** A new rule starts in this feed ("Add a rule for this feed…" in Edit feed). */
    feedId?: number;
    feeds: Feed[];
    folders: Folder[];
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
  let words = $state(start?.words ?? "");
  let titleOnly = $state(start?.titleOnly ?? true);
  let author = $state(start?.author ?? "");
  let action: RuleAction = $state(start?.action ?? "mute");
  /** Where: "all", "folder:7" or "feed:3". */
  let place = $state(
    start?.placeGone ? "" : start?.feedId != null ? `feed:${start.feedId}` : start?.folderId != null ? `folder:${start.folderId}` : startFeed !== undefined ? `feed:${startFeed}` : "all",
  );
  let chosen = $derived(ACTIONS.find((choice) => choice.value === action) ?? ACTIONS[0]!);

  let busy = $state(false);
  let message = $state("");
  let wordsField: HTMLInputElement | undefined = $state();

  function draft(): RuleDraft {
    const [kind, id] = place.split(":");
    return {
      words,
      titleOnly,
      author,
      feedId: kind === "feed" ? Number(id) : null,
      folderId: kind === "folder" ? Number(id) : null,
      action,
      paused: rule?.paused ?? false,
    };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (!words.trim() && !author.trim()) {
      message = ruleRefused("nothing-to-match");
      wordsField?.focus();
      return;
    }
    if (place === "") {
      message = "Choose where it applies: its feed or folder is gone.";
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

  let title = $derived(rule ? "Edit rule" : "New rule");

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
      title="Removes this rule. What it already did stays done. You can undo it straight afterwards."
      onclick={() => !busy && rule && onDelete(rule)}
      class={look}>Delete</button
    >
    <span id="delete-rule-help" class="sr-only">Removes this rule. What it already did stays done. You can undo it straight afterwards.</span>
  {/if}
{/snippet}

{#snippet form()}
  <form onsubmit={save} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <!--
      The rule as one sentence, its blanks the fields (decision 0123): "When a
      new article has ___ in its title, by any author, from all feeds, then
      mute it." Each blank is a real field or menu, named for screen readers,
      with a dashed line under it and 44px to press.
    -->
    <!-- The two text blanks are never narrower than their placeholders ("a word" is 6 letters, "any author" 10). -->
    <div role="group" aria-label="Rule" class="rule-sentence">
      When a new article has
      <input
        bind:this={wordsField}
        bind:value={words}
        type="text"
        autocomplete="off"
        placeholder="a word"
        aria-label="Word or phrase"
        aria-describedby="rule-words-help"
        aria-invalid={message !== "" && !words.trim() && !author.trim()}
        class="blank"
        style:width={blankWidth(words.padEnd(6), 0.3)}
      />
      in
      <span class="blank-pick"
        ><select bind:value={titleOnly} aria-label="Where to look" class="blank" style:width={blankWidth(titleOnly ? "its title" : "its title or text")}>
          <option value={true}>its title</option>
          <option value={false}>its title or text</option>
        </select><Icon name="chevron-down" size={14} /></span
      >, by
      <input
        bind:value={author}
        type="text"
        autocomplete="off"
        placeholder="any author"
        aria-label="Author"
        aria-describedby="rule-author-help"
        class="blank"
        style:width={blankWidth(author.padEnd(10), 0.3)}
      />, from
      <span class="blank-pick"
        ><select bind:value={place} aria-label="In" aria-invalid={place === ""} class="blank" style:width={blankWidth(placeChoice(place, feeds, folders))}>
          {#if place === ""}<option value="" disabled>choose where…</option>{/if}
          <option value="all">all feeds</option>
          {#if folders.length > 0}
            <optgroup label="Folders">
              {#each folders as folder (folder.id)}
                <option value={`folder:${folder.id}`}>{folder.name}</option>
              {/each}
            </optgroup>
          {/if}
          {#if feeds.length > 0}
            <optgroup label="Feeds">
              {#each feeds as feed (feed.id)}
                <option value={`feed:${feed.id}`}>{feed.title}</option>
              {/each}
            </optgroup>
          {/if}
        </select><Icon name="chevron-down" size={14} /></span
      >, then
      <span class="blank-pick"
        ><select bind:value={action} aria-label="Then" aria-describedby="rule-action-help" class="blank" style:width={blankWidth(chosen.words)}>
          {#each ACTIONS as choice (choice.value)}
            <option value={choice.value}>{choice.words}</option>
          {/each}
        </select><Icon name="chevron-down" size={14} /></span
      >.
    </div>

    <!-- What the chosen action does, and how words are found, in quiet words under the sentence. -->
    <div class="flex flex-col gap-1 text-small text-muted">
      <span id="rule-action-help">{chosen.help}</span>
      <span id="rule-words-help">Words are found whole, whatever their capital letters.</span>
      <span id="rule-author-help" class="sr-only">Optional: only articles by this author.</span>
    </div>

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
    The rule's sentence (decision 0123): set in the reading serif, large
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
