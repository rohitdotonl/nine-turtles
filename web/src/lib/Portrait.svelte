<!--
  A picture of someone or something followed (SPEC section 36, decision
  0284): beside an article's byline, and at the top of their page. Each
  picture given is tried in turn (portrait.ts → picturesOf); the first one
  big enough fills the circle. A small one (a site's tab icon) sits small in
  the middle of it, if nothing bigger loads; with none, their initials. The
  circle shows only its tone while pictures load, so initials never flash
  before a picture. Their name is always beside it, so screen readers skip it.
-->
<script lang="ts">
  import { CRISP, initialsOf, isMissing, markMissing } from "./portrait";

  let {
    name,
    pictures,
    person = true,
    large = false,
    beside = false,
  }: {
    name: string;
    pictures: string[];
    person?: boolean;
    large?: boolean;
    /** Beside a line of text (the byline): it reaches into the room above and below, so the line, and all under it, stays where it was. */
    beside?: boolean;
  } = $props();

  let tried = $state(0);
  let small: string | undefined = $state();
  let filled: string | undefined = $state();
  // Another person, or a picture just chosen: start again from the first.
  $effect(() => {
    void pictures.join(" ");
    tried = 0;
    small = undefined;
    filled = undefined;
  });
  // A picture this tab already found missing isn't asked for again.
  let tryable = $derived(pictures.filter((each) => !isMissing(each)));
  let trying = $derived(filled ? undefined : tryable[tried]);
  let initials = $derived(initialsOf(name, person));

  function loaded(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    if (image.naturalWidth >= CRISP) filled = image.src;
    else {
      small ??= image.src;
      tried += 1;
    }
  }
</script>

<span aria-hidden="true" class={["portrait", large && "large", beside && "beside"]}>
  {#if filled}
    <img src={filled} alt="" referrerpolicy="no-referrer" />
  {:else if trying}
    <!-- Looked at, not yet shown. -->
    {#key trying}<img src={trying} alt="" referrerpolicy="no-referrer" class="trying" onload={loaded} onerror={() => {
          markMissing(trying!);
          tried += 1;
        }} />{/key}
  {:else if small}
    <img src={small} alt="" referrerpolicy="no-referrer" class="inside" />
  {:else}
    <span class="initials">{initials}</span>
  {/if}
</span>

<style>
  /* A circle in the grouped rows' tone with a faint edge, so a white picture still has its round shape on a white page. */
  .portrait {
    position: relative;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    background-color: var(--group, var(--list));
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .portrait.beside {
    margin-block: -0.75rem;
  }
  /* On a phone the title sits closer above the byline: a smaller circle keeps its room. */
  @media (width < 48rem) {
    .portrait.beside {
      width: 2rem;
      height: 2rem;
      margin-block: -0.5rem;
    }
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
  img.trying {
    position: absolute;
    opacity: 0;
  }
  img.inside {
    width: 55%;
    height: 55%;
    object-fit: contain;
  }
  /* Their initials in the titles' face, in the second ink: a monogram, never a color of their own. */
  .initials {
    color: var(--ink-2);
    font-family: var(--font-display);
    font-size: var(--text-ui);
    line-height: 1;
    letter-spacing: 0.02em;
  }
  .large .initials {
    font-size: var(--text-heading);
  }
</style>
