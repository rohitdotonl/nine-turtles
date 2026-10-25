# The website and the nineturtles.app domain (for the owner)

nine turtles has two addresses (decision 0066):

- **nineturtles.app**: the website, which tells people what nine turtles is.
  Its pages live in `website/` and are built with Eleventy. GitHub Pages
  hosts it, for free.
- **app.nineturtles.app**: the app itself, still running on Render. The old
  address, slowfeed.onrender.com, keeps working too.

Each one-time step below is yours, because agents never get access to Render
or to where you buy the domain. It takes about 30 minutes, plus waiting for
the domain to be looked up correctly everywhere (usually minutes, at most a
day).

## 1. Buy the domain (10 minutes)

Buy **nineturtles.app** from any domain seller ("registrar"), for example
Cloudflare, Porkbun or Namecheap. Domains ending in `.app` only work over
HTTPS (the padlock), which both GitHub Pages and Render set up for you.

## 2. Switch on GitHub Pages (5 minutes)

1. On GitHub, open the repository → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions** → **Website** → **Run workflow** → **Run workflow**. In a
   minute or two the website is live at GitHub's own address for it.
4. Back in **Settings** → **Pages**, type `nineturtles.app` under **Custom
   domain** and press **Save**.

Recommended, so no one else can ever use your domain on GitHub: on GitHub,
your picture → **Settings** → **Pages** → **Add a domain**, type
`nineturtles.app`, and add the one `TXT` record it shows you in step 3.

## 3. Point the names at the hosts (10 minutes)

In your domain seller's **DNS** settings (the address book that turns
names into computers), add these records. If your seller is Cloudflare, set
each one to **DNS only** (the grey cloud), not "Proxied".

| Type | Name | Value | For |
|---|---|---|---|
| A | `@` (the domain itself) | `185.199.108.153` | the website |
| A | `@` | `185.199.109.153` | the website |
| A | `@` | `185.199.110.153` | the website |
| A | `@` | `185.199.111.153` | the website |
| AAAA | `@` | `2606:50c0:8000::153` | the website |
| AAAA | `@` | `2606:50c0:8001::153` | the website |
| AAAA | `@` | `2606:50c0:8002::153` | the website |
| AAAA | `@` | `2606:50c0:8003::153` | the website |
| CNAME | `www` | `rohitdotonl.github.io` | www.nineturtles.app leads to the website |
| CNAME | `app` | `slowfeed.onrender.com` | the app |

These values are GitHub's and Render's published addresses, nothing private.
If Render shows a different value for `app` in step 4, use Render's.

## 4. Give the app its new address (Render, 5 minutes)

1. In Render, open the nine turtles service → **Settings** → **Custom
   Domains** → **Add Custom Domain**.
2. Type `app.nineturtles.app` and save. Render checks the `app` record from
   step 3 and sets up the padlock itself; it says **Verified** when done.

## 5. Finish up

1. Back in GitHub → **Settings** → **Pages**, once the domain check passes,
   tick **Enforce HTTPS**.
2. Open https://nineturtles.app and https://app.nineturtles.app.
3. At the new app address you sign in once on each device, because a
   browser keeps sign-ins and per-device settings (theme, font, text size)
   for each address separately. Choose them again there. Your feeds, stars,
   reading history and sort order are on the server, so they're all there.
4. On a phone, add the app to the home screen again from the new address,
   and remove the old icon.
5. Tell the agent it's done, so the docs can name the new address.

## How changes go live

- **The website:** an agent changes the pages in `website/`, the checks
  build it and check it in a real browser, and when the pull request is
  merged, GitHub Actions publishes it to GitHub Pages
  (`.github/workflows/website.yml`). The app is not redeployed.
- **The app:** exactly as before: merging deploys it to Render. A merge that
  changes only the website or documents doesn't redeploy the app, so the
  status page's version stays the same.

## Moving the website elsewhere

The built website is plain files (HTML, CSS, fonts), so any host can serve
it: Render's free static sites, Cloudflare Pages, Netlify or your own
server. Build it with `npm ci && npm run build` in `website/` and publish the
`website/_site` folder, then point the domain's records at the new host.
