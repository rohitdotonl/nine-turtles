<!--
  A password field with a Show button at its right end (decision 0191): typing
  twelve characters blind on a phone makes mistakes, so the reader may look.
  Show turns the dots into the letters typed and becomes Hide; the field keeps
  its place and what's typed. Used on sign-in, sign-up, confirming the email
  and choosing a new password. A quiet button in the second ink, never the
  accent; 44px tall, the field's own height.
-->
<script lang="ts">
  let {
    id,
    value = $bindable(""),
    autocomplete,
    autofocus = false,
    describedby,
    invalid = false,
    placeholder,
    label,
    class: place = "",
  }: {
    id: string;
    value?: string;
    autocomplete: "current-password" | "new-password";
    autofocus?: boolean;
    describedby?: string;
    invalid?: boolean;
    placeholder?: string;
    /** What the field is called, for the button's name ("Show password"). */
    label?: string;
    /** Where the field sits in its page's layout. */
    class?: string;
  } = $props();

  let shown = $state(false);
</script>

<div class={["relative", place]}>
  <!-- svelte-ignore a11y_autofocus: only where the page's one task is this field. -->
  <input
    {id}
    name={id}
    type={shown ? "text" : "password"}
    {autocomplete}
    autocapitalize="none"
    autocorrect="off"
    spellcheck="false"
    required
    {autofocus}
    {placeholder}
    bind:value
    aria-describedby={describedby}
    aria-invalid={invalid ? "true" : undefined}
    class="field w-full pr-[4.5rem]"
  />
  <button
    type="button"
    onclick={() => (shown = !shown)}
    aria-label={`${shown ? "Hide" : "Show"} ${label ?? "password"}`}
    aria-controls={id}
    class="btn-quiet btn-small absolute inset-y-0 right-0 rounded-l-none">{shown ? "Hide" : "Show"}</button
  >
</div>
