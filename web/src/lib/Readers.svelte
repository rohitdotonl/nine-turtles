<!--
  Readers and Sign-up (SPEC section 18, decision 0087), two groups of
  Settings that only the owner sees. Readers: the owner's own email (to sign
  in with, beside the password alone, and for "Forgot your password?"
  links; saving it asks for their password, decision 0088) and everyone with an account, by email
  and when they joined, never what they read. Sign-up: Closed (the default),
  Invite link, or Open, which can be chosen only while nine turtles can send
  the emails that confirm an address (decision 0088). An invite link is made
  here, shown once with a Copy button, and replaced by making a new one. Until
  the owner has saved their own email, a line under Sign-up says to save it
  before sending a link.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import { duration } from "./session";
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
  /** The owner's current password, asked for to save their email (decision 0088). */
  let ownPassword = $state("");
  let refusedField: "email" | "password" | undefined = $state();
  let people: Person[] = $state([]);
  let emailMessage = $state("");
  let emailRefused = $state(false);
  /** Unknown until the server answers. */
  let mode: SignUpMode | undefined = $state();
  let inviteMadeAt: number | null = $state(null);
  /** nine turtles can send email, so Open may be chosen. */
  let openAvailable = $state(false);
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

  /**
   * The email the owner has saved, as the server last said: null for none,
   * undefined until the readers list has come. The `email` from signing in
   * can be out of date, once the owner has saved a new one.
   */
  let savedEmail: string | null | undefined = $state();

  $effect(() => {
    ownEmail = email ?? "";
  });

  function loadPeople() {
    listPeople().then(
      (found) => {
        people = found;
        const own = found.find((person) => person.owner)?.email ?? null;
        // The saved email fills the box, unless the owner has typed in it meanwhile.
        if (ownEmail.trim() === (savedEmail ?? email ?? "")) ownEmail = own ?? "";
        savedEmail = own;
      },
      () => (emailMessage = "Couldn't load the readers. Try again in a moment."),
    );
  }
  loadPeople();

  signUpSettings().then(
    (settings) => {
      mode = settings.mode;
      inviteMadeAt = settings.inviteMadeAt;
      openAvailable = settings.openAvailable;
    },
    () => (signUpMessage = "Couldn't check how sign-up is set. Try again in a moment."),
  );

  async function saveEmail(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const next = ownEmail.trim();
    emailRefused = false;
    refusedField = undefined;
    if (!plausibleEmail(next)) {
      emailRefused = true;
      refusedField = "email";
      emailMessage = "That doesn't look like an email address.";
      return;
    }
    if (ownPassword === "") {
      emailRefused = true;
      refusedField = "password";
      emailMessage = "Type your password too, to save your email.";
      return;
    }
    busy = true;
    const result = await setOwnEmail(next, ownPassword);
    busy = false;
    if (result.ok) {
      emailMessage = `Saved. You can sign in with ${next} and your password; the password alone still works.`;
      savedEmail = next;
      ownEmail = next;
      ownPassword = "";
      loadPeople();
      return;
    }
    emailRefused = result.reason !== "unreachable";
    refusedField =
      result.reason === "email" || result.reason === "already"
        ? "email"
        : result.reason === "wrong-password" || result.reason === "wait"
          ? "password"
          : undefined;
    if (result.reason === "wrong-password") ownPassword = "";
    switch (result.reason) {
      case "already":
        emailMessage = "Another reader has that email.";
        break;
      case "email":
        emailMessage = "That doesn't look like an email address.";
        break;
      case "wrong-password":
        emailMessage = "That isn't your password.";
        break;
      case "wait":
        emailMessage = `Too many wrong tries. Try again in ${duration(result.waitSeconds)}.`;
        break;
      case "unreachable":
        emailMessage = "Couldn't save your email. Try again in a moment.";
        break;
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
      } else if (next === "open") {
        signUpMessage = "Sign-up is open. Anyone can make an account by confirming their email.";
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
    <!-- The email and password rows belong to this form by their form attribute, so each stays a row of the group. -->
    <form id="own-email-form" class="hidden" onsubmit={saveEmail}></form>
    <div class="inset-row">
      <label for="own-email" class="sr-only">Your email</label>
      <input
        id="own-email"
        form="own-email-form"
        type="text"
        inputmode="email"
        autocomplete="email"
        autocapitalize="none"
        spellcheck="false"
        placeholder="Your email"
        bind:value={ownEmail}
        aria-describedby="readers-message"
        aria-invalid={refusedField === "email" ? "true" : undefined}
        class="inset-input"
      />
    </div>
    <div class="inset-row">
      <label for="own-email-password" class="sr-only">Your password</label>
      <input
        id="own-email-password"
        form="own-email-form"
        type="password"
        autocomplete="current-password"
        placeholder="Your password"
        bind:value={ownPassword}
        aria-describedby="readers-message"
        aria-invalid={refusedField === "password" ? "true" : undefined}
        class="inset-input"
      />
      <button type="submit" form="own-email-form" aria-disabled={busy} class="btn btn-small"
        >Save<span class="sr-only"> your email</span></button
      >
    </div>
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
    in by email and your password (the password alone still works), and get a link if you forget it. Saving it asks for
    your password.
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
              disabled={mode === undefined || (choice.value === "open" && !openAvailable)}
              aria-describedby={choice.value === "open" ? "open-note" : undefined}
              onchange={() => choose(choice.value)}
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
  {#if mode === "invite" && savedEmail === null}
    <p class="inset-foot text-ink">
      Save your own email under Readers before you send an invite link, so nobody who has the link can sign up with it
      first.
    </p>
  {/if}
  <p role="status" class={["inset-foot text-ink", !signUpMessage && "sr-only"]}>{signUpMessage}</p>
  <p class="inset-foot">
    Closed: nobody can make an account. Invite link: anyone you send the link to can, until you make a new link or close
    sign-up; the link is shown only once. At most 20 sign-ups are tried in any hour.
  </p>
  {#if openAvailable}
    <p id="open-note" class="inset-foot">
      Open: anyone can, once they open the link emailed to them. Who has joined is in Readers above.
    </p>
  {:else}
    <p id="open-note" class="inset-foot">
      Open, for anyone, becomes possible once nine turtles can send confirmation emails (the email settings in
      docs/operations/email.md).
    </p>
  {/if}
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
