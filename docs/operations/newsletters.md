# Newsletters: setting up the mailbox

nine turtles can't receive email itself. Cloudflare, which already looks
after the nineturtles.app domain, receives newsletter emails and passes each
one to nine turtles through a tiny program of ours (decision 0091). This page
is the one-time setup. It takes about 15 minutes, all of it clicking in
Cloudflare's and Render's websites. You don't need to install anything.

**Where things stand (26 October 2026):** both parts are built. Once these
steps are done, each reader finds their own address in Settings ›
Newsletters, and newsletters sent to it arrive as feeds. Mail to an address
nobody has bounces. If you made the forwarder before part three (26 October 2026),
paste its code again (step 2, point 2): the new one bounces email to a label
you switched off, and passes email on to `FORWARD_TO` when nine turtles isn't
taking newsletters.

## The pieces

- **Email Routing** (Cloudflare, free): a mailbox for every address ending
  `@in.nineturtles.app`.
- **The forwarder** (a Cloudflare "Worker", free): the program in
  `cloudflare/newsletter-worker/worker.js`. It posts each email to nine
  turtles.
- **The shared secret:** a long random password the forwarder shows nine
  turtles, so nobody else can post fake emails into it. It's set in two
  places, Render and Cloudflare, and must be the same in both.

## 1. Make the shared secret (Render)

1. Open the Render dashboard → the **slowfeed** service → **Environment**.
2. **Add Environment Variable**: name `NINE_TURTLES_NEWSLETTER_SECRET`,
   then press **Generate** for the value. Save. Render restarts nine turtles
   (about a minute).
3. Copy the value somewhere safe for a moment (you'll paste it in step 3),
   then delete your copy afterwards. Never put it in GitHub or a chat.

nine turtles refuses to start if the secret is shorter than 32 characters,
so a mistyped one shows up straight away (Render's **Events** say so).

## 2. Make the forwarder (Cloudflare Workers)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Create
   Worker** (start from "Hello World"). Name it `nine-turtles-newsletters`
   and press **Deploy**.
2. Press **Edit code**. Delete everything there, paste the whole of
   `cloudflare/newsletter-worker/worker.js` from GitHub, and press
   **Deploy**.

## 3. Give the forwarder its settings

In the Worker → **Settings** → **Variables and Secrets** → **Add**:

| Name | Type | Value |
|---|---|---|
| `NINE_TURTLES_URL` | Text | `https://app.nineturtles.app` |
| `NINE_TURTLES_SECRET` | Secret | the value from step 1 |
| `FORWARD_TO` | Text | your own email address (see step 4) |

Press **Deploy** (or Save) after adding them.

## 4. Let it pass emails on to you (while emails aren't kept yet)

`FORWARD_TO` must be an address Cloudflare has checked is yours:

1. Cloudflare → nineturtles.app → **Email** → **Email Routing** →
   **Destination addresses** → **Add destination address**, and enter your
   email. Cloudflare sends you a message; press its link. (If it's the
   address hello@ already goes to, it's already there.)

You can leave `FORWARD_TO` set, or remove it later. It does no harm: only
emails nine turtles couldn't take for a moment (it was restarting, say) are
passed on. Mail to an address nobody has always bounces instead.

## 5. Receive mail for in.nineturtles.app (Email Routing)

1. Cloudflare → nineturtles.app → **Email** → **Email Routing** →
   **Settings**. Under **Subdomains**, **Add subdomain**: `in`. Cloudflare
   offers to add the records that point mail for `in.nineturtles.app` at
   it; press **Add records**. Your hello@ address is untouched.
2. **Routing rules** → **Catch-all address** → **Edit**: action **Send to a
   Worker**, destination `nine-turtles-newsletters`. Turn it **on** and
   save.

The catch-all means any name before `@in.nineturtles.app` arrives at the
forwarder; nine turtles works out whose it is, and refuses the rest.

## 6. Check it works

1. Open nine turtles → Settings → **Newsletters** and press **Copy** next to
   your address.
2. From your own email, send anything to that address.
3. Within a minute a new feed appears in the sidebar, named after you, with
   your email as its article. That's it working.
4. If nothing arrives, look in Render → the slowfeed service → **Logs**. A
   line saying `…without the right secret` means the secret differs between
   Render and Cloudflare: set both again (step 1, then step 3). No line at
   all means the forwarder couldn't reach nine turtles: check
   `NINE_TURTLES_URL` (Cloudflare → the Worker → **Logs** shows what
   happened).

## Switching it off

Turn off the catch-all rule (step 5): mail to `in.nineturtles.app` stops at
once. Removing `NINE_TURTLES_NEWSLETTER_SECRET` from Render also switches
nine turtles' side off; emails then go to `FORWARD_TO` if it's set, and
bounce if not.

## Moving away from Cloudflare

nine turtles accepts any standard raw email posted to
`/newsletters/incoming` with `Authorization: Bearer <the secret>`. Another
mail service that can post incoming email to a web address (Mailgun,
Postmark, a small mail server) can replace Email Routing and the Worker;
nothing in nine turtles changes.
