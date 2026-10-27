// A made-up publisher for the browser tests: a few blogs with feeds, on this
// computer only. Uses only what comes with Node, so it needs no libraries.
// Every feed and article here is invented (AGENTS.md: test fixtures use
// made-up feeds only).
//
//   /                  Quiet Notes' home page, naming /feed.xml (60 articles)
//   /garden/           Garden Letters' home page, naming /garden.xml
//   /two/              a page naming two feeds, so the reader chooses
//   /plain/            a page naming no feed
//   /reading/          Reading Room's home page, naming /reading.xml: one
//                      full article (headings, a quote, code, a table, an
//                      image and a tracking image), one summary only, and
//                      a summary with a big picture that opens larger
//   /videos/           Slow Films' home page, naming /videos.xml: a made-up
//                      YouTube channel's feed (Atom with media details),
//                      one video with a description and one without
//   /visits            how often each address here was asked for, so tests
//                      can prove the tracking image is never loaded
//   /blog/NAME/        a home page for a blog called NAME, naming its feed
//                      (and its comments feed too, if NAME starts with
//                      "two-"); tests that add a feed use their own NAME,
//                      so they never meet each other's feeds
//   /grow/NAME         the blog called NAME publishes one more article, so a
//                      test can watch it arrive in the background
//   /move/NAME         the blog called NAME moves its feed: feed.xml answers
//                      "not found", and its home page names new.xml instead.
//                      A blog whose NAME starts with "moving-" names its home
//                      page here, so Find new address can visit it
//   /hindi/NAME/       like /blog/NAME/, for a blog written in Hindi
//   /shelf/BLOG/       the screenshots' library: a handful of made-up blogs
//                      with real-looking titles, authors and dates (SHELF
//                      below), naming /shelf/BLOG/feed.xml
//   /shelf/BLOG/COPY/  a fresh copy of that blog under its own address, for
//                      a test that must start with nothing read or starred

import { createServer } from "node:http";

const port = Number(process.env.FEED_SERVER_PORT ?? 4319);
const DAY = 24 * 60 * 60 * 1000;
// A fixed starting day, so screenshots don't change from run to run.
const NEWEST = Date.UTC(2026, 9, 20, 9, 30);

const page = (title, feeds) => `<!doctype html><html><head><title>${title}</title>
${feeds.map(([name, href, type]) => `<link rel="alternate" type="${type ?? "application/rss+xml"}" title="${name}" href="${href}">`).join("\n")}
</head><body><h1>${title}</h1></body></html>`;

const TITLES = [
  "On keeping a commonplace book",
  "Walking the long way home",
  "A year of reading slowly",
  "Notes from the allotment",
  "Why I still write letters",
  "The quiet pleasure of a finished list",
  "Small tools that last",
  "What the river taught me",
];

