// The blog checkup (SPEC section 43, decision 0178). Sends the address typed
// to the app's checkup (app.nineturtles.app/api/checkup), which finds the
// blog's feed as the feed finder does and looks once at its home page and
// one contact or about page, and shows what came back: each check in words,
// and under each one that's missing, the fix, the blog's own platform first.
// No cookies or referrer go with the question, and nothing is stored in the
// browser. Without this script the form still sends the address in the
// page's own address (?address=…), which this script reads when it opens.

const form = document.querySelector(".finder");
const field = form.querySelector("input");
const status = document.querySelector(".finder-status");
const results = document.querySelector(".checkup");
const app = form.dataset.app;
// Each check's number: only the newest one's answer is shown.
let latest = 0;

const problems = {
  "not-an-address": "That doesn't look like a blog's address. Try something like example.com.",
  "not-allowed": "The checkup only looks at public websites.",
  unreachable: "That blog didn't answer. Check the address, or try again later.",
  blocked: "That blog's guard against bots turned the checkup away, and it may turn feed readers away too. The page for publishers on nineturtles.app says how to let them in.",
  "not-found": "That site says the page isn't there. Check the address, or try your blog's home page.",
  "too-big": "That page is too large to look through. Try your blog's home page.",
  busy: "The checkup is busy just now. Try again in a minute.",
  "site-busy": "That blog has been checked a lot just now. Try again in half an hour.",
};

// The platforms whose fixes the page holds; the rest are "your own site".
// Micro.blog has none of its own, so all are shown for it.
const own = { hugo: "own", jekyll: "own", eleventy: "own" };

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const address = field.value.trim();
  if (address === "") {
    say("Type your blog's address first.");
    field.focus();
    return;
  }
  history.replaceState(null, "", `?address=${encodeURIComponent(address)}`);
  check(address);
});

const asked = new URLSearchParams(location.search).get("address");
if (asked) {
  field.value = asked;
  check(asked.trim());
}

async function check(address) {
  const mine = ++latest;
  results.hidden = true;
  say(`Looking at ${address}…`);
  try {
    const response = await fetch(`${app}/api/checkup?address=${encodeURIComponent(address)}`, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    const answer = await response.json().catch(() => ({}));
    if (mine !== latest) return;
    if (response.ok && "feed" in answer) {
      show(answer);
    } else {
      say(problems[answer.error] ?? problems.unreachable);
    }
  } catch {
    if (mine === latest) say("The checkup couldn't be reached. Check your connection and try again.");
  }
}

function show(answer) {
  const platform = own[answer.platform] ?? answer.platform;
  const feed = answer.feed;
  const site = answer.address_on_site;
  const contact = answer.contact_page;

  verdict("feed", Boolean(feed), feed
    ? [`Found at `, code(feed.url), feed.newest ? `. Its newest post is from ${day(feed.newest)}.` : "."]
    : ["No feed was found on that page, on your home page or in the usual places. Feed readers can't follow you yet."], platform);

  verdict("name", Boolean(answer.name), answer.name
    ? [`Your feed names you as ${answer.name}.`]
    : [feed ? "Your feed doesn't name its writer, so readers see only your blog's title." : "With no feed, readers can't see your name."], platform);

  let contactSaid;
  if (contact && site) contactSaid = [`Found `, link(contact), `, and an email address on your site.`];
  else if (contact) contactSaid = [`Found `, link(contact), `. It shows no email address, so readers can use it, but nine turtles' Write back can't fill in your address from it.`];
  else if (site) contactSaid = ["Your home page shows an email address. That's enough; a contact page makes it easier to find."];
  else if (!answer.site_looked) contactSaid = ["Your site didn't answer when the checkup looked for a contact page. Try again in a few minutes."];
  else contactSaid = ["Your home page links no contact or about page, and shows no email address."];
  const unknown = !answer.site_looked && !contact && !site;
  verdict("contact", Boolean(contact || site), contactSaid, platform, unknown ? "Couldn't look." : null);

  let emailSaid;
  if (answer.email_in_feed) emailSaid = [`Your feed gives `, code(answer.email_in_feed), `. A reader's Write back goes straight there.`];
  else if (answer.several_in_feed) emailSaid = ["Your feed's posts give several different addresses, so a reader can't tell whose to use."];
  else emailSaid = [feed ? "Your feed doesn't give an email address." : "With no feed, there's no address in it."];
  verdict("email", Boolean(answer.email_in_feed), emailSaid, platform);

  const reply = answer.reply_in_posts;
  verdict("reply", Boolean(reply), reply
    ? [`Your posts end with a link to write to `, code(reply), `.`]
    : ["Your posts have no Reply by email link. That's fine: it's optional, never required."], platform, reply ? null : "None.");

  const follow = Boolean(feed);
  const write = Boolean(contact || site || answer.email_in_feed || reply);
  say(
    follow && write ? "Readers can follow you and write to you."
    : follow && unknown ? "Readers can follow you. Your site didn't answer, so the checkup couldn't look for a contact page."
    : follow ? "Readers can follow you. A way to write to you is missing."
    : write ? "Readers can write to you, but can't follow you yet: no feed was found."
    : "Readers can't follow you or write to you yet. The fixes are below.",
  );
  results.hidden = false;
}

// One check: "Yes." or "Not yet." in words, what was found, and, when it's
// missing, the fixes: the blog's own platform's first and open, the others
// under "Using something else?".
function verdict(name, yes, said, platform, otherwise) {
  const check = results.querySelector(`[data-check="${name}"]`);
  const line = check.querySelector(".said");
  line.replaceChildren(element("strong", null, yes ? "Yes. " : `${otherwise ?? "Not yet."} `), ...said.map(text));
  const fixes = check.querySelector(".fixes");
  // Nothing to fix when the site couldn't be looked at.
  const fixed = yes || otherwise === "Couldn't look.";
  fixes.hidden = fixed;
  // Put back any earlier answer's order, then sort for this one.
  const all = [...fixes.querySelectorAll(".fix")];
  fixes.replaceChildren(...all);
  const mine = all.find((fix) => fix.dataset.platform === platform) ?? all.find((fix) => fix.dataset.platform === "any");
  if (fixed || !mine) return;
  const others = element("details");
  others.append(element("summary", null, "Using something else?"), ...all.filter((fix) => fix !== mine));
  fixes.replaceChildren(mine, others);
}

function day(seconds) {
  return new Date(seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function code(words) {
  return element("code", null, words);
}

// A link to the writer's own page (always http or https, checked by the app).
function link(href) {
  if (/^https?:\/\//i.test(href)) {
    const anchor = element("a", null, href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""));
    anchor.href = href;
    anchor.rel = "noopener noreferrer";
    anchor.target = "_blank";
    anchor.append(element("span", "sr-only", " (opens in a new tab)"));
    return anchor;
  }
  return code(href);
}

function text(part) {
  return typeof part === "string" ? document.createTextNode(part) : part;
}

function element(name, className, words) {
  const made = document.createElement(name);
  if (className) made.className = className;
  if (words !== undefined) made.textContent = words;
  return made;
}

function say(words) {
  status.textContent = words;
}
