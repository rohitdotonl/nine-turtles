<!--
  The words of one row of the item list (SPEC section 6): its title, or an
  untitled post's opening; a search result's text around the first searched
  word; and the one-line meta under them, with who it's from, when, its kind,
  your place in it, Hidden and the star. The row itself, a button that opens
  the article, is `ItemRow.svelte`'s.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { untitledOpening, type Article } from "./shapes";
  import { sourceOf, writerOf, type OneSource } from "./people";
  import { exactly, when } from "./times";
  import { hugEllipsis } from "./hug";
  import { boldParts } from "./search";
  import RowKind from "./RowKind.svelte";
  import RowPlace from "./RowPlace.svelte";

  let {
    article,
    bold,
    current,
    unreadOff,
    oneFeed,
  }: {
    article: Article;
    /** Searched words: words in the title starting with one are shown in bold. */
    bold: string[];
    /** The selected row: never the quietest. */
    current: boolean;
    /** Unread off: every title looks the same, read or not. */
    unreadOff: boolean;
    /** One person's list: rows don't repeat their name. */
    oneFeed: OneSource;
  } = $props();

  let opening = $derived(untitledOpening(article));
</script>

  <!-- Unread: full ink, semibold (regular under a name in Unread, where the name carries the weight: lists.css .by-person). Read: the second ink, regular. The selected row is never the quietest. With Unread off every title is full ink, regular. -->
  <!-- In the reading serif; with a mouse, clearly larger (19px) than the interface text, so the title leads its row (app.css .item-row). -->
  <!-- An untitled post shows its opening once instead (SPEC section 6, decision 0196): the same serif, never semibold so it doesn't pose as a title, two lines and then "…". -->
  <span class={["title font-serif text-(length:--row-title-size) leading-(--row-title-line)", opening === undefined ? "block" : "line-clamp-2", unreadOff ? "text-ink" : !article.read ? [opening === undefined && "font-semibold", "text-ink"] : current ? "text-ink" : "text-ink-2"]}
    ><bdi
      >{#each boldParts(opening ?? article.title, bold) as part, partIndex (partIndex)}{#if part.bold}<mark class="match"
            >{part.text}</mark
          >{:else}{part.text}{/if}{/each}</bdi
    >{#if !article.read && !unreadOff}<span class="sr-only">, unread</span>{/if}</span
  >
  {#if article.excerpt && article.excerpt.length > 0}
    <!--
      A search result's text around the first searched word (SPEC section 14), right under
      the title and before the meta line, as Apple Books orders a result: plain text from
      nine turtles, shown as text, up to two lines. Searched words are marked as in the title
      (a faint accent tone behind them, and an underline) and in full ink, so they show by
      tone and shape.
    -->
    <span class="excerpt mt-1 line-clamp-2 text-meta text-muted"
      >{#each article.excerpt as piece, pieceIndex (pieceIndex)}{#if piece.match}<mark class="match"
            >{piece.text}</mark
          >{:else}{piece.text}{/if}{/each}</span
    >
  {/if}
  <!--
    Always one line (decision 0048): a long source name ends in "…", the time and star never wrap. The "·" hugs the "…" (decision 0051). The whole line
    is 12px, so the title leads: the time a step fainter than muted grey, the publisher's name in muted grey
    (.row-feed, decision 0123) so the credit reads first; on the selected row both are muted grey (AA).
  -->
  <span class={["row-meta mt-2 text-date tracking-[0.06em]", current ? "text-muted" : "text-[color:var(--faint)]"]}>
    <!-- A publication's writer first, when its feed names one (the owner's core path, point 4). -->
    {#if writerOf(article)}<span class="row-feed"><span class="row-feed-name" use:hugEllipsis={writerOf(article)}>{writerOf(article)}</span>&nbsp;·</span>{/if}
    <span class={oneFeed === true ? "sr-only" : "row-feed"}><span class="row-feed-name" use:hugEllipsis={sourceOf(article, oneFeed)}>{sourceOf(article, oneFeed)}</span>&nbsp;·</span>
    <time datetime={new Date(article.at * 1000).toISOString()} class="row-date" title={exactly(article.at)}>{when(article.at)}</time>
    <!-- A podcast's episode or a YouTube video says so, in the line's own ink (RowKind.svelte). -->
    <RowKind {article} />
    <!-- Your place, while one is kept: "· Half read" (decision 0224). -->
    <RowPlace article={article.id} />
    {#if article.muted}
      <!-- Only search (and Starred) list a muted article; the word says why it waits in no other list (SPEC section 27). -->
      <span class="row-muted">· Hidden</span>
    {/if}
    {#if article.starred}
      <span class="row-star"><Icon name="star" filled /><span class="sr-only">, Starred</span></span>
    {/if}
  </span>

<style>
  /*
    A searched word, in a title or in the line of text under it: one style,
    a faint tone of the accent behind it with small rounded corners, in the
    text's own weight and color, and a fine underline so it never shows by
    tone alone (SPEC.md section 6, decision 0037).
  */
  .match {
    padding: 0;
    text-decoration: underline 1px color-mix(in srgb, currentColor 65%, transparent);
    text-underline-offset: 0.2em;
    border-radius: var(--radius-mark);
    background-color: var(--mark);
    color: inherit;
    font-weight: inherit;
  }
  /* In the muted line of text, the searched words are in full ink too. */
  .excerpt .match {
    color: var(--ink);
  }
</style>
