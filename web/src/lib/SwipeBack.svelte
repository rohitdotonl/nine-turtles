<!--
  Swiped right, any screen goes back (SPEC section 20, decision 0274): a
  finger moving right from anywhere on it (not only the edge) presses the
  screen's own back button, so it goes exactly where that button says.
  Once the finger is far enough, a quiet card at the left says where
  ("‹ Reading Room"); moving back takes it away. A screen with no back
  button (Home) takes no swipe. In an app on the home screen, a stroke from
  the left edge counts too, since iOS gives such an app no back gesture of
  its own.
-->
<script lang="ts">
  import { leftAlone, reach, swipe } from "./swipe";

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

  $effect(() => {
    let button: HTMLButtonElement | undefined;
    const action = swipe(document.body, {
      side: 1,
      fromEdge: true,
      allowed: (event) => {
        button = leftAlone(event.target, document.body) ? undefined : backFor(event.target);
        return button !== undefined;
      },
      moved: (dx) => (going = dx >= reach(innerWidth) ? button?.textContent?.trim() : undefined),
      ended: (dx) => {
        going = undefined;
        if (dx >= reach(innerWidth)) button?.click();
      },
    });
    return () => action.destroy();
  });
</script>

{#if going}
  <div aria-hidden="true" class="swipe-card" data-side="back"><strong>‹ {going}</strong></div>
{/if}
