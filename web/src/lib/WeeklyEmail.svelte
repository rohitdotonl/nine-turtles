<!--
  Settings › Account › Weekly email (SPEC section 39, decisions 0150 and
  0184): the one thing nine turtles sends that the reader didn't just ask
  for, so it's off until they switch it on here. Once a week or not at all.
  A row like Unread's: its icon, name and what it does, then a switch. Shown
  only while nine turtles can send email and the reader has an address; it
  goes only to a confirmed one (decision 0154).
  Why a choice wasn't saved goes to `onProblem`, said under the group.
-->
<script lang="ts">
  import SettingSwitch from "./SettingSwitch.svelte";
  import { explainOften, loadOften, oftenHint, saveOften, type Often } from "./weekly";
  let { onProblem }: { onProblem: (text: string) => void } = $props();

  /** Unknown until the server answers, so the choices wait rather than show Off. */
  let often: Often | undefined = $state();

  loadOften().then(
    (answer) => (often = answer),
    () => onProblem("The weekly email's setting couldn't be loaded. Try again in a moment."),
  );

  async function choose(next: Often) {
    const before = often;
    often = next;
    onProblem("");
    const saved = await saveOften(next);
    if (typeof saved === "object") {
      often = before;
      onProblem(explainOften(saved.refusal));
    } else often = saved;
  }
</script>

<SettingSwitch
  id="weekly"
  icon="envelope"
  name="Weekly email"
  hint={oftenHint(often)}
  checked={often === "weekly"}
  disabled={often === undefined}
  onchange={(on) => choose(on ? "weekly" : "off")}
/>
