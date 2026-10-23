// A made-up publisher for the browser tests: a few blogs with feeds, on this
// computer only. Uses only what comes with Node, so it needs no libraries.
// Every feed and article here is invented (AGENTS.md: test fixtures use
// made-up feeds only).
//
//   /                  Quiet Notes' home page, naming /feed.xml (60 articles)
//   /garden/           Garden Letters' home page, naming /garden.xml
//   /two/              a page naming two feeds, so the reader chooses
//   /plain/            a page naming no feed
//   /blog/NAME/        a home page for a blog called NAME, naming its feed
//                      (and its comments feed too, if NAME starts with
//                      "two-"); tests that add a feed use their own NAME,
//                      so they never meet each other's feeds

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

function rss(title, link, count) {
  const items = Array.from({ length: count }, (_, index) => {
    const number = count - index;
    const date = new Date(NEWEST - index * DAY).toUTCString();
    return `<item><title>${TITLES[index % TITLES.length]} (${number})</title>
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

createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
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

  const blog = path.match(/^\/blog\/([a-z0-9-]+)\/(feed\.xml|comments\.xml)?$/);
  if (blog) {
    const name = blog[1];
    if (blog[2] === "feed.xml") return xml(rss(`Blog ${name}`, `https://${name}.example/`, 3));
    if (blog[2] === "comments.xml") return xml(rss(`Blog ${name}: comments`, `https://${name}.example/comments/`, 1));
    const feeds = [[`Blog ${name}`, `/blog/${name}/feed.xml`]];
    if (name.startsWith("two-")) feeds.push([`Comments`, `/blog/${name}/comments.xml`]);
    return html(page(`Blog ${name}`, feeds));
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Not found");
}).listen(port, "127.0.0.1");
