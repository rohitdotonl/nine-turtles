-- People are called by their names (owner's plan, step 2): a person whose
-- feed signs every article with the same one author's name is called by
-- that name, not by the blog's title ("Tomas Berg", not "Notes from
-- Tomas"). The blog's title still shows under the name on their page.
--
-- This changes no structure, only names, and only where the reader never
-- gave one: a person on their own (not joined to others, who already have
-- the name the reader chose), whose name is still exactly the feed's own
-- title. A name the reader typed stays. A publication keeps its title.
-- Every feed, article, mark, folder and note carries on exactly as before.
--
-- The names left out are a role or a placeholder, never someone's (the
-- same list as `writers::kind::NOT_NAMES`, which names places added from
-- now on).
UPDATE subscriptions
SET title = (
    -- As the feed writes it, newest first, capitalised if any article capitalises it.
    SELECT trim(articles.author) FROM articles
    WHERE articles.feed_id = subscriptions.feed_id
    ORDER BY substr(trim(articles.author), 1, 1) != lower(substr(trim(articles.author), 1, 1)) DESC,
        articles.id DESC
    LIMIT 1
)
WHERE writer_id IS NULL
    AND kind = 'person'
    AND title = (SELECT feeds.title FROM feeds WHERE feeds.id = subscriptions.feed_id)
    AND EXISTS (SELECT 1 FROM articles WHERE articles.feed_id = subscriptions.feed_id)
    AND NOT EXISTS (
        SELECT 1 FROM articles WHERE articles.feed_id = subscriptions.feed_id
            AND trim(COALESCE(articles.author, '')) = ''
    )
    AND (
        SELECT COUNT(DISTINCT lower(trim(articles.author))) FROM articles
        WHERE articles.feed_id = subscriptions.feed_id
    ) = 1
    AND (
        SELECT lower(trim(articles.author)) FROM articles
        WHERE articles.feed_id = subscriptions.feed_id LIMIT 1
    ) NOT IN ('admin', 'administrator', 'anonymous', 'author', 'editor', 'editors',
              'guest', 'root', 'staff', 'team', 'unknown', 'user', 'webmaster')
    AND (
        SELECT length(trim(articles.author)) <= 60
            AND instr(articles.author, '@') = 0
            AND instr(articles.author, '/') = 0
            AND instr(articles.author, ':') = 0
        FROM articles WHERE articles.feed_id = subscriptions.feed_id LIMIT 1
    );
