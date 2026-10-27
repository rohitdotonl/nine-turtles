<!--
  Passkeys (SPEC section 18, decision 0109), a group of Settings shown only
  where passkeys work: this is the address they belong to, and the browser
  has WebAuthn. Each of the reader's passkeys is a row: its name (theirs, or
  "Passkey added 27 October 2026"), when it was added and last used, Rename
  and Remove. Remove takes it away at once, with Undo straight afterwards;
  the password keeps working, so removing never locks anyone out. "Add a
  passkey" asks for the reader's password first, in a row of the group,
  then the browser's own sheet makes the passkey.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import {
    type PasskeyRow,
    addPasskey,
    browserHasPasskeys,
    day,
    explainAdd,
    listPasskeys,
    passkeyDates,
    passkeyName,
    passkeysHere,
    removePasskey,
    renamePasskey,
    undoRemove,
  } from "./passkeys";

  let { origin = null }: { /** Where passkeys work; null when they're off. */ origin?: string | null } = $props();

  const shown = $derived(passkeysHere(origin, location, browserHasPasskeys()));

  let passkeys: PasskeyRow[] = $state([]);
  /** Adding a passkey: the password row is showing. */
  let asking = $state(false);
  let password = $state("");
  let passwordRefused = $state(false);
  /** The passkey being renamed, and the name typed so far. */
  let renaming: number | undefined = $state();
  let draft = $state("");
  /** The line under the group: what just happened, in red when it's a refusal. */
  let message = $state("");
  let refusal = $state(false);
  let undo: (() => Promise<void>) | undefined = $state();
  let busy = $state(false);
  let line: HTMLElement | undefined = $state();
  let addButton: HTMLButtonElement | undefined = $state();
  let passwordField: HTMLInputElement | undefined = $state();
  let nameField: HTMLInputElement | undefined = $state();

  async function reload() {
    try {
      passkeys = await listPasskeys();
    } catch {
      say("Your passkeys couldn't be loaded. Try again in a moment.", true);
    }
  }

  $effect(() => {
    if (shown) void reload();
  });

  function say(text: string, refused = false) {
    message = text;
    refusal = refused;
    undo = undefined;
  }

  async function startAdding() {
    say("");
    asking = true;
    await tick();
    passwordField?.focus();
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (password === "") {
      passwordRefused = true;
      say("Type your password first, to add a passkey.", true);
      passwordField?.focus();
      return;
    }
    busy = true;
    const result = await addPasskey(password);
    busy = false;
    if (result.ok) {
      password = "";
      passwordRefused = false;
      asking = false;
      await reload();
      say("Passkey added. Next time, choose Sign in with a passkey on the sign-in page.");
      await tick();
      addButton?.focus();
      return;
    }
    passwordRefused = result.reason === "wrong-password" || result.reason === "wait" || result.reason === "password-needed";
    if (result.reason === "wrong-password") password = "";
    // Cancelling the browser's sheet is news, not a refusal.
    say(explainAdd(result), result.reason !== "cancelled");
    if (passwordRefused) passwordField?.focus();
  }

  async function startRename(passkey: PasskeyRow) {
    say("");
    renaming = passkey.id;
    draft = passkey.name ?? "";
    await tick();
    nameField?.focus();
    nameField?.select();
  }

  async function stopRename(id: number) {
    renaming = undefined;
    await tick();
    document.getElementById(`rename-passkey-${id}`)?.focus();
  }

  async function saveName(event: SubmitEvent, passkey: PasskeyRow) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const result = await renamePasskey(passkey.id, draft);
    busy = false;
    if (result === "ok") {
      passkey.name = draft.trim() === "" ? null : draft.trim();
      say("Saved the passkey's name.");
      await stopRename(passkey.id);
      return;
    }
    say(result === "name-long" ? "That name is too long. Keep it under 100 characters." : "The name couldn't be saved. Try again in a moment.", true);
  }

  async function remove(passkey: PasskeyRow) {
    if (busy) return;
    busy = true;
    const done = await removePasskey(passkey.id);
    busy = false;
    if (!done) {
      say("The passkey couldn't be removed. Try again in a moment.", true);
      return;
    }
    passkeys = passkeys.filter((other) => other.id !== passkey.id);
    say(`Removed “${passkeyName(passkey)}”. Your password still works.`);
    undo = async () => {
      if (await undoRemove(passkey.id)) {
        await reload();
        say("The passkey is back.");
      } else {
        say("The passkey couldn't be brought back. Add it again instead.", true);
      }
    };
    await tick();
    line?.querySelector<HTMLElement>("[data-focus=undo]")?.focus();
  }

  async function runUndo() {
    if (!undo || busy) return;
    const doing = undo;
    undo = undefined;
    busy = true;
    await doing();
    busy = false;
    await tick();
    document.getElementById("passkeys-heading")?.focus();
  }
