<!--
  Readers (SPEC section 18, decision 0087), a group of Settings that only
  the owner sees: All readers ›, the Readers page (decision 0090). The
  owner's own email is changed under Account, by a link to the new address,
  as everyone's is (decision 0125). Sign-up is always open (decision 0115),
  so there is nothing to set.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { listPeople, type Person } from "./readers";

  let {
    onReaders,
  }: {
    /** Opens the Readers page. */
    onReaders: (event: MouseEvent) => void;
  } = $props();

  let people: Person[] = $state([]);
  let message = $state("");

  listPeople().then(
    (found) => (people = found),
    () => (message = "Couldn't load the readers. Try again in a moment."),
  );
</script>

<section aria-labelledby="readers-heading">
  <h3 id="readers-heading" class="inset-head">Readers</h3>
  <div class="inset-group">
    <a href="/settings/readers/all" onclick={onReaders} data-settings-row="all-readers" class="inset-row inset-action"
      >All readers<span class="row-glyph flex items-center gap-1"
        >{#if people.length > 0}<span class="text-meta">{people.length}</span>{/if}<Icon name="chevron-right" size={18} /></span
      ></a
    >
  </div>
  <p role="status" class={["inset-foot text-danger", !message && "sr-only"]}>{message}</p>
  <p class="inset-foot">
    All readers lists everyone with an account here and how this nine turtles is doing; nobody sees what anyone else
    reads.
  </p>
</section>
