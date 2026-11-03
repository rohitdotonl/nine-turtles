<!--
  Settings › Account › Weekly email (SPEC section 39, decision 0150): the one
  thing nine turtles sends that the reader didn't just ask for, so it's off
  until they choose Weekly or Twice a week here. A row like the Reading
  group's: its icon, name and what it does, then a segmented control. Shown
  only while nine turtles can send email and the reader has an address.
  The first choice emails that address a Start link; until it's pressed the
  line under the name says so.
  Why a choice wasn't saved goes to `onProblem`, said under the group.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { OFTEN_CHOICES, explainOften, loadOften, oftenHint, saveOften, type Often } from "./weekly";

  let { onProblem }: { onProblem: (text: string) => void } = $props();

  /** Unknown until the server answers, so the choices wait rather than show Off. */
  let often: Often | undefined = $state();
  /** Waiting for Start to be pressed in the email sent to the reader's address. */
  let waiting = $state(false);

  loadOften().then(
    (answer) => ({ often, waiting } = answer),
    () => onProblem("The weekly email's setting couldn't be read. Check your connection and try again."),
  );

  async function choose(next: Often) {
    const before = often;
    often = next;
    onProblem("");
    const saved = await saveOften(next);
    if ("refusal" in saved) {
      often = before;
      onProblem(explainOften(saved.refusal));
    } else ({ often, waiting } = saved);
  }
</script>

<div class="inset-row setting has-control">
  <div class="setting-label">
    <span class="setting-icon" aria-hidden="true"><Icon name="envelope" size={18} /></span>
    <div class="setting-words">
      <p id="weekly-name" class="setting-name">Weekly email</p>
      <p id="weekly-hint" class="setting-hint">{oftenHint(often, waiting)}</p>
    </div>
  </div>
  <div role="group" aria-labelledby="weekly-name" aria-describedby="weekly-hint" class="choices setting-control" style="--columns: 3">
    {#each OFTEN_CHOICES as choice (choice.value)}
      <label class="choice">
        <input
          type="radio"
          name="weekly"
          value={choice.value}
          checked={often === choice.value}
          disabled={often === undefined}
          onchange={() => choose(choice.value)}
        />
        {choice.label}
      </label>
    {/each}
  </div>
</div>
