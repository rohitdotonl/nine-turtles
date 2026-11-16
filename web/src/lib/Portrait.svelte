<!--
  A picture for someone or something followed (prototype): beside the byline,
  and at the top of their page. Their initials, or their site's own icon,
  falling back to initials when the site has none. The name sits beside it,
  so screen readers skip it.
-->
<script lang="ts">
  import { iconsOf, initialsOf, portraitStyle } from "./portrait";

  let { name, siteUrl, person = true, large = false }: { name: string; siteUrl?: string | null; person?: boolean; large?: boolean } = $props();

  const style = portraitStyle();
  let icons = $derived(style === "favicon" ? iconsOf(siteUrl) : []);
  let tried = $state(0);
  let small = $state(false);
  $effect(() => {
    void siteUrl;
    tried = 0;
    small = false;
  });
  let src = $derived(icons[tried]);
  let initials = $derived(initialsOf(name, person));
</script>

<span aria-hidden="true" class={["portrait", large && "large"]}>
  {#if src}
    <img
      {src}
      alt=""
      referrerpolicy="no-referrer"
      class={small ? "inset" : ""}
      onload={(event) => (small = (event.currentTarget as HTMLImageElement).naturalWidth < 96)}
      onerror={() => (tried += 1)}
    />
  {:else}
    <span class="initials">{initials}</span>
  {/if}
</span>

<style>
  .portrait {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    background-color: var(--group, var(--list));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 8%, transparent);
  }
  .portrait.large {
    width: 4.5rem;
    height: 4.5rem;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  img.inset {
    width: 55%;
    height: 55%;
    object-fit: contain;
  }
  .initials {
    color: var(--ink-2);
    font-family: var(--font-display);
    font-size: 1rem;
    line-height: 1;
    letter-spacing: 0.02em;
  }
  .large .initials {
    font-size: 1.75rem;
  }
</style>