</script>

{#if shown}
  <section aria-labelledby="passkeys-heading">
    <h3 id="passkeys-heading" tabindex="-1" class="inset-head">Passkeys</h3>
    <div class="inset-group">
      {#each passkeys as passkey (passkey.id)}
        {#if renaming === passkey.id}
          <form class="inset-row passkey-row" onsubmit={(event) => saveName(event, passkey)}>
            <label for="passkey-name" class="sr-only">Name of this passkey</label>
            <input
              bind:this={nameField}
              id="passkey-name"
              type="text"
              maxlength="100"
              placeholder={`Passkey added ${day(passkey.createdAt)}`}
              bind:value={draft}
              onkeydown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  void stopRename(passkey.id);
                }
              }}
              class="inset-input"
            />
            <span class="flex shrink-0 items-center gap-2">
              <button type="button" class="btn btn-small" onclick={() => stopRename(passkey.id)}>Cancel</button>
              <button type="submit" class="btn btn-small" aria-disabled={busy}>Save<span class="sr-only"> name</span></button>
            </span>
          </form>
        {:else}
          <div class="inset-row passkey-row">
            <p class="min-w-0 flex-1 break-words">
              {passkeyName(passkey)}<br /><span class="value text-muted">{passkeyDates(passkey)}</span>
            </p>
            <span class="flex shrink-0 items-center gap-2">
              <button id={`rename-passkey-${passkey.id}`} type="button" class="btn btn-small" onclick={() => startRename(passkey)}
                >Rename<span class="sr-only"> {passkeyName(passkey)}</span></button
              >
              <!-- Red words: this removes something. What it removes is in its tooltip and its name, and Undo follows. -->
              <button
                type="button"
                class="btn btn-small text-danger"
                title="Removes this passkey from nine turtles. Your password still works."
                aria-disabled={busy}
                onclick={() => remove(passkey)}>Remove<span class="sr-only"> {passkeyName(passkey)}</span></button
              >
            </span>
          </div>
        {/if}
      {/each}
      {#if asking}
        <form class="inset-row" onsubmit={add}>
          <label for="passkey-password" class="sr-only">Your password</label>
          <input
            bind:this={passwordField}
            id="passkey-password"
            type="password"
            autocomplete="current-password"
            placeholder="Your password"
            bind:value={password}
            aria-describedby="passkeys-message"
            aria-invalid={passwordRefused ? "true" : undefined}
            class="inset-input"
          />
          <button type="submit" aria-disabled={busy} class="btn btn-small">Continue<span class="sr-only"> adding a passkey</span></button>
        </form>
      {:else}
        <button bind:this={addButton} type="button" class="inset-row inset-action" onclick={startAdding}
          >Add a passkey<span class="row-glyph"><Icon name="plus" size={18} /></span></button
        >
      {/if}
    </div>
    <div
      bind:this={line}
      id="passkeys-message"
      role="status"
      class={["inset-foot flex flex-wrap items-center gap-x-3 gap-y-1", refusal ? "text-danger" : "text-ink", !message && "sr-only"]}
    >
      {#if message}
        <p>{message}</p>
        {#if undo}
          <button type="button" class="btn btn-small" data-focus="undo" aria-disabled={busy} onclick={runUndo}>Undo</button>
        {/if}
      {/if}
    </div>
    <p class="inset-foot">
      Sign in with your fingerprint, face or device PIN instead of a password. Adding a passkey asks for your password.
      Your password keeps working, so removing a passkey never locks you out.
    </p>
  </section>
{/if}

<style>
  .passkey-row {
    flex-wrap: nowrap;
    align-items: center;
    padding-block: 0.5rem;
  }
  .value {
    font-size: var(--text-meta);
  }
</style>
