<!--
  Install the app on any device (SPEC section 20, decisions 0151 and 0104), a page of
  Settings: three tabs, Computer, Android and iPhone & iPad, with this
  device's already chosen (lib/install.ts guesses which). This device's tab
  names its browser and has the Install button where the browser offers one
  press (lib/installing.svelte.ts); the others give every browser's way.
  Each tab ends with "Follow the blog you're on": the bookmarks-bar button
  (a "bookmarklet") on a computer, Share on Android, + Add on iPhone.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { bookmarksBarKey, deviceOf, guideFor, guideForKind, KINDS, kindOf, type Kind } from "./install";
  import { install, installing, runningInstalled } from "./installing.svelte";
  import { bookmarklet, SHORTCUT_LINK } from "./share";

  const device = deviceOf(navigator);
  const mine = kindOf(device);
  const bookmark = bookmarklet(location.origin);
  const here = runningInstalled();
  let chosen: Kind = $state(mine);
  const own = $derived(chosen === mine);
  const guide = $derived(own ? guideFor(device) : guideForKind(chosen));
  /** What came of pressing Install nine turtles, when it didn't install. */
  let message = $state("");
  const said = $derived(installing.justInstalled ? "Installed. Open nine turtles from its icon." : message);
  /** Where the keyboard goes once the pressed button is gone. */
  let answer: HTMLParagraphElement | undefined = $state();
  let dragNote = $state("");

  async function press() {
    const outcome = await install();
    if (outcome === "dismissed") message = "Not installed. The steps below still work, any time.";
    if (outcome === "failed") message = "Your browser didn't offer to install it. Follow the steps below instead.";
    await tick();
    answer?.focus();
  }

  /** Pressed here it would do nothing useful: it works from the bookmarks bar. */
  function pressed(event: MouseEvent) {
    event.preventDefault();
    dragNote = "Drag it to your bookmarks bar: it works from there.";
  }
</script>

<section aria-labelledby="install-heading" class="flex flex-col gap-8">
  <h3 id="install-heading" class="inset-head">Install the app on any device</h3>
  <p class="lead">
    Installed, nine turtles has its own icon and window, like any other app, with nothing to download from an app
    store. Sign in once on each device; what you follow and what you've read are the same everywhere.
  </p>

  <div role="group" aria-label="Device" class="choices kinds" style="--phone-columns: 3">
    {#each KINDS as kind (kind.kind)}
      <label class="choice">
        <input type="radio" name="install-kind" value={kind.kind} bind:group={chosen} />
        {kind.label}
      </label>
    {/each}
  </div>

  <div>
    <h4 class="inset-head">{own ? `On this ${guide.where}` : `On ${chosen === "computer" ? "a" : "an"} ${guide.where}`}</h4>
    {#if own}
      <!-- Always here, so screen readers hear it the moment it's filled in. -->
      <p bind:this={answer} tabindex="-1" role="status" class={said ? "inset-group inset-row done" : "sr-only"}>
        {#if installing.justInstalled}<span class="text-muted"><Icon name="check" size={18} /></span>{/if}<span class="min-w-0">{said}</span>
      </p>
    {/if}
    {#if own && here}
      <p class="inset-group inset-row done">
        <span class="text-muted"><Icon name="check" size={18} /></span><span class="min-w-0">You're using the installed app now.</span>
      </p>
    {:else if !(own && installing.justInstalled)}
      {#if own && installing.offer}
        <div class="inset-group">
          <button type="button" class="inset-row inset-action" onclick={press}>Install nine turtles</button>
        </div>
        <p class="inset-foot">Your browser asks once more before it installs. Or, step by step:</p>
      {/if}
      {#if guide.ways}
        <ul role="list" class="inset-group">
          {#each guide.steps as way (way)}
            <li class="inset-row step"><span class="min-w-0">{way}</span></li>
          {/each}
        </ul>
      {:else if guide.steps.length > 0}
        <!-- role="list" keeps the numbered list a list for VoiceOver, which drops it once the markers are hidden. -->
        <ol role="list" class="inset-group">
          {#each guide.steps as step, index (step)}
            <li class="inset-row step"><span aria-hidden="true" class="number text-muted">{index + 1}</span><span class="min-w-0">{step}</span></li>
          {/each}
        </ol>
      {/if}
      {#if guide.foot}<p class="inset-foot">{guide.foot}</p>{/if}
    {/if}
  </div>

  <div>
    <h4 class="inset-head">Follow the blog you're on</h4>
    <div class="inset-group">
      {#if chosen === "computer"}
        <div class="inset-row drag">
          <p class="min-w-0">Drag this to your bookmarks bar, then press it on any blog.</p>
          <a class="btn btn-small" href={bookmark} onclick={pressed}>Add to nine turtles</a>
        </div>
      {:else if chosen === "android"}
        <p class="inset-row min-w-0">Once nine turtles is installed, tap Share on any blog, then nine turtles.</p>
      {:else if SHORTCUT_LINK}
        <div class="inset-row">
          <p class="min-w-0">Get the Shortcut once, then on any blog tap Share › Add to nine turtles.</p>
          <a class="btn btn-small" href={SHORTCUT_LINK} target="_blank" rel="noopener noreferrer"
            >Get the Shortcut<span class="sr-only"> (Apple's page, opens in a new tab)</span></a
          >
        </div>
      {:else}
        <p class="inset-row min-w-0">Copy the blog's address, then paste it into + Add.</p>
      {/if}
    </div>
    <p role="status" class={["inset-foot text-ink", !(dragNote && chosen === "computer") && "sr-only"]}>{chosen === "computer" ? dragNote : ""}</p>
    <p class="inset-foot">
      {#if chosen === "computer"}
        No bookmarks bar? Press {mine === "computer" ? bookmarksBarKey(device) : "Ctrl Shift B, or Command Shift B on a Mac"}. Can't drag?
        Paste the blog's address into + Add.
      {/if}
      nine turtles always asks before following anyone.
    </p>
  </div>
</section>

<style>
  .lead {
    margin: 0 1rem;
    line-height: 1.5;
  }
  .kinds {
    align-self: flex-start;
  }
  /* A step: its number in a narrow column, the words beside it, never split to the row's two ends. */
  .step,
  .done {
    flex-wrap: nowrap;
    align-items: baseline;
    justify-content: flex-start;
    gap: 0.75rem;
  }
  .done {
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .done:last-child {
    margin-bottom: 0;
  }
  .number {
    flex: none;
    width: 1rem;
    font-variant-numeric: tabular-nums;
  }
  /* The drag button stays beside its sentence, never wrapped under it. */
  .drag {
    flex-wrap: nowrap;
  }
</style>
