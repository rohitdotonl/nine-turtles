# The website and the nineturtles.app domain (for the owner)

nine turtles has two addresses (decision 0066):

- **nineturtles.app**: the website, which tells people what nine turtles is.
  Its pages live in `website/` and are built with Eleventy. GitHub Pages
  hosts it, for free.
- **app.nineturtles.app**: the app itself, still running on Render. The old
  address, slowfeed.onrender.com, keeps working too.

**Done on 25 October 2026:** the owner followed every step below, so the
website is at nineturtles.app and the app at app.nineturtles.app. The steps
stay here as the record of how it's set up, and for moving again.

Each one-time step below is yours, because agents never get access to Render
or to Cloudflare. It takes about 30 minutes, plus waiting for names to be
looked up correctly everywhere (usually minutes, at most a day).

## Where you start

You own **nineturtles.app** on **Cloudflare**, where its DNS records (the
domain's address book: they turn a name into the computer that answers it)
live. Until this move, nineturtles.app itself leads to the app on Render.
The move gives the app its new address first, and only then hands
nineturtles.app to the website, so the app is never unreachable.

In Cloudflare, every record in this guide is set to **DNS only** (a grey
cloud, with **Proxy status** off), never "Proxied" (an orange cloud).
Proxied would put Cloudflare in between, and GitHub and Render then can't set
up their padlocks. Domains ending in `.app` only work over HTTPS (the
padlock), which GitHub Pages and Render set up for you.

## 1. Give the app its new address (Render and Cloudflare, 10 minutes)

1. In Render, open the nine turtles service → **Settings** → **Custom
   Domains** → **Add Custom Domain**, type `app.nineturtles.app` and save.
   Leave `nineturtles.app` there for now. Render shows the record it
   wants, usually a CNAME to `slowfeed.onrender.com`.
2. In Cloudflare, open **nineturtles.app** → **DNS** → **Records** → **Add
   record**: type **CNAME**, name `app`, target `slowfeed.onrender.com` (or
   what Render showed), **DNS only**. Save.
3. Back in Render, wait until `app.nineturtles.app` says **Verified** and
   its certificate is issued (a few minutes; press **Verify** if it waits).
4. Open https://app.nineturtles.app and sign in. A browser keeps sign-ins
   and per-device settings (theme, font, text size) for each address
   separately, so you sign in once on each device and choose those again.
   Your feeds, stars, reading history and sort order are on the server, so
   they're all there. On a phone, add the app to the home screen again from
   the new address, and remove the old icon.

From here on, use app.nineturtles.app. nineturtles.app still leads to the
app until step 3.

## 2. Switch on GitHub Pages (5 minutes)

1. On GitHub, open the repository → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Under **Custom domain**, type `nineturtles.app` and press **Save**.
   GitHub says the domain isn't pointing at it yet; that's expected until
   step 3.
4. Open **Actions** → **Website** → **Run workflow** → **Run workflow**.
   This run replaces the red cross from the first, automatic try (it failed
   only because Pages wasn't switched on). At GitHub's own address
   (`rohitdotonl.github.io/…`) the page looks unstyled; at nineturtles.app it
   looks right.

Recommended, so no one else can ever use your domain on GitHub: on GitHub,
your picture → **Settings** → **Pages** → **Add a domain**, type
`nineturtles.app`, and add the one `TXT` record it shows you in Cloudflare.

## 3. Hand nineturtles.app to the website (Cloudflare, 10 minutes)

1. In Cloudflare → **nineturtles.app** → **DNS** → **Records**, find the
   records that send `nineturtles.app` and `www` to Render (an A record to a
   Render address such as `216.24.57.1`, or a CNAME to
   `slowfeed.onrender.com`). **Delete them.** Keep the `app` record from
   step 1, and keep any MX or TXT records (they're for email and proofs of
   ownership).
2. Add these records, each **DNS only**:

| Type | Name | Value (Cloudflare calls it IPv4 address, IPv6 address or Target) |
|---|---|---|
| A | `@` (nineturtles.app itself) | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `rohitdotonl.github.io` |

These are GitHub Pages' published addresses, nothing private.

3. In Render → **Settings** → **Custom Domains**, delete `nineturtles.app`
   and `www.nineturtles.app`. Keep `app.nineturtles.app`.

## 4. Finish up

1. In GitHub → **Settings** → **Pages**, once the domain check passes (it
   can take up to an hour), tick **Enforce HTTPS**.
2. Open https://nineturtles.app (the website, with an "Open the app"
   button) and https://app.nineturtles.app (the app).
3. Tell the agent it's done.

## 5. The contact address, hello@nineturtles.app (Cloudflare, 5 minutes)

The website's Contact, Privacy, Terms and Accessibility pages give
**hello@nineturtles.app** as the way to reach you (your choice, 25 October
2026). Cloudflare can forward it to your own inbox for free, so your own
address stays private:

1. In Cloudflare, open **nineturtles.app** → **Email** → **Email Routing**
   and press **Get started** (or **Enable Email Routing**).
2. Under **Destination addresses**, add your own email address. Cloudflare
   sends it a message: press the link in it to confirm.
3. Under **Routing rules** → **Custom addresses**, press **Create
   address**: custom address `hello`, action **Send to an email**,
   destination your own address. Save.
4. Cloudflare offers to add the records email needs (MX and TXT). Press
   **Add records and enable**. They're the only new records, and they
   don't touch the website's or the app's.
5. Send a message to hello@nineturtles.app from another address: it
   arrives in your inbox.

Replies you write go out from your own address. If you'd like them to come
from hello@ too, that needs an email service, which is still to be chosen
(`docs/planning/questions.md`).

## What the website says, and where

Every page is a plain text file in `website/src/`: the home page
(`index.md`), the tour, "New to feeds?", questions (`faq.md`), about,
contact, accessibility, privacy and terms, and the blog's posts in
`website/src/blog/`, one file each. The contact address, the app's address
and the code's address are written once, in `website/src/_data/site.json`.
The pictures of the app in `website/src/images/` were taken from the app's
own screenshot set, which follows only made-up blogs; take new ones when
the app's look changes. The privacy policy and terms are drafts until the
open question in `docs/planning/questions.md` is settled.

## How changes go live

- **The website:** an agent changes the pages in `website/`, the checks
  build it and check it in a real browser, and when the pull request is
  merged, GitHub Actions publishes it to GitHub Pages
  (`.github/workflows/website.yml`).
- **The app:** exactly as before: every merge deploys it to Render, even one
  that changes only the website, so the live app never falls behind.

## Moving the website elsewhere

The built website is plain files (HTML, CSS, fonts), so any host can serve
it: Render's free static sites, Cloudflare Pages, Netlify or your own
server. Build it with `npm ci && npm run build` in `website/` and publish the
`website/_site` folder, then point the domain's records at the new host.
