<!--
  Settings › Hiding (SPEC section 27, decision 0201): a plain list of words.
  At the top, one field, "Hide articles about…", with Add and how long it
  lasts (For a week, For a month or For good, the usual one). Adding hides
  at once the unread articles already about it, with no question first; the
  line under the group says how many, with Undo. Each word is one row:
  the word, then whose articles it hides and for how long ("Everyone · for
  good"), and Remove, at once, with Undo. Started from someone's page or an
  article (`forFeed`), the field hides their articles only, and says so,
  with "Everyone instead". "Hidden articles ›" follows once anything is hidden.
-->
<script lang="ts">
  import { tick } from "svelte";
  import HidePreview from "./HidePreview.svelte";
  import Icon from "./Icon.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import NoteLine from "./NoteLine.svelte";
  import { UNDONE, UNDO_FAILED } from "./messages";
  import { rowFor } from "./people";
  import type { Feed } from "./shapes";
  import { addedMessage, createRule, deleteRule, listRules, ruleLine, ruleRefused, setMuted, wordShown, type Rule } from "./rules";

  let {
    people,
    onMuted,
    forFeed = $bindable(),
  }: {
    /** Everyone the reader follows, one row each (the sidebar's rows). */
    people: Feed[];
    /** Opens the Hidden articles page. */
    onMuted: (event: MouseEvent) => void;
    /** The person a new word is for, when started from their page or an article. */
    forFeed?: number;
  } = $props();

  const LENGTHS = [
    { days: 7, label: "For a week" },
    { days: 30, label: "For a month" },
    { days: 0, label: "For good" },
  ] as const;

  let rules: Rule[] | undefined = $state();
  let muted = $state(0);
  let failed = $state(false);
  let words = $state("");
  let days: 0 | 7 | 30 = $state(0);
  let empty = $state(false);
  /** The line under the group: what just happened, and Undo while it can be undone. */
  let message = $state("");
  /** The line says something failed: oxblood, with the alert icon. */
  let refusal = $state(false);
  let undo: (() => Promise<void>) | undefined = $state();
  let busy = $state(false);
  let field: HTMLInputElement | undefined = $state();
  let now = $state(Date.now() / 1000);

  /** The word as the server keeps it: no quote marks around it, one space between words. */
  let tidied = $derived(words.trim().replace(/^["“]|["”]$/g, "").trim().split(/\s+/).join(" "));

  /** Who a new word is for: their name, or none for everyone. */
  let forName = $derived(forFeed === undefined ? undefined : rowFor(forFeed, people)?.title);

  async function reload() {
    try {
      const listed = await listRules();
      rules = listed.rules;
      muted = listed.muted;
      now = Date.now() / 1000;
      failed = false;
    } catch {
      failed = true;
    }
  }

  $effect(() => {
    reload();
  });

  // Started for someone: the keyboard waits in the field.
  $effect(() => {
    if (forFeed !== undefined) tick().then(() => field?.focus());
  });

  function say(text: string, then?: () => Promise<void>, failure = false) {
    message = text;
    undo = then;
    refusal = failure;
  }

  /** × on the line: it goes, and the keyboard's place goes to the group's heading. */
  async function closeNote() {
    say("");
    await tick();
    document.getElementById("rules-heading")?.focus();
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const typed = tidied;
    if (!typed) {
      say("");
      empty = true;
      field?.focus();
      return;
    }
    empty = false;
    const feedId = forFeed ?? null;
    const person = (id: number) => rowFor(id, people)?.id ?? id;
    const same = (rule: Rule) =>
      rule.words.toLocaleLowerCase() === typed.toLocaleLowerCase() &&
      !rule.placeGone &&
      !rule.paused &&
      (rule.feedId === null || feedId === null ? rule.feedId === feedId : person(rule.feedId) === person(feedId));
    if (rules?.some(same)) {
      say(`“${typed}” is already hidden.`);
      field?.select();
      return;
    }
    const length = days === 0 ? undefined : days;
    busy = true;
    const made = await createRule({ words: typed, feedId, days: length });
    busy = false;
    if (typeof made === "string") {
      say(ruleRefused(made), undefined, true);
      return;
    }
    words = "";
    days = 0;
    await reload();
    say(addedMessage(typed, made.ids.length, length), async () => {
      // Both, whatever the first answers: a word already removed elsewhere still gives its articles back.
      const removed = await deleteRule(made.id);
      const unhid = made.ids.length > 0 ? await setMuted(made.ids, false) : undefined;
      const refusal = [removed, unhid].find((answer) => answer !== undefined && answer !== "gone");
      if (refusal === undefined) say(UNDONE);
      else say(refusal === "trouble" ? UNDO_FAILED : ruleRefused(refusal), undefined, true);
      await reload();
    });
    field?.focus();
  }

  /** Remove: gone at once, with Undo making it again, for the time it had left. */
  async function remove(rule: Rule, index: number) {
    if (busy) return;
    const refusal = await deleteRule(rule.id);
    if (refusal && refusal !== "gone") {
      say(ruleRefused(refusal, "The word couldn't be removed. Try again in a moment."), undefined, true);
      return;
    }
    await reload();
    say(`Removed ${wordShown(rule)}.`, async () => {
      // Made again under a new number: harmless, as the order never decides what's hidden.
      const made = await createRule({ ...rule, restore: true });
      if (typeof made !== "string") say(UNDONE);
      else say(made === "gone" ? `${wordShown(rule)}'s time was up.` : made === "trouble" ? UNDO_FAILED : ruleRefused(made), undefined, true);
      await reload();
    });
    // The keyboard goes to the next word's Remove, or back to the field.
    await tick();
    const buttons = document.querySelectorAll<HTMLElement>("[data-remove]");
    (buttons[Math.min(index, buttons.length - 1)] ?? field)?.focus();
  }

  async function runUndo() {
    if (!undo || busy) return;
    const doing = undo;
    undo = undefined;
    busy = true;
    await doing();
    busy = false;
    field?.focus();
  }
</script>

<section aria-labelledby="rules-heading">
  <h3 id="rules-heading" tabindex="-1" class="inset-head">Hiding</h3>
  <div class="inset-group">
    <form class="inset-row hide-form" novalidate onsubmit={add}>
      <div class="flex w-full flex-col gap-3">
        {#if forName}
          <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <!-- A very long name wraps here, so the page is never wider than the screen. -->
            <span class="min-w-0 break-words">Only from {forName}</span>
            <button type="button" class="btn btn-small" onclick={() => (forFeed = undefined)}>Everyone instead</button>
          </p>
        {/if}
        <div class="flex w-full items-center gap-2">
          <label for="hide-word" class="sr-only">{forName ? `Hide articles from ${forName} about` : "Hide articles about"}</label>
          <input
            id="hide-word"
            dir="auto"
            bind:this={field}
            bind:value={words}
            oninput={() => (empty = false)}
            type="text"
            autocomplete="off"
            placeholder="Hide articles about…"
            aria-invalid={empty}
            aria-describedby={empty ? "hide-empty" : tidied ? "hide-preview" : undefined}
            class="field min-w-0 flex-1"
          />
          <button type="submit" class="btn" aria-disabled={busy}>Add</button>
        </div>
        <div role="group" aria-label="How long" class="choices self-start" style="--columns: 3; --phone-columns: 3">
          {#each LENGTHS as length (length.days)}
            <label class="choice">
              <input type="radio" name="how-long" value={length.days} checked={days === length.days} onchange={() => (days = length.days)} />
              {length.label}
            </label>
          {/each}
        </div>
        <HidePreview words={tidied} feedId={forFeed ?? null} />
      </div>
    </form>
    {#each rules ?? [] as rule, index (rule.id)}
      {@const line = ruleLine(rule, people, now)}
      <div class="inset-row word-row">
        <span class="flex min-w-0 flex-1 flex-col py-2">
          <span class="break-words">{wordShown(rule)}</span>
          <span class="text-meta text-muted">{line}</span>
        </span>
        <button type="button" data-remove class="btn btn-small" aria-label={`Remove ${wordShown(rule)}, ${line}`} onclick={() => remove(rule, index)}>Remove</button>
      </div>
    {/each}
    {#if muted > 0}
      <a href="/settings/hidden" onclick={onMuted} data-settings-row="muted" class="inset-row inset-action"
        >Hidden articles<span class="row-glyph flex items-center"><Icon name="chevron-right" /></span></a
      >
    {/if}
  </div>
  <!-- Always here, so screen readers hear the words as they appear. -->
  <p id="hide-empty" role="alert" class={["inset-foot flex items-start gap-2 text-danger", !empty && "sr-only"]}>
    {#if empty}<span class="mt-px shrink-0"><Icon name="alert" /></span>Type a word or phrase first.{/if}
  </p>
  <div role="status" class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1 text-ink", !message && "sr-only"]}>
    <NoteLine {message} {refusal} {busy} onUndo={undo ? runUndo : undefined} onClose={closeNote} />
  </div>
  {#if failed}
    <LoadFailed class="inset-foot" words="What's hidden couldn't be loaded." heading="rules-heading" onRetry={() => ((failed = false), reload())} />
  {/if}
  <p class="inset-foot">Hidden articles are kept, and search still finds them.</p>
</section>

<style>
  .hide-form {
    padding-block: 0.75rem;
  }
  .word-row {
    flex-wrap: nowrap;
    align-items: center;
  }
</style>
