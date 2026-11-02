<!--
  nine turtles' logo (docs/BRAND.md → "The logo", decision 0067):
  the redrawn nine (D2), nine small turtles seen from the side in three rows
  of three, the middle row a little to the right, heavy enough to stay turtles
  at small sizes, in the color of the text around it. Its box ends at the
  shells' feet, so beside the name (aligned to the baseline) the turtles stand
  on the name's line. The name says it in words, so screen readers skip it.
  The same drawing is in docs/logo/ and in the website's top bar
  (website/src/_includes/base.njk): change all three together.
-->
<script lang="ts">
  // Sized by height: 28px beside the 23px name in the sidebar (BRAND.md).
  let { height }: { height: number } = $props();

  // Where each turtle stands: three rows of three, the middle row shifted right.
  const turtles = [
    [9, 6], [35, 6], [61, 6],
    [18, 25], [44, 25], [70, 25],
    [9, 44], [35, 44], [61, 44],
  ];
</script>

<svg
  class="logo flex-none"
  viewBox="0 0 82.9 47.5"
  width={Math.round((height * 82.9) / 47.5)}
  height={height}
  aria-hidden="true"
  focusable="false"
>
  <g fill="currentColor">
    {#each turtles as [x, y] (`${x} ${y}`)}
      <g transform="translate({x} {y})"><path d="M-9 3.5A7.5 9.5 0 0 1 6 3.5Z" /><circle cx="10" cy="-.6" r="2.9" /></g>
    {/each}
  </g>
</svg>
