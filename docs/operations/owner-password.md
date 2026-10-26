# Getting back in as the owner, without email

Your password normally lives in Render, as `NINE_TURTLES_PASSWORD_HASH`
([render-setup.md](render-setup.md), step 4). Once email is switched on
([email.md](email.md)), you can also choose a new password with
**Forgot your password?** on the sign-in page. That new password is then the
one that works, not the one in Render (decision 0088).

So if you've used Forgot your password? and later:

- email stops working (say, the Brevo key is revoked) and you've forgotten
  the password, or
- you think someone else has set a password for your account,

you can always get back in **without any email**, by putting a new password
in Render. When nine turtles starts and sees that the setting in Render has
changed since you last used an emailed link, the setting wins again.

## Steps (Render, about 5 minutes)

1. Follow [render-setup.md](render-setup.md) step 4 to make a new line with
   `nine-turtles set-password` in Render's **Shell** tab. Choose a password
   you haven't used before.
2. Paste it as the new value of `NINE_TURTLES_PASSWORD_HASH` in
   **Environment**, and press **Save Changes**. Render restarts nine turtles
   (about a minute).
3. Sign in with the new password. What happened:
   - the password you set by email no longer works;
   - every device signed in as you was signed out, so anyone who took over
     your account is out too;
   - the log has a line "NINE_TURTLES_PASSWORD_HASH has changed, so it's the
     owner's password again".
4. Open **Settings › Readers** and check **Your email** is yours. If it
   isn't, type your own and your new password, and press **Save**.

## What doesn't trigger it

- Restarting nine turtles, or changing other settings: your password set by
  email keeps working.
- Removing `NINE_TURTLES_PASSWORD_HASH`, or pasting something that isn't a
  line from `nine-turtles set-password`: nothing changes, so a slip never
  locks you out.
- Pasting back the same line that was in Render before: it has to be a
  newly made line, so make a new one in step 1.
- Readers other than you: this is only for the owner. A reader who forgets
  their password uses Forgot your password?, which needs email.