// Article `number` keeps its title and date as later ones arrive: `first`
// is how many the feed had to begin with.
function rss(title, link, count, first = count) {
  const items = Array.from({ length: count }, (_, index) => {
    const number = count - index;
    const place = (((first - number) % TITLES.length) + TITLES.length) % TITLES.length;
    const date = new Date(NEWEST - (first - number) * DAY).toUTCString();
    return `<item><title>${TITLES[place]} (${number})</title>
<link>${link}${number}</link><guid>${link}${number}</guid><pubDate>${date}</pubDate>
<description>&lt;p&gt;A short made-up summary for article ${number}.&lt;/p&gt;</description></item>`;
  });
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>
<link>${link}</link>${items.join("\n")}</channel></rss>`;
}

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Quiet Notes: comments</title>
<id>urn:quiet-notes:comments</id><updated>2026-10-19T08:00:00Z</updated>
<entry><title>A reply about letters</title><id>urn:quiet-notes:c1</id><updated>2026-10-19T08:00:00Z</updated>
<link href="https://quiet-notes.example/comments/1"/></entry></feed>`;

const ROOM = "https://reading-room.example/";
const WHOLE = `<p>Most of what I read now arrives slowly, and I like it that way.
A <a href="/letters">letter</a> can wait a week; a good essay can wait a year.</p>
<img src="http://127.0.0.1:${port}/reading/pixel.gif" width="1" height="1" alt="">
<h2>What a slow reader keeps</h2>
<p>Three things, mostly: a notebook, a pencil and an afternoon with nothing in it.</p>
<blockquote><p>Reading is a conversation that never interrupts.</p></blockquote>
<figure><img src="http://127.0.0.1:${port}/reading/river.svg" width="640" height="240" alt="A river drawn as three blue lines">
<figcaption>The river near the allotment, drawn from memory.</figcaption></figure>
<h3>A small table of habits</h3>
<table><thead><tr><th>Habit</th><th>How often</th></tr></thead>
<tbody><tr><td>Letters</td><td>Weekly</td></tr><tr><td>Long essays</td><td>Monthly</td></tr></tbody></table>
<p>And the one line of code I still remember: <code>print("hello")</code>.<sup><a href="#note-1">1</a></sup></p>
<pre><code>for book in shelf:
    read(book, slowly=True)</code></pre>
<p id="note-1">1. Written in Python, a long time ago.</p>`;

// Shaped like a YouTube channel's feed; the channel and its videos are made up.
const videos = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
<title>Slow Films</title><link rel="alternate" href="https://www.youtube.com/channel/UCslowfilms0000000000000"/>
<entry><id>yt:video:AAAAAAAAAAA</id><yt:videoId>AAAAAAAAAAA</yt:videoId><title>A river at dawn, for an hour</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=AAAAAAAAAAA"/><published>${new Date(NEWEST).toISOString()}</published>
<media:group><media:content url="https://www.youtube.com/v/AAAAAAAAAAA?version=3" type="application/x-shockwave-flash" width="640" height="390"/><media:title>A river at dawn, for an hour</media:title>
<media:description>Nothing happens, slowly.

Filmed on one still morning.</media:description></media:group></entry>
<entry><id>yt:video:BBBBBBBBBBB</id><yt:videoId>BBBBBBBBBBB</yt:videoId><title>Rain on a tin roof</title>
<link rel="alternate" href="https://www.youtube.com/watch?v=BBBBBBBBBBB"/><published>${new Date(NEWEST - DAY).toISOString()}</published>
<media:group><media:content url="https://www.youtube.com/v/BBBBBBBBBBB?version=3" type="application/x-shockwave-flash" width="640" height="390"/><media:title>Rain on a tin roof</media:title></media:group></entry>
</feed>`;

const reading = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<title>Reading Room</title><link>${ROOM}</link><language>en-GB</language>
<item><title>The pleasure of a slow letter</title><link>${ROOM}slow-letter</link><guid>${ROOM}slow-letter</guid>
<pubDate>${new Date(NEWEST).toUTCString()}</pubDate><author>a@reading-room.example (Asha Rao)</author>
<description>A short version.</description>
<content:encoded><![CDATA[${WHOLE}]]></content:encoded></item>
<item><title>Only the first page</title><link>${ROOM}first-page</link><guid>${ROOM}first-page</guid>
<pubDate>${new Date(NEWEST - DAY).toUTCString()}</pubDate>
<description>&lt;p&gt;This feed shares just the opening paragraph of each article.&lt;/p&gt;</description></item>
<item><title>A third, shorter note</title><link>${ROOM}third</link><guid>${ROOM}third</guid>
<pubDate>${new Date(NEWEST - 2 * DAY).toUTCString()}</pubDate>
<description>&lt;p&gt;Three is a good number of articles.&lt;/p&gt;&lt;img src="http://127.0.0.1:${port}/reading/hills.svg" alt="Two hills at dusk, drawn in greys"&gt;</description></item>
</channel></rss>`;

const RIVER = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">
<rect width="640" height="240" fill="#dfe6ee"/>
<path d="M0 80 C160 40 320 120 640 70" stroke="#2f4a7a" stroke-width="6" fill="none"/>
<path d="M0 130 C200 90 360 170 640 120" stroke="#2f4a7a" stroke-width="6" fill="none"/>
<path d="M0 180 C180 140 380 220 640 170" stroke="#2f4a7a" stroke-width="6" fill="none"/></svg>`;

// A big picture (1600 by 1000), shown smaller in the column, so it opens larger (decision 0107).
const HILLS = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<rect width="1600" height="1000" fill="#e9e4dc"/>
<path d="M0 700 C300 450 600 450 900 700 Z" fill="#8c8a86"/>
<path d="M600 1000 C900 500 1300 500 1600 760 L1600 1000 Z" fill="#5c5b58"/>
<rect y="760" width="1600" height="240" fill="#5c5b58"/></svg>`;

// A made-up blog in Hindi, to show search finds Hindi words whole.
const kavita = (title, link) => `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>
<link>${link}</link><language>hi</language>
<item><title>पुस्तकालय की एक शाम</title><guid>${link}library</guid><pubDate>${new Date(NEWEST).toUTCString()}</pubDate>
<description>&lt;p&gt;शहर के पुराने पुस्तकालय में नई किताबें आई हैं।&lt;/p&gt;</description></item>
<item><title>बारिश</title><guid>${link}rain</guid><pubDate>${new Date(NEWEST - DAY).toUTCString()}</pubDate>
<description>&lt;p&gt;आज मौसम बहुत सुहावना है।&lt;/p&gt;</description></item></channel></rss>`;

// The screenshots' library (tests/screens.ts): what a real reader might
// follow, so the pictures on a pull request look like nine turtles in use.
// Each blog posts every `every` days, its newest `hours` before NEWEST.
const SHELF = {
  "field-notes": {
    title: "Field Notes",
    author: "Maren Holt",
    hours: 3,
    every: 2,
    posts: [
      ["The first frost on the long meadow", "Everything went white overnight, and the meadow sounded different underfoot."],
      ["A month of walking the same path", "Thirty walks along one mile taught me more than a summer of new trails."],
      ["What the hedgerow keeps in winter", "Rosehips, a wren's nest and a surprising amount of noise."],
      ["Learning the names of mosses", "There are more than I thought, and none of them are in a hurry."],
      ["Fog, and the sound of the estuary", "On foggy mornings you hear the water long before you see it."],
      ["Reading the weather from the hills", "My grandfather could tell rain from the colour of the far ridge."],
      ["A notebook for the birds I hear", "I can name more birds by their song than by their feathers now."],
      ["The oak that fell in the September storm", "It took a hundred and forty years to grow and an afternoon to fall."],
    ],
  },
  "the-margins": {
    title: "The Margins",
    author: "Theo Lindqvist",
    hours: 7,
    every: 3,
    posts: [
      ["On reading the same book twice", "The second time through, you notice what the author was quietly doing all along."],
      ["Notes in the margins of a library book", "Someone in 1974 underlined every mention of the sea."],
      ["The case for reading slowly", "A chapter a night, with nothing else open, is still the best way I know to read."],
      ["Why I keep a commonplace book", "Fifteen years of copied sentences, and what they say about me."],
      ["Second-hand bookshops I have loved", "Three shops, three cities, and the smell they all share."],
      ["A shelf of books I haven't read yet", "An unread library isn't a failure. It's a promise."],
      ["What makes a good first sentence", "Some openings ask a question. The best ones make a promise."],
      ["Reading aloud, after all these years", "My father read to us every night, and now I read to him."],
    ],
  },
  "small-kitchen": {
    title: "Small Kitchen",
    author: "Ines Duarte",
    hours: 11,
    every: 4,
    posts: [
      ["A soup for the first cold week", "Leeks, potatoes and one good onion. Nothing else needed."],
      ["Bread, slowly", "A dough that rises overnight asks for patience and gives back flavour."],
      ["The tomatoes I didn't plan for", "A neighbour's glut became a winter's worth of sauce."],
      ["Cooking from the back of the cupboard", "Lentils, a tin of anchovies and a lemon go further than you'd think."],
      ["My mother's lemon cake, written down at last", "She never measured anything, so this took eleven tries."],
      ["One pan, four evenings", "Roast once on Sunday, and the week's dinners mostly take care of themselves."],
      ["The quiet joy of a sharp knife", "Ten minutes with a whetstone changes every meal that follows."],
    ],
  },
  "low-tide": {
    title: "Low Tide",
    author: "Kai Ostrander",
    hours: 15,
    every: 3,
    posts: [
      ["Photographing the harbour before dawn", "The best light lasts about eleven minutes, and the gulls know it."],
      ["Rock pools in October", "Anemones, a shore crab and one very offended blenny."],
      ["A slower camera", "Twelve frames on a roll makes you look harder at each one."],
      ["The lighthouse keeper's logbook", "Weather, ships and the occasional complaint about the cocoa."],
      ["Walking the tideline after a storm", "Rope, sea glass and a single shoe, as there always is."],
      ["What the sea took back this year", "The dunes moved three metres inland, and nobody noticed."],
      ["Learning to read a tide table", "Two highs, two lows and a lot of arithmetic on the back of a ticket."],
    ],
  },
  workbench: {
    title: "Workbench",
    author: "Ruth Adeyemi",
    hours: 19,
    every: 5,
    posts: [
      ["Restoring a hand plane from a car boot sale", "Two pounds, a lot of rust and a weekend of patience."],
      ["Small tools that last", "The tools I use most are the cheapest ones I own."],
      ["A bookshelf with no screws", "Wedged tenons, and the satisfaction of a joint that holds itself."],
      ["Sharpening, the boring way", "Three stones, a little water and no shortcuts."],
      ["The case for finishing things", "A half-built chair has been teaching me about the other half."],
      ["Why I write down every mistake", "My shop notebook is mostly a list of things not to do again."],
      ["A workshop in a garden shed", "Four square metres, one window and everything on a hook."],
      ["Oiling the bench before winter", "Linseed, a rag and the smell of every autumn I can remember."],
    ],
  },
  "slow-code": {
    title: "Slow Code",
    author: "Priya Natarajan",
    hours: 23,
    every: 4,
    posts: [
      ["Software that will still run in ten years", "Boring tools, plain files and fewer moving parts."],
      ["Reading other people's code for fun", "Like reading letters: you learn how someone thinks."],
      ["The pleasure of deleting things", "My best week this year added nothing and removed four thousand lines."],
      ["Writing for the next person", "Every comment is a note to someone you'll never meet."],
      ["Small websites, again", "A page that loads instantly is a kind of courtesy."],
      ["An editor I've used for twenty years", "It hasn't changed, and that's the point."],
    ],
  },
  "garden-letters": {
    title: "Garden Letters",
    author: "Hal Brennan",
    hours: 27,
    every: 5,
    posts: [
      ["Notes from the allotment in late October", "The last beans are in, the leeks are standing and the shed roof leaks."],
      ["Saving seed for next spring", "Paper envelopes, a pencil and a dry drawer."],
      ["A compost heap is a kind of diary", "Everything we ate this summer, slowly becoming next year's soil."],
      ["Planting garlic on the shortest days", "Push them in, cover them up and forget about them until June."],
      ["The robin who supervises my digging", "He arrives with the spade and leaves with the worms."],
    ],
  },
};

function shelf(name, base) {
  const blog = SHELF[name];
  const site = `https://${name}.example/`;
  const items = blog.posts.map(([title, summary], index) => {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const date = new Date(NEWEST - blog.hours * 60 * 60 * 1000 - index * blog.every * DAY).toUTCString();
    return `<item><title>${title}</title><link>${site}${slug}</link><guid>${base}${slug}</guid>
<pubDate>${date}</pubDate><author>hello@${name}.example (${blog.author})</author>
<description>&lt;p&gt;${summary}&lt;/p&gt;</description></item>`;
  });
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>${blog.title}</title>
<link>${site}</link><language>en</language>${items.join("\n")}</channel></rss>`;
}

const visits = new Map();
// How many articles each /blog/NAME/ has published since it began with three.
const grown = new Map();
// The blogs that moved their feed to new.xml.
const moved = new Set();

createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  visits.set(path, (visits.get(path) ?? 0) + 1);
  const send = (type, body) => {
    response.writeHead(200, { "content-type": type });
    response.end(body);
  };
  const html = (body) => send("text/html; charset=utf-8", body);
  const xml = (body) => send("application/rss+xml", body);

  if (path === "/") return html(page("Quiet Notes", [["Quiet Notes", "/feed.xml"]]));
  if (path === "/feed.xml") return xml(rss("Quiet Notes", "https://quiet-notes.example/", 60));
  if (path === "/garden/") return html(page("Garden Letters", [["Garden Letters", "/garden.xml"]]));
  if (path === "/garden.xml") return xml(rss("Garden Letters", "https://garden-letters.example/", 4));
  if (path === "/two/")
    return html(
      page("Quiet Notes", [
        ["All posts", "/feed.xml"],
        ["Comments", "/comments.atom", "application/atom+xml"],
      ]),
    );
  if (path === "/comments.atom") return send("application/atom+xml", atom);
  if (path === "/plain/") return html(page("Just a page", []));
  if (path === "/reading/") return html(page("Reading Room", [["Reading Room", "/reading.xml"]]));
  if (path === "/reading.xml") return xml(reading);
  if (path === "/reading/river.svg") return send("image/svg+xml", RIVER);
  if (path === "/reading/hills.svg") return send("image/svg+xml", HILLS);
  if (path === "/reading/pixel.gif") return send("image/gif", "GIF89a");
  if (path === "/videos/") return html(page("Slow Films", [["Slow Films", "/videos.xml", "application/atom+xml"]]));
  if (path === "/videos.xml") return send("application/atom+xml", videos);
  if (path === "/visits") return send("application/json", JSON.stringify(Object.fromEntries(visits)));

  const shelved = path.match(/^\/shelf\/([a-z-]+)\/(?:([a-z0-9-]+)\/)?(feed\.xml)?$/);
  if (shelved && Object.hasOwn(SHELF, shelved[1])) {
    const [, name, copy, file] = shelved;
    const here = `/shelf/${name}/${copy ? `${copy}/` : ""}`;
    if (file) return xml(shelf(name, `https://${name}.example${here}`));
    return html(page(SHELF[name].title, [[SHELF[name].title, `${here}feed.xml`]]));
  }

  const grow = path.match(/^\/grow\/([a-z0-9-]+)$/);
  if (grow) {
    grown.set(grow[1], (grown.get(grow[1]) ?? 0) + 1);
    return send("text/plain", "One more article.");
  }

  const move = path.match(/^\/move\/([a-z0-9-]+)$/);
  if (move) {
    moved.add(move[1]);
    return send("text/plain", "Moved.");
  }

  const hindi = path.match(/^\/hindi\/([a-z0-9-]+)\/(feed\.xml)?$/);
  if (hindi) {
    const name = hindi[1];
    if (hindi[2]) return xml(kavita(`Kavita ${name}`, `https://${name}.example/`));
    return html(page(`Kavita ${name}`, [[`Kavita ${name}`, `/hindi/${name}/feed.xml`]]));
  }

  const blog = path.match(/^\/blog\/([a-z0-9-]+)\/(feed\.xml|new\.xml|comments\.xml)?$/);
  if (blog) {
    const name = blog[1];
    const home = name.startsWith("moving-") ? `http://${request.headers.host}/blog/${name}/` : `https://${name}.example/`;
    const file = moved.has(name) ? "new.xml" : "feed.xml";
    if (blog[2] === "feed.xml" || blog[2] === "new.xml") {
      if (blog[2] !== file) {
        response.writeHead(404, { "content-type": "text/plain" });
        return response.end("Not found");
      }
      return xml(rss(`Blog ${name}`, home, 3 + (grown.get(name) ?? 0), 3));
    }
    if (blog[2] === "comments.xml") return xml(rss(`Blog ${name}: comments`, `https://${name}.example/comments/`, 1));
    const feeds = [[`Blog ${name}`, `/blog/${name}/${file}`]];
    if (name.startsWith("two-")) feeds.push([`Comments`, `/blog/${name}/comments.xml`]);
    return html(page(`Blog ${name}`, feeds));
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Not found");
}).listen(port, "127.0.0.1");
