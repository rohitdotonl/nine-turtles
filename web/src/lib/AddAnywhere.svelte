<!--
  Add from anywhere (SPEC section 3, decision 0104), a group of Settings:
  the ways to add a feed from a page you're on elsewhere. A bookmark for a
  computer's browser ("bookmarklet") and the address an Apple Shortcuts
  shortcut opens, each with a Copy button, as Other apps shows its
  addresses; a phone's share menu needs nothing set up, so the foot only
  says how. Both addresses are built from this nine turtles' own address.
-->
<script lang="ts">
  import { bookmarklet, shortcutAddress } from "./share";

  const bookmark = bookmarklet(location.origin);
  const shortcut = shortcutAddress(location.origin);
  let message = $state("");

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      message = `${what} copied.`;
    } catch {
      message = `Couldn't copy. Select the ${what.toLowerCase()} and copy it yourself.`;
    }
  }
</script>

<section aria-labelledby="anywhere-heading">
  <h3 id="anywhere-heading" class="inset-head">Add from anywhere</h3>
  <div class="inset-group">
    <div class="inset-row">
      <p class="min-w-0">
        Bookmark for your browser<br /><span class="value text-muted" translate="no">{bookmark}</span>
      </p>
      <button type="button" class="btn btn-small" onclick={() => copy(bookmark, "Bookmark")}
        >Copy<span class="sr-only"> bookmark</span></button
      >
    </div>
    <div class="inset-row">
      <p class="min-w-0">
        Address for Apple Shortcuts<br /><span class="value text-muted" translate="no">{shortcut}</span>
      </p>
      <button type="button" class="btn btn-small" onclick={() => copy(shortcut, "Shortcut address")}
        >Copy<span class="sr-only"> the Apple Shortcuts address</span></button
      >
    </div>
  </div>
  <p role="status" class={["inset-foot text-ink", !message && "sr-only"]}>{message}</p>
  <p class="inset-foot">
    Add a feed from the page you're on: nine turtles opens Add a feed with the page's address and looks for its
    feed, and you choose whether to add it. On Android, once nine turtles is on your home screen, share a page and
    choose nine turtles. On a computer, make a new bookmark and paste the bookmark above as its address; press it
    on any page. On iPhone and iPad, in the Shortcuts app make a shortcut that shows in the share sheet and takes
    Safari web pages and URLs, then add “URL Encode” and “Open URLs”, with the address above followed by the
    encoded text.
  </p>
</section>

<style>
  /* The addresses: long words that may break anywhere, never off the row. */
  .value {
    overflow-wrap: anywhere;
  }
</style>
