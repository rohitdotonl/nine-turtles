<!--
  Under Add's "couldn't find a way to follow this site" (SPEC section 3, decision 0212): instead of a
  dead end, a small heading, "Ask them for a feed", one line, and an everyday button, "Write to
  june.example", with the paper plane. Pressing it opens the same box in place as Write to on a
  person's page (`AddressBox`): nine turtles looks on the site's home page and one contact or about
  page for an address (the server, under the feed finder's limits), and what it finds fills the
  field for the reader to check; else "look on their site" (a link in its line) and the field to paste it in. **Write**
  opens the reader's own email app with a short request they can change; nine turtles keeps nothing.
-->
<script lang="ts">
  import { tick } from "svelte";
  import AddressBox from "./AddressBox.svelte";
  import Icon from "./Icon.svelte";
  import { siteName } from "./people";
  import { askForFeedLink, lookOnSite, looksLikeAddress } from "./writeBack";

  let { site }: { site: string } = $props();

  let href = $derived(/^https?:\/\//i.test(site.trim()) ? site.trim() : `https://${site.trim()}`);
  let name = $derived(siteName(href) ?? site.trim());

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
    window.location.href = askForFeedLink(typed.trim().replace(/^mailto:/i, ""), name);
  }
</script>

<section aria-labelledby="ask-feed-head" class="mt-2 mb-4 flex flex-col gap-3 self-stretch text-left">
  <h3 id="ask-feed-head" class="label">Ask them for a feed</h3>
  {#if asking}
    <!-- Add stays the sheet's one solid button: Write here is an everyday one. -->
    <AddressBox
      title={`Write to ${name}`}
      site={href}
      {looked}
      {showingFound}
      saved={false}
      submit="Write"
      quiet
      {message}
      foot="It sends from your own email, with a short note you can change."
      bind:typed
      bind:field
      onsubmit={write}
      onNotNow={() => void notNow()}
    />
  {:else}
    <p class="text-ink-2">Many sites can add one in minutes, once someone asks.</p>
    <button type="button" class="btn self-start" bind:this={opener} onclick={() => void start()}><Icon name="send" />Write to {name}</button>
  {/if}
</section>
