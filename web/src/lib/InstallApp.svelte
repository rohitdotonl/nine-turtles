<!--
  Install the app (SPEC section 20, decisions 0151 and 0104), a page of
  Settings: the steps for this device (lib/install.ts guesses which), with an
  Install button where the browser offers one press
  (lib/installing.svelte.ts), then a line for every other device. Under it,
  "Follow the blog you're on": on a computer, a button to drag to the
  bookmarks bar (a "bookmarklet"); on a phone, the way that phone does it.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { bookmarksBarKey, deviceOf, guideFor, isComputer, otherDevices } from "./install";
  import { install, installing, runningInstalled } from "./installing.svelte";
  import { bookmarklet, SHORTCUT_LINK } from "./share";

  const device = deviceOf(navigator);
  const guide = guideFor(device);
  const computer = isComputer(device);
  const apple = device.platform === "iphone" || device.platform === "ipad";
  const bookmark = bookmarklet(location.origin);
  const here = runningInstalled();
  /** What came of pressing Install nine turtles, when it didn't install. */
  let message = $state("");
  const said = $derived(installing.justInstalled ? "Installed. Open nine turtles from its icon." : message);
  /** Where the keyboard goes once the pressed button is gone. */
  let answer: HTMLParagraphElement | undefined = $state();
  let dragNote = $state("");

  async function press() {
    const outcome = await install();
    if (outcome === "dismissed") message = "Not installed. The steps below still work, any time.";
    if (outcome === "failed") message = "Your browser didn't open its Install. Follow the steps below instead.";
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
  <h3 id="install-heading" class="inset-head">Install the app</h3>
  <p class="lead">
    Installed, nine turtles has its own icon and window, like any other app, with nothing to download from an app
    store. Sign in once on each device; what you follow and what you've read are the same everywhere.
  </p>

  <div>
    <h4 class="inset-head">{here || installing.justInstalled ? "This device" : `On this ${guide.where}`}</h4>
    <!-- Always here, so screen readers hear it the moment it's filled in. -->
    <p bind:this={answer} tabindex="-1" role="status" class={said ? "inset-group inset-row done" : "sr-only"}>
      {#if installing.justInstalled}<span class="text-muted"><Icon name="check" size={18} /></span>{/if}<span class="min-w-0">{said}</span>
    </p>
    {#if here}
      <p class="inset-group inset-row done">
        <span class="text-muted"><Icon name="check" size={18} /></span><span class="min-w-0">You're using the installed app now.</span>
      </p>
    {:else if !installing.justInstalled}
      {#if installing.offer}
        <div class="inset-group">
          <button type="button" class="inset-row inset-action" onclick={press}>Install nine turtles</button>
        </div>
        <p class="inset-foot">Your browser asks once more before it installs. Or, step by step:</p>
      {/if}
      {#if guide.steps.length > 0}
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
    <h4 class="inset-head">On your other devices</h4>
    <ul role="list" class="inset-group">
      {#each otherDevices(device) as other (other.name)}
        <li class="inset-row other"><span class="min-w-0"><span class="name">{other.name}</span><br /><span class="text-muted">{other.line}</span></span></li>
      {/each}
    </ul>
  </div>

  <div>
    <h4 class="inset-head">Follow the blog you're on</h4>
    <div class="inset-group">
      {#if computer}
        <div class="inset-row drag">
          <p class="min-w-0">Drag this to your bookmarks bar, then press it on any blog.</p>
          <a class="btn btn-small" href={bookmark} onclick={pressed}>Add to nine turtles</a>
        </div>
      {:else if device.platform === "android"}
        <p class="inset-row min-w-0">Once nine turtles is installed, tap Share on any blog, then nine turtles.</p>
      {:else if apple && SHORTCUT_LINK}
        <div class="inset-row">
          <p class="min-w-0">Get the Shortcut once, then on any blog in Safari tap Share › Add to nine turtles.</p>
          <a class="btn btn-small" href={SHORTCUT_LINK} target="_blank" rel="noopener noreferrer"
            >Get the Shortcut<span class="sr-only"> (opens Apple's page)</span></a
          >
        </div>
      {:else}
        <p class="inset-row min-w-0">Copy the blog's address, then paste it into + Add.</p>
      {/if}
    </div>
    <p role="status" class={["inset-foot text-ink", !dragNote && "sr-only"]}>{dragNote}</p>
    <p class="inset-foot">
      {#if computer}
        No bookmarks bar? Press {bookmarksBarKey(device)}. On Android, share a blog to the installed app.
      {:else}
        On a computer, this page has a button for the bookmarks bar.
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
  /* A step: its number in a narrow column, the words beside it, never split to the row's two ends. */
  .step,
  .done,
  .other {
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
  .name {
    font-weight: 500;
  }
</style>
