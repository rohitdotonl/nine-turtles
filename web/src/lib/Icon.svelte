<!--
  slowfeed's few icons, drawn on one 20px grid with the same 1.5px line, so
  they look like one set. Screen readers skip them: the word beside an icon,
  or the label of an icon-only button, says what it does.
-->
<script lang="ts" module>
  export type IconName = "refresh" | "check" | "edit" | "open" | "link" | "share" | "unread" | "close" | "back" | "search" | "sliders" | "star" | "plus" | "settings" | "sidebar" | "keyboard" | "dot" | "stack" | "chevron-down" | "alert" | "aa" | "more" | "chevron-right" | "download" | "sign-out";
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
    <rect x="3" y="4.75" width="14" height="10.5" rx="1.25" />
    <path d="m3.5 5.5 6.5 5 6.5-5" />
  {:else if name === "close"}
    <path d="m5 5 10 10M15 5 5 15" />
  {:else if name === "back"}
    <path d="M12.5 4 6.5 10l6 6" />
  {:else if name === "search"}
    <circle cx="8.5" cy="8.5" r="5.75" />
    <path d="m12.75 12.75 4.5 4.5" />
  {:else if name === "sliders"}
    <path d="M3 6h2M9 6h8M3 14h8M15 14h2" />
    <circle cx="7" cy="6" r="2" />
    <circle cx="13" cy="14" r="2" />
  {:else if name === "plus"}
    <path d="M10 4v12M4 10h12" />
  {:else if name === "settings"}
    <!-- A cog: eight teeth round a hole. -->
    <path d="M8.65 4.46 L8.89 2.68 A7.4 7.4 0 0 1 11.11 2.68 L11.35 4.46 A5.7 5.7 0 0 1 12.96 5.13 L14.39 4.04 A7.4 7.4 0 0 1 15.96 5.61 L14.87 7.04 A5.7 5.7 0 0 1 15.54 8.65 L17.32 8.89 A7.4 7.4 0 0 1 17.32 11.11 L15.54 11.35 A5.7 5.7 0 0 1 14.87 12.96 L15.96 14.39 A7.4 7.4 0 0 1 14.39 15.96 L12.96 14.87 A5.7 5.7 0 0 1 11.35 15.54 L11.11 17.32 A7.4 7.4 0 0 1 8.89 17.32 L8.65 15.54 A5.7 5.7 0 0 1 7.04 14.87 L5.61 15.96 A7.4 7.4 0 0 1 4.04 14.39 L5.13 12.96 A5.7 5.7 0 0 1 4.46 11.35 L2.68 11.11 A7.4 7.4 0 0 1 2.68 8.89 L4.46 8.65 A5.7 5.7 0 0 1 5.13 7.04 L4.04 5.61 A7.4 7.4 0 0 1 5.61 4.04 L7.04 5.13 A5.7 5.7 0 0 1 8.65 4.46Z" />
    <circle cx="10" cy="10" r="2.25" />
  {:else if name === "dot"}
    <!-- Unread: a ring with a filled centre. -->
    <circle cx="10" cy="10" r="6.75" />
    <circle cx="10" cy="10" r="2.25" fill="currentColor" stroke="none" />
  {:else if name === "stack"}
    <!-- All: a short stack of pages. -->
    <rect x="3.25" y="7.25" width="13.5" height="9.5" rx="1.5" />
    <path d="M5.25 4.75h9.5M7.25 2.5h5.5" />
  {:else if name === "keyboard"}
    <rect x="2.25" y="5.25" width="15.5" height="10" rx="1.75" />
    <path d="M5.5 8.5h.01M8.5 8.5h.01M11.5 8.5h.01M14.5 8.5h.01M7 12h6" />
  {:else if name === "sidebar"}
    <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.5" />
    <path d="M7.75 3.75v12.5" />
  {:else if name === "star"}
    <path
      d="M10 2.5l2.4 4.9 5.35.78-3.87 3.77.91 5.33L10 14.77l-4.79 2.51.91-5.33-3.87-3.77 5.35-.78z"
      fill={filled ? "currentColor" : "none"}
    />
  {:else if name === "chevron-down"}
    <path d="m5.5 8 4.5 4.5L14.5 8" />
  {:else if name === "chevron-right"}
    <!-- A row that leads on to something (a file chooser, a flow): ›. -->
    <path d="m8 5.5 4.5 4.5L8 14.5" />
  {:else if name === "download"}
    <!-- A row that saves a file: an arrow down onto a tray. -->
    <path d="M10 3.25v9.5" />
    <path d="m6.25 9 3.75 3.75L13.75 9" />
    <path d="M3.75 13.5v1.75a1 1 0 0 0 1 1h10.5a1 1 0 0 0 1-1V13.5" />
  {:else if name === "sign-out"}
    <!-- Leaving: an arrow out through an open door. -->
    <path d="M8.25 3.75h-3.5a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h3.5" />
    <path d="M8.5 10h8.25" />
    <path d="m13.5 6.75 3.25 3.25-3.25 3.25" />
  {:else if name === "alert"}
    <circle cx="10" cy="10" r="7.25" />
    <path d="M10 6.5v4" />
    <path d="M10 13.4v.1" />
  {:else if name === "aa"}
    <!-- The reading panel: a large A and a small a, like a book app's type button. -->
    <path d="M2.5 16 7 4l4.5 12M4.2 11.75h5.6" />
    <circle cx="14.75" cy="13.5" r="2.5" />
    <path d="M17.25 10.5V16" />
  {:else if name === "more"}
    <!-- More: three dots in a row. -->
    <circle cx="4.5" cy="10" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="10" r="1.25" fill="currentColor" stroke="none" />
  {/if}
</svg>
