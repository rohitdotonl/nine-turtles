# Sending email

nine turtles sends a few short emails (decision 0088): the link that signs
in, which **Forgot?** on the sign-in page sends and after which the reader
may choose a new password (decision 0121), and the link that confirms a
changed address. (The older "A new password for nine turtles" link is no
longer offered on the sign-in page; one already sent still works.) Without email, none of these work. Signing up needs no email
(decision 0115). This page sets it up with **Brevo**. Any other email
service that offers "SMTP" works the same way: only the five settings change.

You'll need: your Brevo account, Cloudflare (where nineturtles.app's
addresses are kept), and Render. About 20 minutes, plus up to a day for
Brevo to see the new DNS records.

## 1. Get Brevo's SMTP details

1. Sign in to Brevo.
2. Open the menu under your name (top right) → **SMTP & API**.
3. Choose the **SMTP** tab. It shows:
   - **SMTP server:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Login:** an address that ends in `@smtp-brevo.com`
4. Press **Generate a new SMTP key**, name it `nine turtles`, and copy the
   key it shows. It's shown once: keep it until step 3. It's a secret, like
   a password: never put it in GitHub or a chat.

## 2. Let Brevo send as nineturtles.app

So emails come from `hello@nineturtles.app` and aren't treated as spam:

1. In Brevo, open **Senders, Domains & Dedicated IPs** → **Domains** →
   **Add a domain**, and type `nineturtles.app`.
2. Brevo lists a few **DNS records** (lines to add to the domain's address
   book): usually a code to prove it's yours, DKIM and DMARC. Keep the page
   open.
3. In Cloudflare, open **nineturtles.app** → **DNS** → **Records**. For each
   line Brevo lists, press **Add record** and copy its **Type**, **Name** and
   **Value** exactly. Leave the cloud grey (**DNS only**).
4. Back in Brevo, press **Verify** (or **Authenticate this email domain**).
   If it isn't green yet, try again later: Cloudflare's records can take a
   while to be seen.
5. In **Senders**, add `hello@nineturtles.app` as a sender, with the name
   `nine turtles`.
6. nine turtles' emails never track anyone. If Brevo's transactional
   settings offer link or open tracking, switch them off.

## 3. Give nine turtles the five settings

In Render, open the nine turtles service → **Environment** → **Edit**, and
add:

| Name | Value |
|---|---|
| `NINE_TURTLES_SMTP_HOST` | `smtp-relay.brevo.com` |
| `NINE_TURTLES_SMTP_PORT` | `587` |
| `NINE_TURTLES_SMTP_USERNAME` | the **Login** from step 1 |
| `NINE_TURTLES_SMTP_PASSWORD` | the **SMTP key** from step 1 |
| `NINE_TURTLES_SMTP_FROM` | `nine turtles <hello@nineturtles.app>` |

Press **Save Changes**. Render restarts nine turtles (about a minute).
`NINE_TURTLES_PUBLIC_URL` must be set too (the container image sets it), as
every link starts with it: with the email settings but without it, nine
turtles doesn't start, and the log says so.

## 4. Check it works

1. Open nine turtles in a private window. The sign-in page now shows a
   small **Forgot?** beside Password.
2. Press it, type your own email (the one in Settings › Readers) and press
   **Email me a link**. An email "Sign in to nine turtles" arrives in a
   minute or two, with a link that signs you in once, within 15 minutes.
   You don't have to use the link: your password stays as it is until you do.
3. Open the link and press **Sign in**. You can then choose a new password,
   or press **Not now** to keep the one you have.

If no email arrives, look in Render's **Logs** for "couldn't send": the line
says roughly what went wrong ("the mail server refused it", "couldn't be
reached or signed in to": a mistyped key, for example), never the address it
was going to. If only some settings are set (the port alone counts), nine
turtles doesn't start, and the log names the missing ones.

## If email stops working and you've forgotten your password

Once you've set a new password with an emailed link, that password is the
one that works, not the one in Render. If email later breaks and you forget
it, you don't need email to get back in: see
[owner-password.md](owner-password.md).

## Moving to another email service

Get that service's SMTP server, port, login and key, change the four
settings in Render, and authenticate the domain there instead. Nothing else
changes.
