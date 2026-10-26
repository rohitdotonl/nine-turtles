// The feed finder (SPEC section 30, decision 0099). Sends the address typed
// to the app's finder (app.nineturtles.app/api/find-feeds), which reads the
// page and the first feed it names, and shows what came back. No cookies or
// referrer go with the question, and nothing is stored in the browser.
// Without this script the form still sends the address in the page's own
// address (?address=…), which this script reads when the page opens, so the
// bookmark button works the same way.

const form = document.querySelector(".finder");
const field = form.querySelector("input");
const status = document.querySelector(".finder-status");
const found = document.querySelector(".found");
const app = form.dataset.app;
// Each lookup's number: only the newest one's answer is shown.
let latest = 0;

const problems = {
  "not-an-address": "That doesn't look like a website's address. Try something like example.com.",
  "not-allowed": "The finder only looks at public websites.",
  unreachable: "That site didn't answer. Check the address, or try again later.",
  "not-found": "That site says the page isn't there. Check the address, or try the site's home page.",
  "too-big": "That page is too large to look through. Try the site's home page.",
  "no-feed": "That page doesn't name a feed. Try the site's home page, or look on the site for a link called RSS, Atom or Feed. Some sites don't have one.",
  busy: "The finder is busy just now. Try again in a minute.",
  "site-busy": "That site has been looked up a lot just now. Try again in half an hour.",
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const address = field.value.trim();
  if (address === "") {
    say("Type a website's address first.");
    field.focus();
    return;
  }
  history.replaceState(null, "", `?address=${encodeURIComponent(address)}`);
  look(address);
});

const asked = new URLSearchParams(location.search).get("address");
if (asked) {
  field.value = asked;
  look(asked.trim());
}

async function look(address) {
  const mine = ++latest;
  found.replaceChildren();
  say(`Looking at ${address}…`);
  try {
    const response = await fetch(`${app}/api/find-feeds?address=${encodeURIComponent(address)}`, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    const answer = await response.json().catch(() => ({}));
    if (mine !== latest) return;
    if (response.ok && Array.isArray(answer.feeds)) {
      show(answer);
    } else {
      say(problems[answer.error] ?? problems.unreachable);
    }
  } catch {
    if (mine === latest) say("The finder couldn't be reached. Check your connection and try again.");
  }
}

// The bookmark button does its work on other sites. Pressed here, it says
// how to keep it instead, and its address can be copied for a bookmark made
// by hand (no dragging needed).
const bookmarklet = document.querySelector(".bookmarklet");
bookmarklet.addEventListener("click", (event) => {
  event.preventDefault();
  say("Drag Find feed to your bookmarks bar, or copy its address below into a new bookmark.");
});
const bookmarkAddress = document.querySelector(".bookmark-address");
document.querySelector(".copy-bookmark").addEventListener("click", () => copyAddress(bookmarklet.href, bookmarkAddress));

function show(answer) {
  const count = answer.feeds.length;
  say(count === 1 ? "Found its feed." : `Found ${count} feeds. The first is usually the main one.`);

  const list = element("ul", "feed-list");
  for (const feed of answer.feeds) {
    const item = element("li");
    const address = element("code", "feed-url", feed.url);
    const copy = element("button", "copy", "Copy address");
    copy.type = "button";
    copy.setAttribute("aria-label", `Copy address of ${feed.title}`);
    copy.addEventListener("click", () => copyAddress(feed.url, address));
    item.append(element("span", "feed-title", feed.title), address, copy);
    list.append(item);
  }
  found.append(element("h2", null, count === 1 ? "Its feed" : "Its feeds"), list);

  const preview = answer.preview;
  if (preview && preview.articles.length > 0) {
    const heading = element("h2", null, "Newest in ");
    heading.append(link(preview.site, preview.title));
    const articles = element("ul", "preview");
    for (const article of preview.articles) {
      const item = element("li");
      item.append(link(article.link, article.title || "Untitled"));
      if (article.published) {
        const date = new Date(article.published * 1000);
        const time = element("time", "byline", date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }));
        time.dateTime = date.toISOString();
        item.append(time);
      }
      articles.append(item);
    }
    found.append(heading, articles, element("p", "help", "Each title opens on the publisher's own website."));
  }
}

async function copyAddress(url, shown) {
  try {
    await navigator.clipboard.writeText(url);
    say("Copied the address.");
  } catch {
    // No clipboard here (an older browser, or permission refused): select
    // the address so it can be copied by hand.
    const range = document.createRange();
    range.selectNodeContents(shown);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    say("The address is selected: copy it with your keyboard or menu.");
  }
}

// A link to the publisher's page when the finder passed one on (always
// http or https, checked by the app), otherwise plain words.
function link(href, text) {
  if (typeof href === "string" && /^https?:\/\//i.test(href)) {
    const anchor = element("a", null, text);
    anchor.href = href;
    anchor.rel = "noreferrer";
    return anchor;
  }
  return document.createTextNode(text);
}

function element(name, className, text) {
  const made = document.createElement(name);
  if (className) made.className = className;
  if (text !== undefined) made.textContent = text;
  return made;
}

function say(words) {
  status.textContent = words;
}
