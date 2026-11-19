<!--
  The name, standing alone at the top of every page outside the app (sign-in,
  sign-up, the emailed links, the weekly email's stop page, connecting an
  assistant): Literata 600 in its display cut, as every title of 24px and more
  (docs/BRAND.md → "Typefaces", "The logo"). One copy, so it can't drift.
-->
<script lang="ts">
  /** Given an id, the keyboard can wait on the name (a page whose Try again goes while it asks); never a Tab stop. */
  let { id }: { id?: string } = $props();
</script>

<h1 {id} tabindex="-1" class="font-display text-display font-semibold">nine turtles</h1>
