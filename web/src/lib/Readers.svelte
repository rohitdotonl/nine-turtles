<!--
  Readers (SPEC section 18, decision 0087), a group of Settings that only
  the owner sees: the owner's own email (to sign in with, beside the password
  alone, and for "Forgot your password?" links; saving it asks for their
  password, decision 0088) and All readers ›, the Readers page (decision
  0090). Sign-up is always open (decision 0115), so there is nothing to set.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { duration } from "./session";
  import { listPeople, plausibleEmail, setOwnEmail, type Person } from "./readers";

  let {
    email = null,
    onReaders,
  }: {
    email?: string | null;
    /** Opens the Readers page. */
    onReaders: (event: MouseEvent) => void;
  } = $props();

  let ownEmail = $state("");
  /** The owner's current password, asked for to save their email (decision 0088). */
  let ownPassword = $state("");
  let refusedField: "email" | "password" | undefined = $state();
  let people: Person[] = $state([]);
  let emailMessage = $state("");
  let emailRefused = $state(false);
  let busy = $state(false);

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
      emailMessage = `Saved. From now on, sign in with ${next} and your password.`;
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
    <a href="/settings/readers/all" onclick={onReaders} data-settings-row="all-readers" class="inset-row inset-action"
      >All readers<span class="row-glyph flex items-center gap-1"
        >{#if people.length > 0}<span class="text-meta">{people.length}</span>{/if}<Icon name="chevron-right" size={18} /></span
      ></a
    >
  </div>
  <p id="readers-message" role="status" class={["inset-foot", emailRefused ? "text-danger" : "text-ink", !emailMessage && "sr-only"]}>
    {emailMessage}
  </p>
  <p class="inset-foot">
    You sign in with your email and your password, and get a link at your email if you forget the password. Changing it
    asks for your password. All readers lists everyone with an account here and how this nine
    turtles is doing; nobody sees what anyone else reads.
  </p>
</section>
