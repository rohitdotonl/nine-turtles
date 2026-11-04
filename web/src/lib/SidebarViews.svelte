<!--
  The sidebar's fixed lists: Unread, Starred, Notes, All, Recently read
  (SPEC section 5), each with a small sign in the icon column. With Unread off
  there's no Unread, and a list the reader hid steps aside, except All with Unread off,
  where it's home (as Unread, which can't be hidden, is otherwise).

  Notes shows once the reader has highlighted or written a note on
  something (SPEC section 42).

  On a phone the feeds screen is the root of a stack: nothing is selected
  there, and each row leads on with a chevron (decision 0041).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { noted } from "./notes.svelte";
  import { VIEWS, VIEW_NAMES, pathFor, type Hideable, type Route } from "./router";

  let {
    route,
    follow,
    phone,
    unreadOff,
    hidden,
  }: {
    route: Route;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone: boolean;
    unreadOff: boolean;
    /** The lists the reader hid in Settings › Reading. */
    hidden: Hideable[];
  } = $props();

  const ICONS = { unread: "dot", starred: "star", notes: "note", all: "stack", recent: "history" } as const;

  let views = $derived(
    VIEWS.filter(
      (view) =>
        !(unreadOff && view === "unread") &&
        !((hidden as string[]).includes(view) && !(unreadOff && view === "all")) &&
        !(view === "notes" && !noted.any),
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
        ><span class={current ? "text-ink" : "text-muted"}><Icon name={ICONS[view]} size={16} filled={view === "starred" && current} /></span
        ><span class="min-w-0 flex-1">{VIEW_NAMES[view]}</span>{#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" size={16} /></span>{/if}</a
      >
    </li>
  {/each}
</ul>
