<!--
  An article's byline under its title (SPEC section 7, decisions 0294, 0323
  and 0325): the source's name alone, or "Author / Publication" with the
  slash on the column's centre line, the names hanging either side of it, so
  it sits under the picture and the day whatever the names' lengths. Then the
  day on a line of its own, small and faint. Left to right whatever the
  article's script. "by" and "in" are heard, unseen; the slash is only seen.
-->
<script lang="ts">
  import { exactly, when } from "./times";

  let {
    source,
    author,
    theirs,
    onTheirs,
    site,
    at,
  }: {
    /** The feed's name. */
    source: string;
    /** Who wrote it, when the feed names someone besides `source`. */
    author: string | undefined;
    /** For someone followed: the address of their list, everything of theirs. */
    theirs: string | undefined;
    onTheirs: (event: MouseEvent) => void;
    /** Their website, for a source not followed. */
    site: string | undefined;
    /** When it was published, in seconds. */
    at: number;
  } = $props();
</script>

{#snippet name()}{#if theirs}
    <!-- Someone followed: their name opens their list, everything of theirs (decision 0289); the page about them is a press on from there, or More's "Info about …". No "›" here.
         A link, not a button, so a long name wraps as words do (decision 0260). -->
    <a class="publisher writer-link" href={theirs} title={`Everything by ${source}`} aria-describedby="byline-about" onclick={onTheirs}><bdi>{source}</bdi></a
    ><span id="byline-about" aria-hidden="true" class="sr-only">Opens everything of theirs.</span>
  {:else if site}
    <a href={site} target="_blank" rel="noopener noreferrer" class="publisher hover:underline hover:underline-offset-4"><bdi>{source}</bdi><span class="sr-only">{" "}(opens in a new tab)</span></a>
  {:else}
    <span class="publisher"><bdi>{source}</bdi></span>
  {/if}{/snippet}

<p class="article-byline min-w-0" lang="en" dir="ltr">
  <!-- "by" sits in the writer's cell, on the same line of text as their name, so a screen reader reading by lines says "by Mina Okafor in" together. -->
  {#if author}<span class="pair"
      ><span class="writer"><span class="sr-only">by</span>{" "}<bdi>{author}</bdi>{" "}<span class="sr-only">in</span></span><span class="crumb" aria-hidden="true">/</span><span class="where"
        >{@render name()}</span
      ></span
    >{:else}<span class="sr-only">by</span>{" "}{@render name()}{/if}<span class="sr-only">,</span>
  <!-- The day on a line of its own, small and faint, so the name leads (decision 0294). -->
  <time datetime={new Date(at * 1000).toISOString()} title={exactly(at)}>{when(at)}</time>
</p>

<style>
  /* The writer's name under the title: a 44px target to touch, taller than its line without moving it
     (an inline link's padding above and below never moves the line, on each line a long name wraps onto). */
  /* Underlined at rest, as every link is (the 65% edge), so it reads as a way in; the line comes up to the ink under the pointer. */
  .writer-link {
    padding-block: calc((2.75rem - 1em) / 2);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
    text-decoration-color: color-mix(in srgb, currentColor 65%, transparent);
  }
  @media (hover: hover) {
    .writer-link:hover {
      text-decoration-color: currentColor;
    }
  }
</style>
