<!--
  Under Add's "couldn't find a way to follow this site" (SPEC section 3, decision 0212): instead of a
  dead end, a small heading, "Ask them for a feed", one line, and an everyday button, "Write to
  june.example", with the paper plane. Pressing it opens a box in place, as Write to does on a
  person's page: nine turtles looks on the site's home page and one contact or about page for an
  address (the server, under the feed finder's limits), and what it finds fills the field for the
  reader to check; else "Find it on their site" and the field to paste it in. **Write** opens the
  reader's own email app with a short request they can change; nine turtles keeps nothing.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { askForFeedLink, lookOnSite, looksLikeAddress, siteName } from "./writeBack";

  let { site }: { site: string } = $props();

  let name = $derived(siteName(site));
  let href = $derived(/^https?:\/\//i.test(site.trim()) ? site.trim() : `https://${site.trim()}`);

  let asking = $state(false);
  let looked: "looking" | "found" | "none" | "couldn't" | undefined = $state();
  let found = $state("");
  let typed = $state("");
  let showingFound = $derived(looked === "found" && typed.trim() === found);
  let message = $state("");
  let field: HTMLInputElement | undefined = $state();
  let opener: HTMLButtonElement | undefined = $state();

  // Another site starts with the button, not a half-typed address.
  $effect(() => {
    void site;
    asking = false;
    looked = undefined;
    typed = "";
    message = "";
  });

  async function start() {
    asking = true;
    await tick();
    field?.focus();
    looked = "looking";
    const asked = site;
    const answer = await lookOnSite(site);
    if (asked !== site || !asking) return;
    if (!answer.looked) looked = "couldn't";
    else if (!answer.address) looked = "none";
    else if (typed.trim()) looked = undefined;
    else {
      found = typed = answer.address;
      looked = "found";
    }
  }

  async function notNow() {
    asking = false;
    looked = undefined;
    message = "";
    await tick();
    opener?.focus();
  }

  function write(event: SubmitEvent) {
    event.preventDefault();
    message = "";
    if (!looksLikeAddress(typed)) {
      message = typed.trim() ? "That doesn't look like an email address. Check it and try again." : "Type their email address first.";
      field?.focus();
      return;
    }
    window.location.href = askForFeedLink(typed.trim().replace(/^mailto:/i, ""), site);
  }
</script>

<section aria-labelledby="ask-feed-head" class="mt-2 mb-4 flex flex-col gap-3 self-stretch text-left">
  <h3 id="ask-feed-head" class="small-caps">Ask them for a feed</h3>
  {#if asking}
    <form class="ask flex flex-col gap-4" aria-label={`Write to ${name}`} onsubmit={write}>
      <p class="text-small text-ink-2" aria-live="polite">
        {#if looked === "looking"}Looking on their site…{:else if showingFound}Found on their site. Check it, then press Write.{:else if looked === "none"}No email address on their site. Paste it here.{:else if looked === "couldn't"}Their site couldn't be checked for an address. Paste it here.{:else}Paste their email address here.{/if}
      </p>
      {#if !showingFound}
        <a class="btn self-start" {href} target="_blank" rel="noopener noreferrer"><Icon name="open" size={16} />Find it on their site<span class="sr-only"> (opens in a new tab)</span></a>
      {/if}
      <div class="flex flex-col gap-1.5">
        <label for="ask-feed-address" class="text-small text-ink-2">Their email address</label>
        <input
          id="ask-feed-address"
          bind:this={field}
          bind:value={typed}
          type="text"
          inputmode="email"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          aria-invalid={message ? "true" : undefined}
          aria-describedby="ask-feed-message"
          class="field min-w-0"
        />
      </div>
      <p id="ask-feed-message" role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
        {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
      </p>
      <div class="flex flex-wrap gap-2">
        <button type="submit" class="btn">Write</button>
        <button type="button" class="btn-quiet" onclick={notNow}>Not now</button>
      </div>
      <p class="text-small text-ink-2">It sends from your own email, with a short note you can change.</p>
    </form>
  {:else}
    <p class="text-ink-2">Many sites can add one in minutes, once someone asks.</p>
    <button type="button" class="btn self-start" bind:this={opener} onclick={() => void start()}><Icon name="send" size={18} />Write to {name}</button>
  {/if}
</section>

<style>
  /* The same quiet bordered box as Write to on a person's page. */
  .ask {
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
  }
</style>
