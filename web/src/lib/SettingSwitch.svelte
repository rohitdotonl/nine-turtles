<!--
  One switch row on a person's or publication's page (SPEC section 36):
  its name with a short description under it, as Settings' rows are
  (decision 0120), and the switch at the row's end. It changes the moment
  it's switched; the page saves it. Pause for a while, and a YouTube
  channel's Include Shorts and Include live streams (section 38).
-->
<script lang="ts">
  let { name, hint, checked, onchange, nested = false }: { name: string; hint: string; checked: boolean; onchange: (on: boolean) => void; nested?: boolean } = $props();
  const id = $props.id();
</script>

<div class={["inset-row setting", nested && "nested"]}>
  <div class="setting-words">
    <!-- Hidden here: the switch itself carries the name, as Settings' Unread does. -->
    <span class="setting-name" aria-hidden="true">{name}</span>
    <span id="{id}-hint" class="setting-hint">{hint}</span>
  </div>
  <label class="switch-target -my-2 -mr-2">
    <input type="checkbox" role="switch" class="switch" aria-label={name} aria-describedby="{id}-hint" {checked} onchange={(event) => onchange(event.currentTarget.checked)} />
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
