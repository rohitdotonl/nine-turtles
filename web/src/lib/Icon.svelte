<!--
  nine turtles' few icons, drawn on one 20px grid with the same 1.5px line, so
  they look like one set. Screen readers skip them: the word beside an icon,
  or the label of an icon-only button, says what it does.
-->
<script lang="ts" module>
  export type IconName = "refresh" | "check" | "edit" | "open" | "link" | "share" | "unread" | "close" | "back" | "search" | "sliders" | "star" | "plus" | "settings" | "sidebar" | "sort" | "keyboard" | "dot" | "stack" | "chevron-down" | "alert" | "aa" | "more" | "chevron-right" | "download" | "sign-out" | "clock" | "history" | "shelf" | "folder" | "headphones" | "queue"
    // Settings' rows (decision 0120).
    | "book" | "nine-circle" | "palette" | "a-plus" | "pen-nib" | "feed" | "heart-pulse" | "panel-dots" | "bookmark-plus" | "newspaper" | "plug" | "robot" | "key" | "people" | "card" | "envelope" | "trash";
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
  {:else if name === "clock"}
    <!-- Letting unread go after a while: a clock face. -->
    <circle cx="10" cy="10" r="6.75" />
    <path d="M10 6.25V10l2.5 1.75" />
  {:else if name === "history"}
    <!-- Recently read: a clock face whose rim turns back, as a history. -->
    <path d="M3.75 10a6.25 6.25 0 1 0 1.83-4.42" />
    <path d="M3.75 3.25v3.5h3.5" />
    <path d="M10 6.75V10l2.25 1.5" />
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
  {:else if name === "sort"}
    <!-- Sort order: an arrow down and an arrow up, side by side. -->
    <path d="M6.5 3.5v13M3.5 13.5l3 3 3-3M13.5 16.5v-13M10.5 6.5l3-3 3 3" />
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
    <!-- A clear gap between the two letters, and the small a's stem no taller than its bowl, so it reads as "a", not "d". -->
    <path d="M1.75 16 6 4l4.25 12M3.35 12h5.3" />
    <circle cx="14.5" cy="13.5" r="2.5" />
    <path d="M17 11v5" />
  {:else if name === "headphones"}
    <!-- A podcast's episode (decision 0113): headphones, a band and two ear cups. -->
    <path d="M3.75 13v-2.25a6.25 6.25 0 0 1 12.5 0V13" />
    <path d="M3.75 12.25h1.5a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1h-.5a1 1 0 0 1-1-1Z" />
    <path d="M16.25 12.25h-1.5a1 1 0 0 0-1 1v2.5a1 1 0 0 0 1 1h.5a1 1 0 0 0 1-1Z" />
  {:else if name === "queue"}
    <!-- Up Next (decision 0113): three lines of a list, the first led by a small play mark. -->
    <path d="M3.75 5.25 7 7.25 3.75 9.25Z" />
    <path d="M9.5 7.25h6.75" />
    <path d="M3.75 11.75h12.5" />
    <path d="M3.75 15.25h12.5" />
  {:else if name === "folder"}
    <!-- A folder (decision 0123): a tab on the left of a rounded box. -->
    <path d="M2.75 6.25V5a1.25 1.25 0 0 1 1.25-1.25h3.5l1.75 2h6.75A1.25 1.25 0 0 1 17.25 7v8A1.25 1.25 0 0 1 16 16.25H4A1.25 1.25 0 0 1 2.75 15z" />
    <path d="M2.75 7.75h14.5" />
  {:else if name === "shelf"}
    <!-- A collection (decision 0108): two books upright and one leaning, on a shelf. -->
    <path d="M2.75 16.25h14.5" />
    <path d="M4 16.25V5a.75.75 0 0 1 .75-.75h1.5A.75.75 0 0 1 7 5v11.25" />
    <path d="M7 16.25V7.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v8.75" />
    <path d="m11.5 6.35 2.4-.65 2.6 9.9-2.4.65Z" />
  {:else if name === "more"}
    <!-- More: three dots in a row. -->
    <circle cx="4.5" cy="10" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="10" r="1.25" fill="currentColor" stroke="none" />
  {:else if name === "book"}
    <!-- Settings › Reading mode: an open book. -->
    <path d="M10 5.5c-1.5-1.2-3.5-1.75-6.25-1.75v11c2.75 0 4.75.55 6.25 1.75 1.5-1.2 3.5-1.75 6.25-1.75v-11C13.5 3.75 11.5 4.3 10 5.5Z" />
    <path d="M10 5.5v11" />
  {:else if name === "nine-circle"}
    <!-- Settings › Unread counts: a figure 9 in a ring. -->
    <circle cx="10" cy="10" r="6.75" />
    <path d="M11.75 8.75a1.75 1.75 0 1 1-1.75-1.75 1.75 1.75 0 0 1 1.75 1.75Zm0 0c0 2.5-1.1 4-3.25 4.4" />
  {:else if name === "palette"}
    <!-- Settings › Appearance: a painter's palette. -->
    <path d="M10 3.75a6.25 6.25 0 0 0 0 12.5c1 0 1.5-.75 1.25-1.5-.4-1.1.3-2 1.5-2h1.5a2 2 0 0 0 2-2A6.25 6.25 0 0 0 10 3.75Z" />
    <circle cx="7" cy="9" r=".8" fill="currentColor" />
    <circle cx="9.75" cy="6.75" r=".8" fill="currentColor" />
    <circle cx="12.75" cy="8" r=".8" fill="currentColor" />
  {:else if name === "a-plus"}
    <!-- Settings › Text size: an A and a plus. -->
    <path d="M3.5 15.5 7.25 5h1.5L12.5 15.5M5 11.75h6" />
    <path d="M15.25 6v5M12.75 8.5h5" />
  {:else if name === "pen-nib"}
    <!-- Settings › Font, theme and line width: a pen's nib. -->
    <path d="M10 16.25 5.25 11.5 7 4.75h6l1.75 6.75Z" />
    <path d="M10 16.25V10" />
    <circle cx="10" cy="9.25" r="1" />
  {:else if name === "feed"}
    <!-- Settings › Your feeds: a feed's waves. -->
    <path d="M4.5 9.25a6.25 6.25 0 0 1 6.25 6.25" />
    <path d="M4.5 4.75a10.75 10.75 0 0 1 10.75 10.75" />
    <circle cx="5.25" cy="14.75" r="1" fill="currentColor" />
  {:else if name === "heart-pulse"}
    <!-- Settings › Feed health: a heart with a pulse. -->
    <path d="M10 16.25s-6.25-3.75-6.25-8a3.25 3.25 0 0 1 6.25-1.4 3.25 3.25 0 0 1 6.25 1.4c0 4.25-6.25 8-6.25 8Z" />
    <path d="M5.5 10h2l1-1.75 1.5 3 1-1.25h3.5" />
  {:else if name === "panel-dots"}
    <!-- Settings › Show in the sidebar: a window with a sidebar of rows. -->
    <rect x="3.25" y="4.25" width="13.5" height="11.5" rx="1.5" />
    <path d="M8.25 4.25v11.5" />
    <path d="M5.25 7.25h1M5.25 10h1M5.25 12.75h1" />
  {:else if name === "bookmark-plus"}
    <!-- Settings › Add from anywhere: a bookmark with a plus. -->
    <path d="M5.75 3.75h8.5a1 1 0 0 1 1 1v11.5L10 13l-5.25 3.25V4.75a1 1 0 0 1 1-1Z" />
    <path d="M10 6.25v4.5M7.75 8.5h4.5" />
  {:else if name === "newspaper"}
    <!-- Settings › Newsletters: a folded paper. -->
    <path d="M4.25 4.25h9.5v11.5H5.25a1 1 0 0 1-1-1Z" />
    <path d="M13.75 7.25h2v7.5a1 1 0 0 1-2 0" />
    <path d="M6.5 7h5M6.5 9.75h5M6.5 12.5h3" />
  {:else if name === "plug"}
    <!-- Settings › Other apps: a plug. -->
    <path d="M7.25 3.5v3M12.75 3.5v3" />
    <path d="M5.25 6.5h9.5v2.75a4.75 4.75 0 0 1-9.5 0Z" />
    <path d="M10 14v2.75" />
  {:else if name === "robot"}
    <!-- Settings › Connected assistants: a robot's head. -->
    <rect x="4.25" y="6.75" width="11.5" height="8.5" rx="2" />
    <path d="M10 3.75v3M7.75 10.25v.75M12.25 10.25v.75M8 13.25h4" />
  {:else if name === "key"}
    <!-- Settings › Passkeys: a key. -->
    <circle cx="7" cy="12.5" r="3.25" />
    <path d="M9.5 10.25 16.25 3.5" />
    <path d="m13.5 6.25 2 2" />
    <path d="m15 4.75 1.5 1.5" />
  {:else if name === "people"}
    <!-- Settings › Readers: two people. -->
    <circle cx="7.5" cy="7" r="2.75" />
    <path d="M2.75 16.25a4.75 4.75 0 0 1 9.5 0" />
    <path d="M12.75 4.6a2.75 2.75 0 0 1 0 4.8" />
    <path d="M14.5 11.9a4.75 4.75 0 0 1 2.75 4.35" />
  {:else if name === "card"}
    <!-- Settings › Your plan: a payment card. -->
    <rect x="2.75" y="4.75" width="14.5" height="10.5" rx="1.5" />
    <path d="M2.75 8.25h14.5M5.5 12.25h3" />
  {:else if name === "envelope"}
    <!-- Settings › Account › Email: an envelope. -->
    <rect x="3.25" y="4.75" width="13.5" height="10.5" rx="1.5" />
    <path d="m3.75 5.5 6.25 5 6.25-5" />
  {:else if name === "trash"}
    <!-- Settings › Account › Delete data and Delete account: a bin. -->
    <path d="M3.75 5.75h12.5M8 5.75V4.25a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5" />
    <path d="M5.25 5.75l.75 9.5a1 1 0 0 0 1 .95h6a1 1 0 0 0 1-.95l.75-9.5" />
  {/if}
</svg>
