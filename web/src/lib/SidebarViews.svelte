<!--
  The sidebar's fixed lists: Unread, Starred, Notes and All (SPEC
  section 5), each with a small sign in the icon column, the same for
  everyone (decision 0187). With Unread off there's no Unread, and All is
  home.

  Notes shows from the first day, empty or not, so its empty list can say
  how to fill it (decision 0222).

  On a phone the feeds screen is the root of a stack: nothing is selected
  there, and each row leads on with a chevron (decision 0041). Nor while the
  welcome shows: you're on the welcome, not in Unread (decision 0191).

  Unread alone carries a dot while something waits in it, the list's unread
  dot a step smaller (decision 0242): the one sign in the sidebar that
  anything is new. Folders and people carry none, so nothing calls from
  every row. Screen readers hear "Unread", described as "Something new", so
  its name, which voice control uses, never changes.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { sidebarViews, VIEW_NAMES, pathFor, type Route } from "./router";

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

  const ICONS = { unread: "dot", starred: "star", notes: "note", all: "layers" } as const;

  let views = $derived(sidebarViews(unreadOff));
</script>

<ul>
  {#each views as view (view)}
    {@const current = !phone && !welcoming && route.kind === "view" && route.view === view}
    <li>
      <a
        href={pathFor({ kind: "view", view })}
        aria-current={current ? "page" : undefined}
        aria-describedby={view === "unread" && waiting ? "unread-waiting" : undefined}
        onclick={(event) => follow(event, { kind: "view", view })}
        class={[
          "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-2.5 pr-3.5 pl-3 text-ui pointer-fine:text-meta",
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
</ul>

<style>
  /*
    Unread's dot (decision 0242): the list's unread dot (app.css
    .unread-dot: the accent, round, CanvasText in forced colors), a step
    smaller (6px) as the sidebar's names are smaller than the list's titles,
    and in the row's flow at its end rather than in a gutter.
  */
  .sidebar-dot {
    position: static;
    flex-shrink: 0;
    width: 6px;
    height: 6px;
  }
</style>
