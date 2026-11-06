<!--
  Under Add's "couldn't find a way to follow this site" (SPEC section 3, decision 0198): a site
  with no feed may be a newsletter that only comes by email, so instead of a dead end the reader
  gets their own nine turtles address (section 28), drawn like the field above it with Copy where
  Add is, and a link to the site to sign up there. Shown only while nine turtles takes newsletters.
-->
<script lang="ts">
  import { newslettersStatus } from "./newsletters";

  let { site }: { site: string } = $props();

  let address = $state("");
  let message = $state("");
  let href = $derived(/^https?:\/\//i.test(site.trim()) ? site.trim() : `https://${site.trim()}`);

  $effect(() => {
    newslettersStatus()
      .then((status) => (address = status.address ?? ""))
      .catch(() => (address = ""));
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      message = "Address copied.";
    } catch {
      message = "Couldn't copy. Select the address and copy it yourself.";
    }
  }
</script>

{#if address}
  <section aria-labelledby="by-email-head" class="mt-2 mb-4 flex flex-col gap-3 self-stretch text-left">
    <h3 id="by-email-head" class="text-[0.6875rem] leading-[1.3] font-semibold tracking-[0.1em] text-muted uppercase">If it's a newsletter</h3>
    <p class="text-ink-2">Sign up with your own nine turtles address, and each issue arrives here instead of your inbox.</p>
    <div class="flex gap-2">
      <input readonly value={address} aria-label="Your nine turtles address" onfocus={(event) => event.currentTarget.select()} class="field min-w-0 flex-1 text-ink" />
      <button type="button" onclick={copy} class="btn rounded-lg">Copy<span class="sr-only"> address</span></button>
    </div>
    <p role="status" class={["text-small text-ink-2", !message && "sr-only"]}>{message}</p>
    <a {href} target="_blank" rel="noopener" class="text-link self-start">Open their site to sign up<span class="sr-only"> (opens in a new tab)</span></a>
  </section>
{/if}
