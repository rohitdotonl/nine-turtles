<!--
  A row's menu in the article list (SPEC section 6, decision 0213): the same
  menu as More's (`MenuList.svelte`), opened where the row was pressed and
  kept on the screen. The keyboard starts on its first choice; Escape or a
  choice gives the keyboard back to the row, and a press anywhere outside
  closes it.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import MenuList from "./MenuList.svelte";
  import type { MenuGroup } from "./MoreMenu.svelte";

  let {
    label,
    groups,
    at,
    onClose,
  }: {
    label: string;
    groups: MenuGroup[];
    /** Where the row was pressed. */
    at: { x: number; y: number };
    onClose: (giveBack: boolean) => void;
  } = $props();

  const ID = "row-menu";
  /** Moved to stay on the screen, once its size is known. */
  let kept: { x: number; y: number } | undefined = $state();
  let list: MenuList | undefined = $state();

  onMount(() => {
    const box = document.getElementById(ID)?.getBoundingClientRect();
    const room = 8;
    if (box) {
      kept = {
        x: Math.max(room, Math.min(at.x, innerWidth - box.width - room)),
        y: at.y + box.height + room > innerHeight ? Math.max(room, at.y - box.height) : at.y,
      };
    }
    void list?.focus();
  });
</script>

<svelte:window
  onpointerdown={(event) => {
    if (!list?.holds(event.target as Node)) onClose(false);
  }}
  onresize={() => onClose(false)}
/>

<MenuList bind:this={list} id={ID} {label} {groups} at={kept ?? at} {onClose} />
