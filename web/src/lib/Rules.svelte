<!--
  Settings › Rules (SPEC section 27): each rule as one plain sentence, with a
  switch to pause it and an Edit button; "New rule…" at the group's foot;
  and, once anything is muted, "Muted articles ›". The editor itself opens
  from Settings (RuleEditor). After a new rule is saved, the line under the
  group asks once whether to apply it to the unread articles that already
  match, with the number first; whatever it did, or deleting a rule, can be
  undone from the same line until the next action there.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import type { Feed, Folder } from "./feeds";
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
    type RuleAction,
    type RuleDraft,
  } from "./rules";

  let {
    feeds,
    folders,
    onNew,
    onEdit,
    onMuted,
  }: {
    feeds: Feed[];
    folders: Folder[];
    onNew: () => void;
    onEdit: (rule: Rule) => void;
    /** Opens the Muted articles page. */
    onMuted: (event: MouseEvent) => void;
  } = $props();

  let rules: Rule[] | undefined = $state();
  let muted = $state(0);
  let failed = $state(false);
  /** The line under the group: what just happened, and what can be done about it. */
  let message = $state("");
  let question: { id: number; action: RuleAction; count: number } | undefined = $state();
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
  export async function saved(draft: RuleDraft, made?: { id: number; matching: number }) {
    clear();
    await reload();
    if (made && made.matching > 0) {
      question = { id: made.id, action: draft.action, count: made.matching };
      await tick();
      line?.querySelector<HTMLElement>("[data-focus=yes]")?.focus();
    } else {
      message = made ? "Rule saved. It acts on new articles as they arrive." : "Rule saved.";
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
    message = "Deleted the rule.";
    undo = async () => {
      const made = await createRule({ ...rule, paused: rule.paused });
      if (typeof made === "string") {
        message = ruleRefused(made);
        return;
      }
      message = "The rule is back.";
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
    const { id, action } = question;
    busy = true;
    const ids = await applyRule(id);
    busy = false;
    question = undefined;
    if (!Array.isArray(ids)) {
      message = ruleRefused(ids);
      return;
    }
    message = appliedMessage(action, ids.length);
    undo = async () => {
      const refusal = await unapply(action, ids);
      message = refusal ? ruleRefused(refusal) : "Undone: those articles are as they were.";
      await reload();
    };
    await reload();
    await focusLine();
  }

  function notNow() {
    question = undefined;
    message = "Rule saved. It acts on new articles as they arrive.";
  }

  async function runUndo() {
    if (!undo || busy) return;
    const doing = undo;
    undo = undefined;
    busy = true;
    await doing();
    busy = false;
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
  <h3 id="rules-heading" tabindex="-1" class="inset-head">Rules</h3>
  <div class="inset-group">
    {#each rules ?? [] as rule (rule.id)}
      {@const sentence = describe(rule, feeds, folders)}
      <div class="inset-row rule-row">
        <p id={`rule-${rule.id}`} class={["min-w-0 flex-1 break-words", rule.paused && "text-ink-2"]}>
          {sentence}{#if rule.paused}{" "}<span class="text-muted">Paused.</span>{/if}
        </p>
        <span class="flex shrink-0 items-center gap-2">
          <button type="button" class="btn btn-small" aria-label={`Edit rule: ${sentence}`} onclick={() => edit(rule)}>Edit</button>
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
    <button type="button" class="inset-row inset-action" onclick={startNew}>New rule…</button>
    {#if muted > 0}
      <a href="/settings/muted" onclick={onMuted} class="inset-row inset-action"
        >Muted articles<span class="row-glyph flex items-center gap-1"><span class="text-meta">{muted}</span><Icon name="chevron-right" size={18} /></span></a
      >
    {/if}
  </div>
  <div bind:this={line} role="status" class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1 text-ink", !message && !question && "sr-only"]}>
    {#if question}
      <p>{applyQuestion(question.action, question.count)}</p>
      <span class="flex gap-2">
        <button type="button" class="btn btn-small" data-focus="yes" aria-disabled={busy} onclick={apply}
          >{question.action === "mute" ? "Mute them" : question.action === "star" ? "Star them" : "Mark them read"}</button
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
    <p role="status" class="inset-foot text-danger">The rules couldn't be loaded. Try again in a moment.</p>
  {/if}
  <p class="inset-foot">
    When a new article matches a rule, it's muted, starred or marked as read as it arrives. Muted articles are kept, never
    deleted: search still finds them, and other apps see them as read.
  </p>
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
