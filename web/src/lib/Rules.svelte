<!--
  Settings › Hiding (SPEC section 27): each rule as its sentence ("Hide
  articles about “crypto” from everyone."), with a switch to pause it and an
  Edit button; "Hide articles about…" at the group's foot; and, once
  anything is hidden, "Hidden articles ›". The editor itself opens from
  Settings (RuleEditor). After a new rule is saved, the line under the
  group asks once whether to apply it to the unread articles that already
  match, with the number first; whatever it did, or deleting a rule, can be
  undone from the same line until the next action there.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { UNDONE, UNDO_FAILED } from "./messages";
  import type { Feed } from "./shapes";
  import {
    appliedMessage,
    applyQuestion,
    applyRule,
    createRule,
    deleteRule,
    describe,
    listRules,
    pauseRule,
    ruleRefused,
    unapply,
    type Rule,
    type RuleDraft,
  } from "./rules";

  let {
    people,
    onNew,
    onEdit,
    onMuted,
  }: {
    /** Everyone the reader follows, one row each (the sidebar's rows). */
    people: Feed[];
    onNew: () => void;
    onEdit: (rule: Rule) => void;
    /** Opens the Hidden articles page. */
    onMuted: (event: MouseEvent) => void;
  } = $props();

  let rules: Rule[] | undefined = $state();
  let muted = $state(0);
  let failed = $state(false);
  /** The line under the group: what just happened, and what can be done about it. */
  let message = $state("");
  let question: { id: number; count: number } | undefined = $state();
  let undo: (() => Promise<void>) | undefined = $state();
  let busy = $state(false);
  let line: HTMLElement | undefined = $state();

  export async function reload() {
    try {
      const listed = await listRules();
      rules = listed.rules;
      muted = listed.muted;
      failed = false;
    } catch {
      failed = true;
    }
  }

  $effect(() => {
    reload();
  });

  function clear() {
    message = "";
    question = undefined;
    undo = undefined;
  }

  /** The editor saved a rule: list it, and for a new one ask about articles already here. */
  export async function saved(_draft: RuleDraft, made?: { id: number; matching: number }) {
    clear();
    await reload();
    if (made && made.matching > 0) {
      question = { id: made.id, count: made.matching };
      await tick();
      line?.querySelector<HTMLElement>("[data-focus=yes]")?.focus();
    } else {
      message = made ? "Rule saved. New articles about it are hidden as they arrive." : "Rule saved.";
    }
  }

  /** The editor's Delete: gone at once, with Undo making it again. */
  export async function remove(rule: Rule) {
    clear();
    const refusal = await deleteRule(rule.id);
    if (refusal && refusal !== "gone") {
      message = ruleRefused(refusal);
      return;
    }
    await reload();
    message = "Rule deleted.";
    // Made again under a new number: harmless, as the order never decides what's hidden.
    undo = async () => {
      const made = await createRule({ ...rule, paused: rule.paused });
      if (typeof made === "string") {
        message = made === "trouble" ? UNDO_FAILED : ruleRefused(made);
        return;
      }
      message = UNDONE;
      await reload();
    };
    await focusLine();
  }

  async function focusLine() {
    await tick();
    line?.querySelector<HTMLElement>("[data-focus=undo]")?.focus();
  }

  async function apply() {
    if (!question || busy) return;
    const { id } = question;
    busy = true;
    const ids = await applyRule(id);
    busy = false;
    question = undefined;
    if (!Array.isArray(ids)) {
      message = ruleRefused(ids);
      return;
    }
    message = appliedMessage(ids.length);
    undo = async () => {
      const refusal = await unapply(ids);
      message = refusal === undefined ? UNDONE : refusal === "trouble" ? UNDO_FAILED : ruleRefused(refusal);
      await reload();
    };
    await reload();
    await focusLine();
  }

  /** The button the keyboard was on is gone: its place goes to the group's heading, never the page's top. */
  async function keepPlace() {
    await tick();
    document.getElementById("rules-heading")?.focus();
  }

  async function notNow() {
    question = undefined;
    message = "Rule saved. New articles about it are hidden as they arrive.";
    await keepPlace();
  }

  async function runUndo() {
    if (!undo || busy) return;
    const doing = undo;
    undo = undefined;
    busy = true;
    await doing();
    busy = false;
    await keepPlace();
  }

  async function toggle(rule: Rule, on: boolean) {
    clear();
    rule.paused = !on;
    const refusal = await pauseRule(rule.id, !on);
    if (refusal) {
      rule.paused = on;
      message = ruleRefused(refusal);
    }
  }

  function edit(rule: Rule) {
    clear();
    onEdit(rule);
  }

  function startNew() {
    clear();
    onNew();
  }
</script>

<section aria-labelledby="rules-heading">
  <h3 id="rules-heading" tabindex="-1" class="inset-head">Hiding</h3>
  <div class="inset-group">
    {#each rules ?? [] as rule (rule.id)}
      {@const sentence = describe(rule, people)}
      <div class="inset-row rule-row">
        <p id={`rule-${rule.id}`} class={["min-w-0 flex-1 break-words", rule.paused && "text-ink-2"]}>
          {sentence}{#if rule.paused}{" "}<span class="text-muted">Paused.</span>{/if}
        </p>
        <span class="flex shrink-0 items-center gap-2">
          <button type="button" class="btn btn-small" aria-label={`Edit: ${sentence}`} onclick={() => edit(rule)}>Edit</button>
          <!-- A switch, as Apple draws one: on is filled in the text color, off is an empty track; its knob's side says which too. -->
          <label class="switch-target" title={rule.paused ? "Paused: press to start it again" : "On: press to pause it"}>
            <input
              type="checkbox"
              role="switch"
              class="switch"
              checked={!rule.paused}
              aria-label={`On: ${sentence}`}
              onchange={(event) => toggle(rule, event.currentTarget.checked)}
            />
          </label>
        </span>
      </div>
    {/each}
    <button type="button" class="inset-row inset-action" onclick={startNew}>Hide articles about…</button>
    {#if muted > 0}
      <a href="/settings/hidden" onclick={onMuted} data-settings-row="muted" class="inset-row inset-action"
        >Hidden articles<span class="row-glyph flex items-center"><Icon name="chevron-right" size={18} /></span></a
      >
    {/if}
  </div>
  <div bind:this={line} role="status" class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1 text-ink", !message && !question && "sr-only"]}>
    {#if question}
      <p>{applyQuestion(question.count)}</p>
      <span class="flex gap-2">
        <button type="button" class="btn btn-small" data-focus="yes" aria-disabled={busy} onclick={apply}
          >Hide them</button
        >
        <button type="button" class="btn btn-small" onclick={notNow}>Not now</button>
      </span>
    {:else if message}
      <p>{message}</p>
      {#if undo}
        <button type="button" class="btn btn-small" data-focus="undo" aria-disabled={busy} onclick={runUndo}>Undo</button>
      {/if}
    {/if}
  </div>
  {#if failed}
    <p role="status" class="inset-foot flex items-start gap-1.5 text-danger"><span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>What's hidden couldn't be loaded. Try again in a moment.</p>
  {/if}
  <p class="inset-foot">Hidden articles are kept, and search still finds them.</p>
</section>

<style>
  .rule-row {
    flex-wrap: nowrap;
    align-items: center;
    padding-block: 0.5rem;
  }
  .rule-row > p {
    line-height: 1.4;
  }
  @media (width < 30rem) {
    .rule-row {
      flex-wrap: wrap;
    }
    .rule-row > span {
      margin-left: auto;
    }
  }
</style>
