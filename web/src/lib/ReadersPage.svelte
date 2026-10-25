<!--
  Settings › Readers › All readers (SPEC section 18, decision 0089): the
  owner's page. First how this nine turtles is doing, in counts (readers,
  feeds, articles, the database's size, backups, email); then what needs a
  look, in plain words, and the problems noted since nine turtles last
  started; then everyone with an account, newest first after the owner,
  each with when they joined, how many feeds they follow (never which) and
  the day they were last here. Nothing about what anyone reads.
-->
<script lang="ts">
  import { edge } from "./edge";
  import PageHead from "./PageHead.svelte";
  import { backupDay, count, date, lastHere, loadOverview, plural, size, type Overview } from "./admin";

  let {
    heading = $bindable(),
    onClose,
    besideToggle = false,
  }: {
    heading?: HTMLHeadingElement;
    onClose: () => void;
    besideToggle?: boolean;
  } = $props();

  let overview: Overview | undefined = $state();
  let failed = $state(false);
  let now = $state(Date.now() / 1000);

  $effect(() => {
    loadOverview()
      .then((found) => {
        now = Date.now() / 1000;
        overview = found;
      })
      .catch(() => (failed = true));
  });

  /** What needs the owner's look, in plain words. */
  let needs = $derived.by(() => {
    if (!overview) return [];
    const lines: string[] = [];
    if (!overview.backupsOn) {
      lines.push("Backups are off. Add the storage settings on Render to switch them on (docs/operations/backups.md).");
    }
    if (!overview.emailSending) {
      lines.push(
        "Email is off, so sign-up can't be Open and nobody can get a new password by email. Add the email settings on Render (docs/operations/email.md).",
      );
    }
    if (overview.totals.feedsFailing > 0) {
      const many = overview.totals.feedsFailing;
      lines.push(
        `${plural(many, "feed has", "feeds have")} failed for three days or more. Each reader sees theirs on their own Feed health page.`,
      );
    }
    return lines;
  });

  const TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
</script>

<section aria-labelledby="readers-page-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Readers" id="readers-page-heading" bind:heading {onClose} closeLabel="Close readers" {besideToggle} column="max-w-[35rem]" />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-16 md:px-10">
    <div class="mx-auto flex max-w-[35rem] flex-col gap-8">
      {#if failed}
        <p role="status" class="text-ink-2">The readers couldn't be loaded. Only the owner can see them; if that's you, try again in a moment.</p>
      {:else if overview}
        <section aria-labelledby="readers-totals-heading">
          <h3 id="readers-totals-heading" class="inset-head">This nine turtles</h3>
          <dl class="inset-group">
            <div class="inset-row"><dt>Readers</dt><dd class="figure">{count(overview.totals.readers)}</dd></div>
            <div class="inset-row"><dt>Feeds</dt><dd class="figure">{count(overview.totals.feeds)}</dd></div>
            <div class="inset-row"><dt>Articles kept</dt><dd class="figure">{count(overview.totals.articles)}</dd></div>
            <div class="inset-row"><dt>Database</dt><dd class="figure">{size(overview.databaseBytes)}</dd></div>
            {#if overview.emailSending || overview.totals.signUpsWaiting > 0}
              <div class="inset-row"><dt>Waiting to confirm their email</dt><dd class="figure">{count(overview.totals.signUpsWaiting)}</dd></div>
            {/if}
            <div class="inset-row">
              <dt>Backups</dt>
              <dd class="figure">
                {#if !overview.backupsOn}Off{:else if backupDay(overview.latestBackup)}On, latest {backupDay(overview.latestBackup)}{:else}On, none yet{/if}
              </dd>
            </div>
            <div class="inset-row"><dt>Email</dt><dd class="figure">{overview.emailSending ? "On" : "Off"}</dd></div>
          </dl>
          <p class="inset-foot">
            Each feed is fetched once, however many readers follow it. Each reader can follow up to {count(overview.mostFeeds)} feeds.
            Feeds whose readers have all been away for {overview.awayAfterDays} days are checked once a day until one of them
            comes back{#if overview.totals.feedsResting > 0}{" "}({plural(overview.totals.feedsResting, "feed", "feeds")} now){/if}.
          </p>
        </section>

        <section aria-labelledby="readers-needs-heading">
          <h3 id="readers-needs-heading" class="inset-head">Needs a look</h3>
          <ul class="inset-group">
            {#each needs as line (line)}
              <li class="inset-row text-row">{line}</li>
            {:else}
              <li class="inset-row text-row">Nothing needs a look.</li>
            {/each}
          </ul>
          {#if overview.problems.length > 0}
            <ul class="inset-group mt-3" aria-label="Problems noted">
              {#each overview.problems as problem, index (index)}
                <li class="inset-row text-row">
                  <span class="flex min-w-0 flex-col">
                    <time class="text-meta text-muted" datetime={new Date(problem.at * 1000).toISOString()}>{TIME.format(new Date(problem.at * 1000))}</time>
                    <span class="value text-ink-2">{problem.message}</span>
                  </span>
                </li>
              {/each}
            </ul>
            <p class="inset-foot">
              The newest problems nine turtles noted since it last started, in its own technical words. An agent can explain them.
            </p>
          {/if}
        </section>

        <section aria-labelledby="readers-list-heading">
          <h3 id="readers-list-heading" class="inset-head">{plural(overview.readers.length, "reader", "readers")}</h3>
          <ul class="inset-group">
            {#each overview.readers as reader (reader.id)}
              <li class="inset-row text-row">
                <span class="flex min-w-0 flex-col">
                  <span class="value">{reader.email ?? "No email yet"}{#if reader.owner}<span class="text-muted"> (you)</span>{/if}</span>
                  <span class="text-meta text-muted"
                    >Joined {date(reader.createdAt)} · {plural(reader.feeds, "feed", "feeds")} · {lastHere(reader.lastHere, now, overview.awayAfterDays)}</span
                  >
                  {#if reader.feeds >= overview.mostFeeds}
                    <span class="text-meta text-ink-2">Follows as many feeds as one reader can.</span>
                  {/if}
                  {#if reader.feedsFailing > 0}
                    <span class="text-meta text-ink-2">{plural(reader.feedsFailing, "feed keeps", "feeds keep")} failing.</span>
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
          <p class="inset-foot">
            Everyone with an account here. You see how many feeds each follows and the day they were last here, never which
            feeds or what anyone reads.
          </p>
        </section>
      {/if}
    </div>
  </div>
</section>

<style>
  .text-row {
    flex-wrap: nowrap;
    padding-block: 0.625rem;
    line-height: 1.4;
  }
  .text-row > span {
    gap: 0.125rem;
  }
  .figure {
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  /* Long addresses and messages may break anywhere, never off the row. */
  .value {
    overflow-wrap: anywhere;
  }
</style>
