<!--
  Readers and Sign-up (SPEC section 18, decision 0087), two groups of
  Settings that only the owner sees. Readers: the owner's own email (to sign
  in with, beside the password alone) and everyone with an account, by email
  and when they joined, never what they read. Sign-up: Closed (the default),
  Invite link, or Open, which is shown but can't be chosen until nine turtles
  can send confirmation emails. An invite link is made here, shown once with
  a Copy button, and replaced by making a new one.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import {
    inviteLink,
    listPeople,
    makeInvite,
    plausibleEmail,
    setOwnEmail,
    signUpSettings,
    switchSignUp,
    type Person,
    type SignUpMode,
  } from "./readers";

  let { email = null }: { email?: string | null } = $props();

  let ownEmail = $state("");
  let people: Person[] = $state([]);
  let emailMessage = $state("");
  let emailRefused = $state(false);
  /** Unknown until the server answers. */
  let mode: SignUpMode | undefined = $state();
  let inviteMadeAt: number | null = $state(null);
  /** The new invite link, shown only until Settings closes. */
  let link = $state("");
  let signUpMessage = $state("");
  let busy = $state(false);
  let copyLink: HTMLButtonElement | undefined = $state();

  const CHOICES = [
    { value: "closed", label: "Closed" },
    { value: "invite", label: "Invite link" },
    { value: "open", label: "Open" },
  ] as const;

  $effect(() => {
    ownEmail = email ?? "";
  });

  function loadPeople() {
    listPeople().then(
      (found) => (people = found),
      () => (emailMessage = "Couldn't load the readers. Try again in a moment."),
    );
  }
  loadPeople();

  signUpSettings().then(
    (settings) => {
      mode = settings.mode;
      inviteMadeAt = settings.inviteMadeAt;
    },
    () => (signUpMessage = "Couldn't check how sign-up is set. Try again in a moment."),
  );

  async function saveEmail(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const next = ownEmail.trim();
    emailRefused = false;
    if (!plausibleEmail(next)) {
      emailRefused = true;
      emailMessage = "That doesn't look like an email address.";
      return;
    }
    busy = true;
    const result = await setOwnEmail(next);
    busy = false;
    if (result === "ok") {
      emailMessage = `Saved. You can sign in with ${next} and your password; the password alone still works.`;
      loadPeople();
    } else {
      emailRefused = result !== "unreachable";
      emailMessage =
        result === "already"
          ? "Another reader has that email."
          : result === "email"
            ? "That doesn't look like an email address."
            : "Couldn't save your email. Try again in a moment.";
    }
  }

  async function choose(next: SignUpMode) {
    if (busy || next === mode) return;
    const before = mode;
    mode = next;
    busy = true;
    signUpMessage = "";
    try {
      await switchSignUp(next);
      if (next === "closed") {
        link = "";
        inviteMadeAt = null;
        signUpMessage = "Sign-up is closed. Any invite link no longer works.";
      } else {
        signUpMessage = inviteMadeAt === null ? "Make an invite link to send to someone." : "";
      }
    } catch {
      mode = before;
      signUpMessage = "Couldn't change sign-up. Try again in a moment.";
    }
    busy = false;
  }

  async function make() {
    if (busy) return;
    busy = true;
    signUpMessage = "";
    try {
      const replacing = inviteMadeAt !== null;
      link = inviteLink(location.origin, await makeInvite());
      inviteMadeAt = Math.floor(Date.now() / 1000);
      signUpMessage = replacing
        ? "A new invite link is ready. The old one no longer works."
        : "An invite link is ready. It's shown only now, so copy it.";
      busy = false;
      await tick();
      copyLink?.focus();
    } catch {
      signUpMessage = "Couldn't make an invite link. Try again in a moment.";
    }
    busy = false;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      signUpMessage = "Invite link copied.";
    } catch {
      signUpMessage = "Couldn't copy. Select the invite link and copy it yourself.";
    }
  }

  function joined(seconds: number): string {
    return new Date(seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
</script>

<section aria-labelledby="readers-heading">
  <h3 id="readers-heading" class="inset-head">Readers</h3>
  <div class="inset-group">
    <form class="inset-row" onsubmit={saveEmail}>
      <label for="own-email" class="sr-only">Your email</label>
      <input
        id="own-email"
        type="text"
        inputmode="email"
        autocomplete="email"
        autocapitalize="none"
        spellcheck="false"
        placeholder="Your email"
        bind:value={ownEmail}
        aria-describedby="readers-message"
        aria-invalid={emailRefused ? "true" : undefined}
        class="inset-input"
      />
      <button type="submit" aria-disabled={busy} class="btn btn-small">Save<span class="sr-only"> your email</span></button>
    </form>
    {#each people as person (person.id)}
      <div class="inset-row">
        <p class="min-w-0">
          <span class="value-ink">{person.email ?? "No email yet"}</span>{#if person.owner}<span class="text-muted"> (you)</span>{/if}<br /><span
            class="value text-muted">Joined {joined(person.createdAt)}</span
          >
        </p>
      </div>
    {/each}
  </div>
  <p id="readers-message" role="status" class={["inset-foot", emailRefused ? "text-danger" : "text-ink", !emailMessage && "sr-only"]}>
    {emailMessage}
  </p>
  <p class="inset-foot">
    Everyone with an account here, and when they joined. Nobody sees what anyone else reads. With your email you can sign
    in by email and your password; the password alone still works.
  </p>
</section>

<section aria-labelledby="sign-up-heading">
  <h3 id="sign-up-heading" class="inset-head">Sign-up</h3>
  <div class="inset-group">
    <fieldset class="inset-row">
      <legend class="row-name">Who can sign up</legend>
      <div class="choices control" style="--columns: 3">
        {#each CHOICES as choice (choice.value)}
          <label class="choice">
            <input
              type="radio"
              name="sign-up"
              value={choice.value}
              checked={mode === choice.value}
              disabled={mode === undefined || choice.value === "open"}
              aria-describedby={choice.value === "open" ? "open-note" : undefined}
              onchange={() => choice.value !== "open" && choose(choice.value)}
            />
            {choice.label}
          </label>
        {/each}
      </div>
    </fieldset>
    {#if mode === "invite"}
      {#if link}
        <div class="inset-row">
          <p class="min-w-0">Invite link<br /><span class="value text-muted" translate="no">{link}</span></p>
          <button bind:this={copyLink} type="button" class="btn btn-small" onclick={copy}
            >Copy<span class="sr-only"> invite link</span></button
          >
        </div>
      {/if}
      <button type="button" aria-disabled={busy} onclick={make} class="inset-row inset-action"
        >{inviteMadeAt === null ? "Make an invite link" : "Make a new invite link"}<span class="row-glyph"
          ><Icon name={inviteMadeAt === null ? "plus" : "refresh"} size={18} /></span
        ></button
      >
    {/if}
  </div>
  <p role="status" class={["inset-foot text-ink", !signUpMessage && "sr-only"]}>{signUpMessage}</p>
  <p class="inset-foot">
    Closed: nobody can make an account. Invite link: anyone you send the link to can, until you make a new link or close
    sign-up; the link is shown only once. At most 20 accounts are made in any hour.
  </p>
  <p id="open-note" class="inset-foot">Open, for anyone, becomes possible once nine turtles can send confirmation emails.</p>
</section>

<style>
  /* As in Settings: a row's name on its left, and the control the same width at its right end. */
  .row-name {
    float: left;
    padding: 0;
    color: var(--ink);
    font-size: var(--text-ui);
  }
  .control {
    flex: 0 1 22rem;
    min-width: 0;
  }
  .choices.control {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }
  .choices.control :global(.choice) {
    justify-content: center;
    padding-inline: 0.5rem;
    text-align: center;
    line-height: 1.2;
    text-wrap: balance;
  }
  @media (width < 40rem) {
    .control {
      flex-basis: 100%;
    }
  }
  /* Long addresses and links may break anywhere, never off the row. */
  .value,
  .value-ink {
    overflow-wrap: anywhere;
  }
  .value {
    font-size: var(--text-meta);
  }
</style>
