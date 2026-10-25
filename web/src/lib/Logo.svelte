<!--
  nine turtles' logo (DESIGN.md → "Name and signature", decision 0067): nine
  small turtles seen from the side, the middle row a little to the right, in
  the color of the text around it. It sits beside the name, which says it in
  words, so screen readers skip it. The same drawing is in docs/logo/ and in
  the website's top bar (website/src/_includes/base.njk): change all three together.
-->
<script lang="ts">
  // Sized by height, a touch taller than the name's letters beside it
  // (DESIGN.md → "Name and signature").
  let { height }: { height: number } = $props();
</script>

<svg
  class="logo flex-none"
  viewBox="7 16 86 68"
  width={Math.round((height * 86) / 68)}
  height={height}
  aria-hidden="true"
  focusable="false"
>
  <g fill="currentColor">
    <g transform="translate(18.50 22.70) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(46.10 22.70) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(73.70 22.70) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(24.50 50.30) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(52.10 50.30) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(79.70 50.30) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(18.50 77.90) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(46.10 77.90) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g><g transform="translate(73.70 77.90) scale(1.15)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z"/><circle cx="8.6" cy="0.6" r="2"/></g>
  </g>
</svg>
