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
  import type { Feed, Folder } from "./feeds";
  import { ACTIONS, createRule, editRule, ruleRefused, type Rule, type RuleAction, type RuleDraft } from "./rules";

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

  const ACTION_HELP: Record<RuleAction, string> = {
    mute: "Kept, but out of every list and counted as read. Search still finds it.",
    star: "It goes straight into Starred.",
    read: "It stays in its feed's list, already read.",
  };

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
    <div class="flex flex-col">
      <label class="flex flex-col gap-1.5">
        <span class="text-small text-ink-2">Word or phrase</span>
        <input
          bind:this={wordsField}
          bind:value={words}
          type="text"
          autocomplete="off"
          placeholder="sponsored"
          aria-describedby="rule-words-help"
          aria-invalid={message !== "" && !words.trim() && !author.trim()}
          class="field"
        />
      </label>
      <span id="rule-words-help" class="field-help">Found as whole words, whatever their capital letters.</span>
    </div>

    <fieldset class="flex min-w-0 flex-col gap-1.5">
      <legend class="mb-1.5 text-small text-ink-2">Look in</legend>
      <div class="inset-group">
        <label class="inset-row check-row">
          <input type="radio" name="rule-where" value={true} bind:group={titleOnly} />
          <span>The title</span>
          <span aria-hidden="true" class="radio-mark shrink-0"></span>
        </label>
        <label class="inset-row check-row">
          <input type="radio" name="rule-where" value={false} bind:group={titleOnly} />
          <span>The title or the text</span>
          <span aria-hidden="true" class="radio-mark shrink-0"></span>
        </label>
      </div>
    </fieldset>

    <div class="flex flex-col">
      <label class="flex flex-col gap-1.5">
        <span class="text-small text-ink-2">Author</span>
        <input bind:value={author} type="text" autocomplete="off" class="field" aria-describedby="rule-author-help" />
      </label>
      <span id="rule-author-help" class="field-help">Optional: only articles by this author.</span>
    </div>

    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">In</span>
      <select bind:value={place} class="field" aria-invalid={place === ""}>
        {#if place === ""}<option value="" disabled>Choose where…</option>{/if}
        <option value="all">All feeds</option>
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
      </select>
    </label>

    <fieldset class="flex min-w-0 flex-col gap-1.5">
      <legend class="mb-1.5 text-small text-ink-2">Then</legend>
      <div class="inset-group">
        {#each ACTIONS as choice (choice.value)}
          <label class="inset-row check-row flex-nowrap">
            <input type="radio" name="rule-action" value={choice.value} bind:group={action} aria-describedby={`rule-action-${choice.value}`} />
            <span class="flex min-w-0 flex-col py-1">
              <span>{choice.label}</span>
              <span id={`rule-action-${choice.value}`} class="text-small text-muted">{ACTION_HELP[choice.value]}</span>
            </span>
            <span aria-hidden="true" class="radio-mark shrink-0"></span>
          </label>
        {/each}
      </div>
    </fieldset>

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
