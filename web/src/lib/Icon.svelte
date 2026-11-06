<!--
  nine turtles' few icons, drawn on one 20px grid with the same 1.5px line, so
  they look like one set. Outlines for shapes, solid only for marks too small
  to outline; one idea each, named at a glance (docs/BRAND.md → Icons). Screen readers skip them: the
  word beside an icon, or the label of an icon-only button, says what it does.
-->
<script lang="ts" module>
  export type IconName = "refresh" | "check" | "edit" | "open" | "link" | "share" | "close" | "back" | "search" | "sliders" | "star" | "plus" | "settings" | "sidebar" | "sort" | "keyboard" | "dot" | "layers" | "chevron-up" | "chevron-down" | "alert" | "aa" | "more" | "chevron-right" | "download" | "sign-out" | "headphones" | "video" | "note" | "person" | "newspaper" | "send"
    // Settings' rows (decision 0120).
    | "page-new" | "palette" | "a-plus" | "text-width" | "feed" | "sidebar-check" | "bookmark-plus" | "phone-download" | "newsletter" | "eye-off" | "robot" | "key" | "people" | "card" | "envelope" | "person-at" | "archive-box" | "trash";
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
    <!-- Open the original: an arrow out, with no box. -->
    <path d="M8.5 4.75h6.75v6.75M15.25 4.75 4.75 15.25" />
  {:else if name === "link"}
    <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.54 3.54 0 0 0-5-5l-.75.75" />
    <path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.54 3.54 0 0 0 5 5l.75-.75" />
  {:else if name === "share"}
    <path d="M10 12.5V2.75" />
    <path d="M6.5 6.25 10 2.75l3.5 3.5" />
    <path d="M6.25 9H5a1 1 0 0 0-1 1v6.25a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-1.25" />
  {:else if name === "close"}
    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
  {:else if name === "back"}
    <path d="M12.25 5.5 7.75 10l4.5 4.5" />
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
  {:else if name === "layers"}
    <!-- All articles: layers, everything stacked. -->
    <path d="M10 3 17 6.75 10 10.5 3 6.75Z" />
    <path d="m3 10.25 7 3.75 7-3.75" />
    <path d="m3 13.75 7 3.75 7-3.75" />
  {:else if name === "keyboard"}
    <!-- A keyboard: a row of keys and a space bar. -->
    <rect x="2.75" y="5.25" width="14.5" height="9.5" rx="1.5" />
    <circle cx="6" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8.67" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="11.33" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="14" cy="8.5" r="0.9" fill="currentColor" stroke="none" />
    <path d="M7 11.75h6" />
  {:else if name === "sidebar"}
    <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.5" />
    <path d="M7.75 3.75v12.5" />
  {:else if name === "sort"}
    <!-- Sort order: an arrow down and an arrow up, side by side. -->
    <path d="M6.5 3.5v13M3.5 13.5l3 3 3-3M13.5 16.5v-13M10.5 6.5l3-3 3 3" />
  {:else if name === "star"}
    <path d="M10 2.5l2.4 4.9 5.35.78-3.87 3.77.91 5.33L10 14.77l-4.79 2.51.91-5.33-3.87-3.77 5.35-.78z" fill={filled ? "currentColor" : "none"} />
  {:else if name === "chevron-up"}
    <!-- The phone's Previous article: the one above in the list (Next is chevron-down). -->
    <path d="m5.5 12 4.5-4.5 4.5 4.5" />
  {:else if name === "chevron-down"}
    <path d="m5.5 8 4.5 4.5L14.5 8" />
  {:else if name === "chevron-right"}
    <!-- A row that leads on to something (a file chooser, a flow): ›. -->
    <path d="m7.75 5.5 4.5 4.5-4.5 4.5" />
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
    <circle cx="10" cy="10" r="6.75" />
    <path d="M10 6.75v3.75" />
    <circle cx="10" cy="13.25" r="1" fill="currentColor" stroke="none" />
  {:else if name === "aa" || name === "a-plus"}
    <!-- The reading panel, and Settings › Text size: a large A and a small a. -->
    <!-- A clear gap between the two letters, and the small a's stem no taller than its bowl, so it reads as "a", not "d". -->
    <path d="M2.75 16 6.5 4.75 10.25 16M4.1 12.25h4.8" />
    <circle cx="14.25" cy="13.5" r="2.5" />
    <path d="M16.75 11v5" />
  {:else if name === "headphones"}
    <!-- A podcast's episode (decision 0113): headphones, a thin band and two solid ear cups. -->
    <path d="M4.25 12v-1.5a5.75 5.75 0 0 1 11.5 0V12" />
    <rect x="3" y="11.25" width="3.75" height="5.75" rx="1.1" fill="currentColor" stroke="none" />
    <rect x="13.25" y="11.25" width="3.75" height="5.75" rx="1.1" fill="currentColor" stroke="none" />
  {:else if name === "video"}
    <!-- A YouTube video (decision 0144): a screen with a play mark, line only, as plain signs are. -->
    <rect x="2.75" y="4.25" width="14.5" height="11.5" rx="2" />
    <path d="M8.5 7.6v4.8l4-2.4Z" />
  {:else if name === "more"}
    <!-- More: three dots in a row. -->
    <circle cx="4.5" cy="10" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="10" cy="10" r="1.25" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="10" r="1.25" fill="currentColor" stroke="none" />
  {:else if name === "page-new"}
    <!-- Settings › Reading › Unread: a page with a new dot at its corner. -->
    <path d="M12 3.25H5.25a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 1.5 1.5h9.5a1.5 1.5 0 0 0 1.5-1.5V8" />
    <circle cx="15.5" cy="4.5" r="2" fill="currentColor" stroke="none" />
    <path d="M6.75 9.5h6.5M6.75 12.75h4" />
  {:else if name === "palette"}
    <!-- Settings › Page: a painter's palette with three solid dabs of paint. -->
    <path d="M10.25 3.5C5.9 3.5 2.75 6.3 2.75 9.9c0 3.7 3.1 6.6 7 6.6 1.3 0 1.9-.75 1.7-1.65-.25-1.25.55-2.1 1.85-2.1h1.45c1.85 0 3-1.15 3-3.05 0-3.6-3.1-6.2-7.5-6.2Z" />
    <circle cx="6.6" cy="8.9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9.9" cy="6.6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="13.3" cy="8" r="1.3" fill="currentColor" stroke="none" />
  {:else if name === "text-width"}
    <!-- Settings › Font and line width: lines of text under a two-way arrow. -->
    <path d="M3.25 9.5h13.5M3.25 12.75h13.5M3.25 16h8" />
    <path d="M3.25 4.5h13.5M5.5 2.5 3.25 4.5 5.5 6.5M14.5 2.5l2.25 2-2.25 2" />
  {:else if name === "feed"}
    <!-- Settings › Everyone you follow: a feed's waves. -->
    <path d="M4.5 9.25a6.25 6.25 0 0 1 6.25 6.25" />
    <path d="M4.5 4.75a10.75 10.75 0 0 1 10.75 10.75" />
    <circle cx="5.25" cy="14.75" r="1" fill="currentColor" />
  {:else if name === "sidebar-check"}
    <!-- Settings › Show in the sidebar: the sidebar's window with a check, choosing what shows. -->
    <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.5" />
    <path d="M7.75 3.75v12.5" />
    <path d="m10.25 10.25 1.75 1.75 3-3.5" />
  {:else if name === "bookmark-plus"}
    <!-- Settings › Add from anywhere: a bookmark and a plus. -->
    <path d="M4.25 3.75h6v12.5l-3-2.5-3 2.5Z" />
    <path d="M14.5 7.25v5.5M11.75 10h5.5" />
  {:else if name === "phone-download"}
    <!-- Settings › Install the app: a phone with an arrow down onto its screen. -->
    <rect x="5.5" y="2.75" width="9" height="14.5" rx="2" />
    <path d="M10 6v5.5M7.75 9.25 10 11.5l2.25-2.25" />
    <path d="M8.75 14.75h2.5" />
  {:else if name === "newsletter"}
    <!-- Settings › Newsletters: an envelope with a feed's sign at its corner, an email that becomes a feed (the plain envelope is Weekly email's). -->
    <path d="M9 14.25H4.25a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5h11.5a1.5 1.5 0 0 1 1.5 1.5V8" />
    <path d="m3.25 4.5 6.75 5 6.75-5" />
    <path d="M11.75 13.25a4 4 0 0 1 4 4M11.75 10a7.25 7.25 0 0 1 7.25 7.25" />
    <circle cx="12.25" cy="16.75" r=".9" fill="currentColor" stroke="none" />
  {:else if name === "eye-off"}
    <!-- Settings › Hiding: an eye, its pupil kept, with a line through it. -->
    <path d="M2.75 10s2.75-5.25 7.25-5.25S17.25 10 17.25 10 14.5 15.25 10 15.25 2.75 10 2.75 10Z" />
    <circle cx="10" cy="10" r="2.25" />
    <path d="M3.75 3.75l12.5 12.5" />
  {:else if name === "robot"}
    <!-- Settings › Connected assistants: a robot's head, its antenna and eyes. -->
    <rect x="3.75" y="6.75" width="12.5" height="9" rx="2.5" />
    <path d="M10 3.75v3M7.75 10.75v.5M12.25 10.75v.5" />
  {:else if name === "key"}
    <!-- Settings › Passkeys: a key with one tooth. -->
    <circle cx="7" cy="13" r="3.5" />
    <path d="M9.5 10.5 16.5 3.5M14 6l2 2" />
  {:else if name === "people"}
    <!-- Settings › Readers: two people. -->
    <circle cx="7.5" cy="7.25" r="3" />
    <path d="M2.75 16.5a4.75 4.75 0 0 1 9.5 0" />
    <path d="M12.5 4.75a2.6 2.6 0 0 1 0 5" />
    <path d="M14.5 11.9a4.75 4.75 0 0 1 2.75 4.6" />
  {:else if name === "card"}
    <!-- Settings › Your plan: a payment card with one stripe. -->
    <rect x="2.75" y="4.75" width="14.5" height="10.5" rx="2" />
    <path d="M2.75 8.5h14.5" />
  {:else if name === "envelope"}
    <!-- Settings › Account › Email: an envelope. -->
    <rect x="3.25" y="4.75" width="13.5" height="10.5" rx="1.5" />
    <path d="m3.75 5.5 6.25 5 6.25-5" />
  {:else if name === "person-at"}
    <!-- Settings › Account › Email: a person and an @, your address (the plain envelope is Weekly email's). -->
    <circle cx="7.5" cy="6.75" r="3" />
    <path d="M2.75 16.5a4.75 4.75 0 0 1 7-4.2" />
    <circle cx="14.25" cy="14" r="1.5" />
    <path d="M15.75 14v.5a1.25 1.25 0 0 0 2.5 0V14a4 4 0 1 0-1.6 3.2" />
  {:else if name === "archive-box"}
    <!-- Settings › Your data: a storage box, your things kept (the arrow onto a tray is only for saving a file). -->
    <rect x="2.75" y="3.75" width="14.5" height="4" rx="1" />
    <path d="M4 7.75v7.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7.5" />
    <path d="M8 11h4" />
  {:else if name === "note"}
    <!-- Notes (SPEC section 42): a page with a folded corner and two lines of writing. -->
    <path d="M4.75 3.25h7.5l3 3v10.5h-10.5z" />
    <path d="M7.5 10h5M7.5 13h3.5" />
  {:else if name === "person"}
    <!-- A person (Add's question, the owner's core path, point 1): one head and shoulders, the Readers icon's single figure. -->
    <circle cx="10" cy="6.75" r="3" />
    <path d="M4.5 16.5a5.5 5.5 0 0 1 11 0" />
  {:else if name === "newspaper"}
    <!-- A publication (Add's question): a newspaper page, its masthead, three lines and one solid picture. -->
    <rect x="3" y="3.25" width="14" height="13.5" rx="1" />
    <path d="M5.25 6h9.5M5.25 9.25h3M5.25 11.75h3M5.25 14.25h3" />
    <rect x="10.5" y="8.75" width="4.5" height="5.5" rx=".4" fill="currentColor" stroke="none" />
  {:else if name === "send"}
    <!-- Write back and Write to (the owner's core path, points 6 and 9): a paper plane. -->
    <path d="M17.25 2.75 2.75 8.75l5.5 3 3 5.5Z" />
    <path d="M8.25 11.75 17.25 2.75" />
  {:else if name === "trash"}
    <!-- Settings › Account › Delete data and Delete account: a bin. -->
    <path d="M3.75 5.75h12.5M8 5.75V4.25a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1.5" />
    <path d="M5.25 5.75l.75 9.5a1 1 0 0 0 1 .95h6a1 1 0 0 0 1-.95l.75-9.5" />
  {/if}
</svg>
