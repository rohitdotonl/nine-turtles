<!--
  The sidebar's fixed lists: Unread, Saved, Notes and All (SPEC
  section 5), each with a small sign in the icon column, the same for
  everyone (decision 0187). With Unread off there's no Unread, and All is
  home.

  Under them, one more row built the same way: Everyone you follow (SPEC
  section 15), the page that looks after the people themselves, one press
  from home instead of inside Settings (decision 0266).

  Notes shows from the first day, empty or not, so its empty list can say
  how to fill it (decision 0222).

  On a phone the feeds screen is the root of a stack: nothing is selected
  there, and each row leads on with a chevron (decision 0041). Nor while the
  welcome shows: you're on the welcome, not in Unread (decision 0191).

  An article dragged from the list and let go on Saved is saved
  (decision 0250).

  Unread alone carries a dot while something waits in it, the list's unread
  dot a step smaller (decision 0242): the one sign in the sidebar that
  anything is new. Folders and people carry none, so nothing calls from
  every row. Screen readers hear "Unread", described as "Something new", so
  its name, which voice control uses, never changes.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { home, LOOKS } from "./homeStyle.svelte";
  import { nameFor, sidebarViews, VIEW_NAMES, pathFor, type Route } from "./router";

  let {
    route,
    follow,
    phone,
    unreadOff,
    welcoming = false,
    waiting = false,
    part = "every",
  }: {
    route: Route;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone: boolean;
    unreadOff: boolean;
    /** The welcome is showing in this list's place: no row is where you are. */
    welcoming?: boolean;
    /** Something unread anywhere: Unread's dot shows. */
    waiting?: boolean;
    /** Home redesign, design round: which of its rows this one draws (Unread and All; Saved and Notes; Everyone you follow; or all of them, as now). */
    part?: "every" | "top" | "yours" | "everyone";
  } = $props();

  const ICONS = { unread: "dot", starred: "bookmark", notes: "note", all: "layers" } as const;

  const PARTS = { every: ["unread", "starred", "notes", "all"], top: ["unread", "all"], yours: ["starred", "notes"], everyone: [] } as const;
  let views = $derived(sidebarViews(unreadOff).filter((view) => (PARTS[part] as readonly string[]).includes(view)).sort((a, b) => (PARTS[part] as readonly string[]).indexOf(a) - (PARTS[part] as readonly string[]).indexOf(b)));
  const everyone: Route = { kind: "your-feeds" };
  let onEveryone = $derived(!phone && route.kind === "your-feeds");
</script>

<ul class={["home-group", part === "yours" && "sidebar-gap", ((part === "yours" && LOOKS[home.style]?.pair) || (part === "top" && LOOKS[home.style]?.topPair)) && "pair", part === "everyone" && "sidebar-last"]}>
  {#each views as view (view)}
    {@const current = !phone && !welcoming && route.kind === "view" && route.view === view}
    <li>
      <a
        href={pathFor({ kind: "view", view })}
        aria-current={current ? "page" : undefined}
        aria-describedby={view === "unread" && waiting ? "unread-waiting" : undefined}
        data-drop-star={view === "starred" ? "" : undefined /* an article dragged from the list is saved here (decision 0250, articleDrag.ts) */}
        onclick={(event) => follow(event, { kind: "view", view })}
        class={[
          "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-3 pr-3 pl-3 text-ui",
          current ? "font-semibold text-ink" : "text-ink-2",
        ]}
        ><span class={current ? "text-ink" : "text-muted"}><Icon name={ICONS[view]} /></span
        ><span class="min-w-0 flex-1">{VIEW_NAMES[view]}</span
        >{#if view === "unread" && waiting}<span aria-hidden="true" class="unread-dot sidebar-dot"></span>{/if}{#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" /></span>{/if}</a
      >
      <!-- Its description, outside the link so the link's name stays "Unread". -->
      {#if view === "unread" && waiting}<span id="unread-waiting" hidden>Something new</span>{/if}
    </li>
  {/each}
  {#if part === "every" || part === "everyone"}
  <li>
    <a
      href={pathFor(everyone)}
      aria-current={onEveryone ? "page" : undefined}
      onclick={(event) => follow(event, everyone)}
      class={["place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-3 pr-3 pl-3 text-ui", onEveryone ? "font-semibold text-ink" : "text-ink-2"]}
      ><span class={onEveryone ? "text-ink" : "text-muted"}><Icon name="feed" /></span><span class="min-w-0 flex-1">{nameFor(everyone)}</span
      >{#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" /></span>{/if}</a
    >
  </li>
  {/if}
</ul>

<style>
  /* Home redesign: Saved and Notes, a group with no heading, parted from the folders above by space alone. */
  .sidebar-gap {
    margin-top: 1rem;
  }
  /* v8, v10: Saved and Notes as two tiles side by side, the icon over the name. */
  .pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-inline: 0.5rem;
  }
  .pair :global(a.place) {
    margin: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    min-height: 4.5rem;
    border-radius: 12px;
    background-color: var(--paper);
  }
  .pair :global(a.place > span:last-child:not(.min-w-0)) {
    display: none;
  }
  /* Everyone you follow, the last row on Home: housekeeping, under one hairline. */
  .sidebar-last {
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line);
  }
  /*
    Unread's dot (decision 0242): the list's unread dot (app.css
    .unread-dot: 6px, round, CanvasText in forced colors) in the full
    accent, as the list's softened one would be too faint on the sidebar's
    selected pill (decision 0278), and in the row's flow at its end rather
    than in a gutter.
  */
  .sidebar-dot {
    position: static;
    background-color: var(--accent);
    flex-shrink: 0;
    width: 6px;
    height: 6px;
  }
</style>
