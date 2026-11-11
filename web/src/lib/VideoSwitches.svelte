<!--
  A YouTube channel's two switches (decision 0144, SPEC section 38), on its
  person's or publication's page: Include Shorts and Include live streams,
  both off to start, each changing the moment it's switched, through the
  page's own saving (one change after another, in order). Among their
  settings for a channel on its own; under its row in Sources for one of
  several (`nested`).
-->
<script lang="ts">
  import SettingSwitch from "./SettingSwitch.svelte";
  import type { FeedChanges } from "./feeds";
  import type { Feed } from "./shapes";

  let { source, save, nested = false }: { source: Feed; save: (changes: FeedChanges, on?: number[]) => Promise<boolean>; nested?: boolean } = $props();
</script>

<SettingSwitch
  {nested}
  name="Include Shorts"
  hint="YouTube's short, upright videos. Sorted by YouTube's own lists, so one may slip through now and then."
  checked={source.shorts === true}
  onchange={(on) => void save({ shorts: on }, [source.id])}
/>
<SettingSwitch {nested} name="Include live streams" hint="Streams, and their recordings once they end." checked={source.liveStreams === true} onchange={(on) => void save({ liveStreams: on }, [source.id])} />
