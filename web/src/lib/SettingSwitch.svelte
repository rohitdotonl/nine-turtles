<!--
  The one switch row (decision 0315): its name with a short description
  under it, as Settings' rows are (decision 0120), its icon before them in
  Settings, and the switch at the row's end. It changes the moment it's
  switched; the page saves it. Settings' Unread and Record replies, the
  weekly email, and on a person's or publication's page (SPEC section 36)
  Write back, Pause for a while, and a YouTube channel's Include Shorts and
  Include live streams (section 38).
-->
<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    name,
    hint,
    checked,
    onchange,
    icon,
    disabled = false,
    nested = false,
    id: named,
  }: {
    name: string;
    hint: string;
    checked: boolean;
    onchange: (on: boolean) => void;
    /** Settings' rows show their icon before the words. */
    icon?: IconName;
    /** While what it shows isn't known yet. */
    disabled?: boolean;
    nested?: boolean;
    /** Names its words `{id}-name` and `{id}-hint`. */
    id?: string;
  } = $props();
  const made = $props.id();
  const id = $derived(named ?? made);
</script>

{#snippet words()}
  <div class="setting-words">
    <!-- Hidden here: the switch itself carries the name. -->
    <p id="{id}-name" class="setting-name" aria-hidden="true">{name}</p>
    <p id="{id}-hint" class="setting-hint">{hint}</p>
  </div>
{/snippet}

<div class={["inset-row setting", nested && "nested"]}>
  {#if icon}
    <div class="setting-label">
      <span class="setting-icon" aria-hidden="true"><Icon name={icon} /></span>
      {@render words()}
    </div>
  {:else}
    {@render words()}
  {/if}
  <label class="switch-target -my-2 -mr-2">
    <input type="checkbox" role="switch" class="switch" aria-label={name} aria-describedby="{id}-hint" {checked} {disabled} onchange={(event) => onchange(event.currentTarget.checked)} />
  </label>
</div>

<style>
  /* Under a source's row, one step in, so it reads as that source's own. */
  .nested {
    padding-left: 2rem;
  }
  .nested::before {
    left: 2rem !important;
  }
</style>
