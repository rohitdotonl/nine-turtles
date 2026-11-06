<!--
  Settings › Hiding (SPEC section 27, decision 0197): a plain list of words.
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
  import Icon from "./Icon.svelte";
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
  let undo: (() => Promise<void>) | undefined = $state();
  let busy = $state(false);
  let field: HTMLInputElement | undefined = $state();
  let now = $state(Date.now() / 1000);

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

  function say(text: string, then?: () => Promise<void>) {
    message = text;
    undo = then;
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const typed = words.trim().replace(/^["“]|["”]$/g, "").trim();
    if (!typed) {
      say("");
      empty = true;
      field?.focus();
      return;
    }
    empty = false;
    const feedId = forFeed ?? null;
    const same = (rule: Rule) => rule.words.toLocaleLowerCase() === typed.toLocaleLowerCase() && !rule.placeGone && (rule.feedId === null ? feedId === null : feedId !== null && rowFor(rule.feedId, people)?.id === rowFor(feedId, people)?.id);
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
      say(ruleRefused(made));
      return;
    }
    words = "";
    days = 0;
    await reload();
    say(addedMessage(typed, made.ids.length, length), async () => {
      const refusal = (await deleteRule(made.id)) ?? (made.ids.length > 0 ? await setMuted(made.ids, false) : undefined);
      if (refusal && refusal !== "gone") {
        say(ruleRefused(refusal));
        return;
      }
      const n = made.ids.length;
      say(n > 0 ? `Put back the ${n === 1 ? "article" : `${n} articles`} about “${typed}”. It's no longer hidden.` : `“${typed}” is no longer hidden.`);
      await reload();
    });
    field?.focus();
  }

  /** Remove: gone at once, with Undo making it again, for the time it had left. */
  async function remove(rule: Rule, index: number) {
    if (busy) return;
    const refusal = await deleteRule(rule.id);
    if (refusal && refusal !== "gone") {
      say(ruleRefused(refusal));
      return;
    }
    await reload();
    say(`Removed ${wordShown(rule)}.`, async () => {
      // Made again under a new number: harmless, as the order never decides what's hidden.
      const made = await createRule({ ...rule });
      say(typeof made === "string" ? ruleRefused(made) : `${wordShown(rule)} is back.`);
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
            <span>Only from {forName}</span>
            <button type="button" class="btn btn-small" onclick={() => (forFeed = undefined)}>Everyone instead</button>
          </p>
        {/if}
        <div class="flex w-full items-center gap-2">
          <label for="hide-word" class="sr-only">{forName ? `Hide articles from ${forName} about` : "Hide articles about"}</label>
          <input
            id="hide-word"
            bind:this={field}
            bind:value={words}
            oninput={() => (empty = false)}
            type="text"
            autocomplete="off"
            placeholder="Hide articles about…"
            aria-invalid={empty}
            aria-describedby={empty ? "hide-empty" : undefined}
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
      </div>
    </form>
    {#each rules ?? [] as rule, index (rule.id)}
      {@const line = ruleLine(rule, people, now)}
      <div class="inset-row word-row">
        <span class="flex min-w-0 flex-1 flex-col py-1.5">
          <span class="break-words">{wordShown(rule)}</span>
          <span class="text-meta text-muted">{line}</span>
        </span>
        <button type="button" data-remove class="btn btn-small" aria-label={`Remove ${wordShown(rule)}, ${line}`} onclick={() => remove(rule, index)}>Remove</button>
      </div>
    {/each}
    {#if muted > 0}
      <a href="/settings/hidden" onclick={onMuted} data-settings-row="muted" class="inset-row inset-action"
        >Hidden articles<span class="row-glyph flex items-center"><Icon name="chevron-right" size={18} /></span></a
      >
    {/if}
  </div>
  {#if empty}
    <p id="hide-empty" class="inset-foot flex items-start gap-1.5 text-danger">
      <span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>Type a word or phrase first.
    </p>
  {/if}
  <div role="status" class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1 text-ink", !message && "sr-only"]}>
    {#if message}
      <p>{message}</p>
      {#if undo}
        <button type="button" class="btn btn-small" aria-disabled={busy} onclick={runUndo}>Undo</button>
      {/if}
    {/if}
  </div>
  {#if failed}
    <p role="status" class="inset-foot text-danger">What's hidden couldn't be loaded. Try again in a moment.</p>
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
