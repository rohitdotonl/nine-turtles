<!--
  The sidebar's fixed lists: Saved, Notes, All articles and Unread (SPEC
  section 5), in that order (decision 0310), each with a small sign in the
  icon column, the same for everyone (decision 0187), on Home's first card
  (home.css), which has no heading. With Unread off there's no Unread, and
  All is home.

  Under them, on the same card, one more row built the same way: Everyone you follow (SPEC
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
  dot a step smaller (decision 0242). Of the rows below, only the people
  the reader pinned carry one (decision 0310), so nothing calls from every
  row. Screen readers hear "Unread", described as "Something new", so
  its name, which voice control uses, never changes.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { nameFor, sidebarViews, VIEW_NAMES, pathFor, type Route } from "./router";

  let {
    route,
    follow,
    phone,
    unreadOff,
    welcoming = false,
    waiting = false,
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
  } = $props();

  const ICONS = { unread: "dot", starred: "bookmark", notes: "note", all: "layers" } as const;

  let views = $derived(sidebarViews(unreadOff));
  const everyone: Route = { kind: "your-feeds" };
  let onEveryone = $derived(!phone && route.kind === "your-feeds");
</script>

<ul class="home-card">
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
</ul>

