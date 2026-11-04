<!--
  Add from anywhere (SPEC section 3, decisions 0104 and 0177), a group of
  Settings: the ways to follow someone from a page you're on elsewhere. On a
  computer, a button to drag to the bookmarks bar (a "bookmarklet"), with
  Copy beside it for anyone who can't drag; on iPhone and iPad, the
  ready-made Shortcut, once its link exists; Android's share menu needs
  nothing set up, so the foot only says how. The bookmark is built from this
  nine turtles' own address.
-->
<script lang="ts">
  import { bookmarklet, SHORTCUT_LINK } from "./share";

  const bookmark = bookmarklet(location.origin);
  let message = $state("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookmark);
      message = "Bookmark copied.";
    } catch {
      message = "Couldn't copy. Drag the button to your bookmarks bar instead.";
    }
  }

  /** Pressed here it would do nothing useful: it works from the bookmarks bar. */
  function pressed(event: MouseEvent) {
    event.preventDefault();
    message = "Drag it to your bookmarks bar: it works from there.";
  }
</script>

<section aria-labelledby="anywhere-heading">
  <h3 id="anywhere-heading" class="inset-head">Add from anywhere</h3>
  <div class="inset-group">
    <div class="inset-row">
      <p class="min-w-0">
        On a computer<br /><span class="text-muted">Drag this button to your bookmarks bar, then press it on any blog you like.</span>
      </p>
      <a class="btn btn-small" href={bookmark} draggable="true" onclick={pressed}>Add to nine turtles</a>
    </div>
    <div class="inset-row">
      <p class="min-w-0 text-muted">No bookmarks bar? Copy the bookmark and paste it as a new bookmark's address.</p>
      <button type="button" class="btn btn-small" onclick={copy}>Copy<span class="sr-only"> bookmark</span></button>
    </div>
    {#if SHORTCUT_LINK}
      <div class="inset-row">
        <p class="min-w-0">
          On iPhone and iPad<br /><span class="text-muted">Get the Shortcut once, then in Safari tap Share › Add to nine turtles.</span>
        </p>
        <a class="btn btn-small" href={SHORTCUT_LINK} target="_blank" rel="noopener noreferrer"
          >Get the Shortcut<span class="sr-only"> (opens Apple's page)</span></a
        >
      </div>
    {/if}
  </div>
  <p role="status" class={["inset-foot text-ink", !message && "sr-only"]}>{message}</p>
  <p class="inset-foot">
    On Android, add nine turtles to your home screen, then share a page and choose nine turtles. Each way asks before
    following anyone.
  </p>
</section>
