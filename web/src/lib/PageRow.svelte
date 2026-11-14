<!--
  A row that opens a page of its own (decision 0120): its icon, its name, perhaps what it's set
  to, then ›. Settings' own pages open from these, and so do one person's settings, from their
  page (decision 0267). Screen readers hear "Opens its own page." after its name.
-->
<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    key,
    href,
    label,
    icon,
    onclick,
    value,
    named,
  }: {
    /** Its `data-settings-row`, so the keyboard comes back to it from the page it opens. */
    key: string;
    href: string;
    label: string;
    icon: IconName;
    onclick: (event: MouseEvent) => void;
    /** What it's set to, quietly before the ›. */
    value?: string;
    /** Its whole name for screen readers and voice control, when the words seen need more ("Settings for Mira Chen"); it starts with them. */
    named?: string;
  } = $props();

  const id = $props.id();
</script>

<a {href} {onclick} data-settings-row={key} aria-label={named} aria-describedby="{id}-opens" class="inset-row inset-action setting">
  <span class="setting-label"><span class="setting-icon" aria-hidden="true"><Icon name={icon} /></span><span class="setting-words"><span class="setting-name">{label}</span></span></span>
  <span class="row-glyph flex items-center gap-2"
    >{#if value}<span class="setting-value">{value}</span>{/if}<Icon name="chevron-right" /></span
  >
  <!-- Inside the row, so rows stay side by side for the hairline between them; hidden, so it's never part of the row's name. -->
  <span id="{id}-opens" hidden>Opens its own page.</span>
</a>

<style>
  /* What it's set to (the plan), before its ›. */
  .setting-value {
    font-size: var(--text-meta);
  }
</style>
