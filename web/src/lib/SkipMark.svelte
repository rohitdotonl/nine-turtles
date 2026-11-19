<!--
  Back 15 and forward 30, one drawing for both players (the episode's own and
  Now playing): an arrow round a circle with the seconds inside, in the
  interface's face with its plain zero, on the one 1.5px line (BRAND.md →
  "Icons"; drawn larger than an icon to hold its figure, DESIGN.md → "The system").
-->
<script lang="ts">
  let { seconds, forward = false }: { seconds: number; forward?: boolean } = $props();
</script>

<svg aria-hidden="true" class="skip" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
  >{#if forward}<path d="M20.5 12.5a8.5 8.5 0 1 1-2.5-6" /><path d="M18.25 2.75v3.75h-3.75" />{:else}<path d="M3.5 12.5a8.5 8.5 0 1 0 2.5-6" /><path d="M5.75 2.75v3.75h3.75" />{/if}<text
    x="12"
    y="14.9"
    text-anchor="middle"
    font-size="7.5">{seconds}</text
  ></svg
>

<style>
  .skip text {
    stroke: none;
    fill: currentColor;
    font-family: var(--font-sans);
    font-weight: 600;
  }
</style>
