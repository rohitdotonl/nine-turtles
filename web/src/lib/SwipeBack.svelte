<!--
  Swiped right, any screen goes back (SPEC section 20, decision 0274): a
  finger moving right from anywhere on it (not only the edge) presses the
  screen's own back button, so it goes exactly where that button says.
  Only where one screen shows at a time (a phone, or a narrow window), and
  only for a stroke on that screen. The screen follows the finger, over the
  one it goes back to (where the back button names it with `data-behind`),
  and when the finger lets go it slides the rest of the way off, or springs
  back if it wasn't far enough (`swipeMotion.ts`). Going back to a screen
  that isn't there behind it, a quiet card at the left says where
  ("‹ Settings") once the finger is far enough; moving back takes it away.
  A screen with no back button (Home) takes no swipe. In an app on the home
  screen, a stroke from the left edge counts too, since iOS gives such an
  app no back gesture of its own.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { leftAlone, reach, swipe } from "./swipe";
  import { follow, settle, type Panes } from "./swipeMotion";

  /** Where the back button the stroke started under goes, once the finger is far enough. */
  let going: string | undefined = $state();

  /** The back button of the screen the press is on: the nearest one shown around it. */
  function backFor(target: EventTarget | null): HTMLButtonElement | undefined {
    for (let node = target instanceof Element ? target : null; node; node = node.parentElement) {
      const found = [...node.querySelectorAll<HTMLButtonElement>("button.nav-back")].find((button) => button.getClientRects().length > 0);
      if (found) return found;
    }
    return undefined;
  }

  /** The screen a back button is on, and the one it goes back to, if that's a pane of its own. */
  function panesOf(button: HTMLButtonElement): Panes {
    const screen = button.closest<HTMLElement>("section, nav") ?? document.body;
    const behind = button.dataset.behind ? (document.getElementById(button.dataset.behind) ?? undefined) : undefined;
    return { screen, behind: behind === screen ? undefined : behind };
  }

  $effect(() => {
    let button: HTMLButtonElement | undefined;
    let panes: Panes | undefined;
    const action = swipe(document.body, {
      side: 1,
      fromEdge: true,
      allowed: (event) => {
        button = leftAlone(event.target, document.body) ? undefined : backFor(event.target);
        panes = button && panesOf(button);
        // Only where one screen shows at a time, and the stroke is on it: beside other panes (a tablet held wide, a touch laptop), each has its own back.
        if (!panes || !panes.screen.contains(event.target as Node) || panes.screen.getBoundingClientRect().width < innerWidth - 1) button = panes = undefined;
        return button !== undefined;
      },
      moved: (dx) => {
        if (!panes) return;
        follow(panes, dx);
        going = !panes.behind && dx >= reach(innerWidth) ? button?.textContent?.trim() : undefined;
      },
      ended: (dx) => {
        going = undefined;
        const pressed = button;
        if (!panes || !pressed) return;
        const far = dx >= reach(innerWidth);
        settle(panes, far ? innerWidth : 0, () => far && pressed.click());
      },
    });
    return () => action.destroy();
  });
</script>

{#if going}
  <div aria-hidden="true" class="swipe-card" data-side="back"><strong class="flex items-center gap-1"><Icon name="back" />{going}</strong></div>
{/if}
