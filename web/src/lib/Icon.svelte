<!--
  slowfeed's few icons, drawn on one 20px grid with the same 1.5px line, so
  they look like one set (DESIGN.md → "Words beside icons"). Always beside a
  word, so screen readers skip them.
-->
<script lang="ts" module>
  export type IconName = "refresh" | "check" | "edit" | "open" | "link" | "share" | "unread" | "close" | "search" | "sliders" | "star";
</script>

<script lang="ts">
  // `filled` fills a shape that has an inside (the star, when starred).
  let { name, size = 18, filled = false }: { name: IconName; size?: number; filled?: boolean } = $props();
</script>

<svg
  aria-hidden="true"
  width={size}
  height={size}
  viewBox="0 0 20 20"
  fill="none"
  stroke="currentColor"
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {#if name === "refresh"}
    <path d="M16.25 10a6.25 6.25 0 1 1-1.83-4.42" />
    <path d="M16.25 3.25v3.5h-3.5" />
  {:else if name === "check"}
    <path d="m3.75 10.5 3.5 3.5 9-9" />
  {:else if name === "edit"}
    <path d="M12.5 4.5 15.5 7.5" />
    <path d="M3.75 16.25 4.5 12.5 13.75 3.25a1.06 1.06 0 0 1 1.5 0l1.5 1.5a1.06 1.06 0 0 1 0 1.5L7.5 15.5Z" />
  {:else if name === "open"}
    <path d="M11.25 3.75h5v5" />
    <path d="M16.25 3.75 9 11" />
    <path d="M14.25 11.75v3.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1h3.5" />
  {:else if name === "link"}
    <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.54 3.54 0 0 0-5-5l-.75.75" />
    <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.54 3.54 0 0 0 5 5l.75-.75" />
  {:else if name === "share"}
    <path d="M10 12.5V2.75" />
    <path d="M6.5 6.25 10 2.75l3.5 3.5" />
    <path d="M6.25 9H5a1 1 0 0 0-1 1v6.25a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-1.25" />
  {:else if name === "unread"}
    <circle cx="10" cy="10" r="6.25" />
    <circle cx="10" cy="10" r="2.25" fill="currentColor" />
  {:else if name === "close"}
    <path d="m5 5 10 10M15 5 5 15" />
  {:else if name === "search"}
    <circle cx="8.5" cy="8.5" r="5.75" />
    <path d="m12.75 12.75 4.5 4.5" />
  {:else if name === "sliders"}
    <path d="M3 6h2M9 6h8M3 14h8M15 14h2" />
    <circle cx="7" cy="6" r="2" />
    <circle cx="13" cy="14" r="2" />
  {:else if name === "star"}
    <path
      d="M10 2.5l2.4 4.9 5.35.78-3.87 3.77.91 5.33L10 14.77l-4.79 2.51.91-5.33-3.87-3.77 5.35-.78z"
      fill={filled ? "currentColor" : "none"}
    />
  {/if}
</svg>
