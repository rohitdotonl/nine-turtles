<!--
  nine turtles' logo (docs/BRAND.md → "The logo", decision 0067): nine small
  turtles seen from the side, a half-circle shell and a round head each, in
  three rows of three, the middle row a little to the right, in the color of
  the text around it. This is the original drawing, brought back on
  4 November 2026 in place of the heavier redrawn nine (D2). Its box ends at
  the turtles' edges and the shells' feet, so beside the name (aligned to the
  baseline) the turtles stand on the name's line. The name says it in words,
  so screen readers skip it. The same drawing is in the website's band
  (website/src/_includes/base.njk) and docs/logo/: change them together.
-->
<script lang="ts">
  // Sized by height: 27px beside the 22px name in the sidebar (BRAND.md).
  // `inline` sets it in the name's line of text, its feet on the baseline and
  // 9px before the name, as the website's band does.
  let { height, inline = false }: { height: number; inline?: boolean } = $props();

  // Where each turtle stands: three rows of three, the middle row shifted right.
  const turtles = [
    [18.5, 22.7], [46.1, 22.7], [73.7, 22.7],
    [24.5, 50.3], [52.1, 50.3], [79.7, 50.3],
    [18.5, 77.9], [46.1, 77.9], [73.7, 77.9],
  ];
</script>

<svg
  class={["logo flex-none", inline && "mr-2 inline align-baseline"]}
  viewBox="8.15 18.1 83.74 63.83"
  width={Math.round((height * 83.74) / 63.83)}
  height={height}
  aria-hidden="true"
  focusable="false"
>
  <g fill="currentColor">
    {#each turtles as [x, y] (`${x} ${y}`)}
      <g transform="translate({x} {y}) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z" /><circle cx="8.6" cy="0.6" r="2" /></g>
    {/each}
  </g>
</svg>
