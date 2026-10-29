<!--
  The sidebar's fixed lists: Unread, Starred, All, Recently read and Up Next
  (SPEC section 5), each with a small sign in the icon column. River mode has
  no Unread, and a list the reader hid steps aside, except All in river mode,
  where it's home (as Unread, which can't be hidden, is in inbox mode).

  Up Next shows only while it holds an episode (decision 0113); once emptied
  it stays until the reader next goes somewhere, so nothing moves up under
  them.

  On a phone the feeds screen is the root of a stack: nothing is selected
  there, and each row leads on with a chevron (decision 0041).
-->
<script lang="ts">
  import { untrack } from "svelte";
  import Icon from "./Icon.svelte";
  import { player } from "./player.svelte";
  import { VIEWS, VIEW_NAMES, pathFor, type Hideable, type Route } from "./router";

  let {
    route,
    follow,
    phone,
    river,
    hidden,
  }: {
    route: Route;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone: boolean;
    river: boolean;
    /** The lists the reader hid in Settings › Reading. */
    hidden: Hideable[];
  } = $props();

  const ICONS = { unread: "dot", starred: "star", all: "stack", recent: "history", upnext: "queue" } as const;

  /** Up Next's row, once shown, stays while it empties, until the reader next goes somewhere. */
  let upNextStays = $state(false);
  $effect(() => {
    if (player.upNext?.length) upNextStays = true;
  });
  $effect(() => {
    void route;
    untrack(() => (upNextStays = Boolean(player.upNext?.length)));
  });

  let views = $derived(
    VIEWS.filter(
      (view) =>
        !(river && view === "unread") &&
        !((hidden as string[]).includes(view) && !(river && view === "all")) &&
        !(view === "upnext" && !player.upNext?.length && !upNextStays),
    ),
  );
</script>

<ul>
  {#each views as view (view)}
    {@const current = !phone && route.kind === "view" && route.view === view}
    <li>
      <a
        href={pathFor({ kind: "view", view })}
        aria-current={current ? "page" : undefined}
        onclick={(event) => follow(event, { kind: "view", view })}
        class={[
          "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-2.5 pr-3.5 pl-3 text-ui pointer-fine:text-small",
          current ? "font-semibold text-ink" : "text-ink-2",
        ]}
        ><span class={current ? (view === "starred" ? "text-star" : "text-ink") : "text-muted"}><Icon name={ICONS[view]} size={16} filled={view === "starred" && current} /></span
        ><span class="min-w-0 flex-1">{VIEW_NAMES[view]}</span>{#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" size={16} /></span>{/if}</a
      >
    </li>
  {/each}
</ul>
