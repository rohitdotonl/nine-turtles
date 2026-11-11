<!--
  Under Add's "couldn't find a way to follow this site" (SPEC section 3, decision 0198): a site
  with no feed may be a newsletter that only comes by email, so instead of a dead end the reader
  gets their own nine turtles address (section 28), drawn like the field above it with Copy where
  Add is, and a link to the site to sign up there. Shown only while nine turtles takes newsletters.
-->
<script lang="ts">
  import { copyAddress, newslettersStatus } from "./newsletters";

  /** The site that had no feed, to sign up on; none when opened from + Add's own line (decision 0259). */
  let { site }: { site?: string } = $props();

  let address = $state("");
  let message = $state("");
  let href = $derived(site === undefined ? undefined : /^https?:\/\//i.test(site.trim()) ? site.trim() : `https://${site.trim()}`);

  $effect(() => {
    newslettersStatus()
      .then((status) => (address = status.address ?? ""))
      .catch(() => (address = ""));
  });

  async function copy() {
    message = await copyAddress(address);
  }
</script>

{#if address}
  <section aria-label="If it's a newsletter" class="mt-2 mb-4 flex flex-col gap-3 self-stretch text-left">
    {#if href}<h3 class="label">If it's a newsletter</h3>{/if}
    <p class="text-ink-2">Sign up with your own nine turtles address, and each issue arrives here instead of your inbox.</p>
    <div class="flex gap-2">
      <input readonly value={address} translate="no" aria-label="Your nine turtles address" onfocus={(event) => event.currentTarget.select()} class="field min-w-0 flex-1 text-ink" />
      <button type="button" onclick={copy} class="btn">Copy<span class="sr-only"> address</span></button>
    </div>
    <p role="status" class={["text-meta text-ink-2", !message && "sr-only"]}>{message}</p>
    {#if href}<a {href} target="_blank" rel="noopener" class="text-link self-start">Open their site to sign up<span class="sr-only"> (opens in a new tab)</span></a>{/if}
  </section>
{/if}
