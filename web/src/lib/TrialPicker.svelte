<!-- TRIAL ONLY: switches the Unread list between the directions being tried (unreadTrial.svelte.ts). -->
<script lang="ts">
  import { LOOKS, setLook, trial, type Look } from "./unreadTrial.svelte";
</script>

<label class="trial-picker">
  <span>Try</span>
  <select value={trial.look} onchange={(event) => setLook((event.currentTarget as HTMLSelectElement).value as Look)}>
    {#each LOOKS as [value, label] (value)}<option {value}>{label}</option>{/each}
  </select>
</label>

<style>
  .trial-picker {
    position: fixed;
    z-index: 60;
    right: 12px;
    bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px 6px 14px;
    border-radius: 999px;
    background: #141414;
    color: #efeff1;
    font-size: 14px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
  }
  select {
    min-height: 32px;
    border-radius: 999px;
    padding: 0 10px;
    background: #2a2a2c;
    color: #efeff1;
    font-size: 14px;
  }
</style>
