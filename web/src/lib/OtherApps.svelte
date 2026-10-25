<!--
  Other apps (SPEC section 26), a group of Settings: Reeder, NetNewsWire and
  other feed readers that speak the Google Reader API can show the reader's
  feeds and keep read and starred in step. They sign in with an app
  password, never the reader's own: made here, shown once, and turned off
  here (decision 0068). While the password shows, it and the server address
  each have a Copy button.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { appsStatus, makeAppPassword, serverAddress, turnOffApps } from "./apps";

  /** Unknown until the server answers. */
  let on: boolean | undefined = $state();
  /** The new password, shown only until Settings closes. */
  let password = $state("");
  let message = $state("");
  let busy = $state(false);
  /** Where the keyboard goes when the pressed row is swapped for others. */
  let copyPassword: HTMLButtonElement | undefined = $state();
  let makeFirst: HTMLButtonElement | undefined = $state();
  const address = serverAddress(location.origin);

  appsStatus().then(
    (status) => (on = status.on),
    () => {
      // Making a password still works; it replaces any earlier one.
      on = false;
      message = "Couldn't check whether other apps are on. Try again in a moment.";
    },
  );

  async function make() {
    if (busy) return;
    busy = true;
    message = "";
    try {
      password = await makeAppPassword();
      on = true;
      message = "A new app password is ready. Apps that used the old one need this one now.";
      busy = false;
      await tick();
      copyPassword?.focus();
    } catch {
      message = "Couldn't make an app password. Try again in a moment.";
    }
    busy = false;
  }

  async function turnOff() {
    if (busy) return;
    busy = true;
    message = "";
    try {
      await turnOffApps();
      on = false;
      password = "";
      message = "Other apps are off. Any app that was syncing is signed out; your feeds and articles are unchanged.";
      busy = false;
      await tick();
      makeFirst?.focus();
    } catch {
      message = "Couldn't turn other apps off. Try again in a moment.";
    }
    busy = false;
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      message = `${what} copied.`;
    } catch {
      message = `Couldn't copy. Select the ${what.toLowerCase()} and copy it yourself.`;
    }
  }
</script>

<section aria-labelledby="apps-heading">
  <h3 id="apps-heading" class="inset-head">Other apps</h3>
  <div class="inset-group">
    {#if on}
      <div class="inset-row">
        <p class="min-w-0">
          Server address<br /><span class="value text-muted" translate="no">{address}</span>
        </p>
        <button type="button" class="btn btn-small" onclick={() => copy(address, "Server address")}
          >Copy<span class="sr-only"> server address</span></button
        >
      </div>
      {#if password}
        <div class="inset-row">
          <p class="min-w-0">
            App password<br /><span class="value text-muted" translate="no">{password}</span>
          </p>
          <button bind:this={copyPassword} type="button" class="btn btn-small" onclick={() => copy(password, "App password")}
            >Copy<span class="sr-only"> app password</span></button
          >
        </div>
      {/if}
      <button type="button" aria-disabled={busy} onclick={make} class="inset-row inset-action"
        >Make a new app password<span class="row-glyph"><Icon name="refresh" size={18} /></span></button
      >
      <button type="button" aria-disabled={busy} onclick={turnOff} class="inset-row inset-action"
        >Turn off other apps<span class="row-glyph"><Icon name="close" size={18} /></span></button
      >
    {:else}
      <button
        bind:this={makeFirst}
        type="button"
        aria-disabled={busy || on === undefined}
        onclick={() => on === false && make()}
        class="inset-row inset-action"
        >Make an app password<span class="row-glyph"><Icon name="plus" size={18} /></span></button
      >
    {/if}
  </div>
  <p role="status" class={["inset-foot text-ink", !message && "sr-only"]}>{message}</p>
  <p class="inset-foot">
    Reeder, NetNewsWire and other feed readers can show your feeds and keep read, starred, feeds and folders in
    step with nine turtles. In the app, add a “FreshRSS” or “Google Reader API” account with the server address
    and the app password; any username works. The app password is shown only once and is never your own
    password.
  </p>
</section>

<style>
  /* The address and password: long words that may break anywhere, never off the row. */
  .value {
    overflow-wrap: anywhere;
    font-size: var(--text-meta);
  }
</style>
