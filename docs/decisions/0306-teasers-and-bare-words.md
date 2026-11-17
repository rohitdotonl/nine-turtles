# 0306: A one-line teaser is only the beginning, and bare words still end on the ◆

**In one line:** an RSS description that's one short line of bare words (no markup, at most 300 characters) under a title of its own is a post's subtitle, and one ending with "The post … appeared first on …" is an excerpt, so both are shown as only the beginning with **Read the rest on {site}**; and words a feed sends with no paragraph around them now get the ◆ when they are the whole article.

*18 November 2026. The owner asked why one blog's articles had no ◆. Its feed sends each post as one bare line, a subtitle standing for the post, which nine turtles took for the whole post (decision 0218), and the ◆ found no paragraph to follow. The owner chose to show such lines as teasers, and asked for similar cases: a look through the owner's feeds found the same bare one-liners at a few more blogs, and a WordPress excerpt with no "[…]".*

**What changes.**
1. **Teasers** (`server/src/feed/whole.rs`). Besides "…", "[…]" and "Read more" (decision 0218), an RSS description is only the beginning when it's one line of bare words, no longer than 300 characters (a subtitle or a search engine's description runs to about 160), with no markup at all, under a title of its own that isn't the same words. A writer's own short note comes in a paragraph, a post with no title (Bluesky sends its posts, up to 300 characters, as bare words with no title) or titled with its own words is the post, and a podcast episode's short notes are its notes: all stay whole.
2. **Excerpts with no "[…]".** "The post … appeared first on …", which the Yoast SEO plugin adds to a WordPress excerpt, marks a cut on its own. Only that exact shape: "An earlier version appeared first on …" at the end of a whole essay is no cut.
3. **The ◆ on bare words** (`web/src/lib/pauses.ts`). When an article's words have no block around them (bare text, perhaps with line breaks), the ◆ still ends them, as it ends a last paragraph.

Articles still in a feed are re-read on its next check (`server/src/feeds/store.rs` rewrites a stored article whose text changed), so they move to the new rule then, with nothing lost and nothing marked unread; ones that have left the feed keep how they were saved. Not covered: a feed whose full-text field itself holds only a teaser (a picture and one sentence), since nine turtles can't tell that from a short post.

**Considered and not taken.** Showing the one line as a whole post with the ◆: it passes a subtitle off as the piece (honest by default).

**Revisit if** a feed's real one-line posts start showing "Only the beginning is shared here."
