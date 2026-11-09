<!--
  The sidebar's fixed lists: Unread, Starred, Notes and All (SPEC
  section 5), each with a small sign in the icon column, the same for
  everyone (decision 0187). With Unread off there's no Unread, and All is
  home.

  Notes shows from the first day, empty or not, so its empty list can say
  how to fill it (decision 0221).

  On a phone the feeds screen is the root of a stack: nothing is selected
  there, and each row leads on with a chevron (decision 0041). Nor while the
  welcome shows: you're on the welcome, not in Unread (decision 0191).
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
  }: {
    route: Route;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone: boolean;
    unreadOff: boolean;
    /** The welcome is showing in this list's place: no row is where you are. */
    welcoming?: boolean;
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
        onclick={(event) => follow(event, { kind: "view", view })}
        class={[
          "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-2.5 pr-3.5 pl-3 text-ui pointer-fine:text-small",
          current ? "font-semibold text-ink" : "text-ink-2",
        ]}
        ><span class={current ? "text-ink" : "text-muted"}><Icon name={ICONS[view]} size={16} /></span
        ><span class="min-w-0 flex-1">{VIEW_NAMES[view]}</span>{#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" size={18} /></span>{/if}</a
      >
    </li>
  {/each}
</ul>
