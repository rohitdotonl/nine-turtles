# Setting up nine turtles on Render (for the owner)

A one-time setup, about 30 minutes. Agents have no access to Render, so these
steps are yours. Each step says what you'll see. If something looks
different, stop and ask an agent; Render's screens change from time to time.

**Before you start:** the Milestone 2 pull request must be merged. Merging
makes GitHub build nine turtles' container image (the ready-to-run package)
and store it. Check it worked: in the repository, the **Actions** tab shows
"Container image" with a green ✓.

## 1. Make the package public (GitHub, 2 minutes)

Render downloads nine turtles' package from GitHub. GitHub stores new packages
privately at first; making it public lets Render download it without a
password. The code is already public, so nothing new is revealed. The package
never contains your password or any settings.

1. On GitHub, open your profile (your picture, top right) → **Your profile**
   → the **Packages** tab → **nine turtles**.
2. **Package settings** (right side) → at the bottom, **Change visibility** →
   **Public** → type `nine-turtles` to confirm.

## 2. Create the web service (Render, 10 minutes)

1. In Render, **+ New** → **Web Service**.
2. Choose **Existing Image** (not "Git Provider": nine turtles is built by
   GitHub, so Render only runs it).
3. **Image URL:** `ghcr.io/rohitdotonl/nine-turtles:latest` → **Connect**.
4. **Name:** `nine-turtles`. It becomes part of your address
   (`slowfeed-xxxx.onrender.com`).
5. **Region:** the one closest to where you usually read. It can't be changed later without moving.
6. **Instance type:** **Starter** ($7/month, 512 MB). The free type can't
   have a disk or the Shell tab.
7. **Environment variables** → **Add Environment Variable**:
   - `NINE_TURTLES_DIAGNOSTICS_KEY`: click **Generate** for the value.
   - Leave the password for step 4.
8. Open **Advanced**:
   - **Disk** → **Add Disk**. Name `slowfeed-data`, **Mount Path** `/data`,
     **Size** `1` GB. This is where your database lives; it survives updates.
   - **Health Check Path:** `/status`.
9. **Deploy Web Service.** After a minute or two the log ends with
   `nine-turtles: version … is running` and the page says **Live**.

**Check it:** open your address (shown at the top, `https://slowfeed-….onrender.com`).
You see the nine turtles sign-in page. Signing in won't work yet: that's step 4.
Adding `/status` to the address shows "nine turtles is running".

## 3. Let merges update the app on their own (5 minutes)

1. In Render, your service → **Settings** → **Deploy Hook** → copy the
   address (it starts `https://api.render.com/deploy/`). Treat it like a
   password: anyone with it can make Render redeploy.
2. On GitHub, the repository → **Settings** → **Secrets and variables** →
   **Actions** → **New repository secret**.
   - **Name:** `RENDER_DEPLOY_HOOK_URL`
   - **Secret:** paste the address → **Add secret**.

From now on, every merged pull request reaches the live app by itself,
usually within 15 minutes of pressing Merge.

## 4. Set your password (Render's Shell tab, 5 minutes)

1. Your service → **Shell** (left menu). A black box opens, connected to the
   running nine turtles.
2. Type `nine-turtles set-password` and press Enter.
3. Type your password (at least 12 characters) and press Enter. **Nothing
   appears while you type**: that's on purpose. Type it again when asked.
   (To give up halfway, press Ctrl+C: nothing is changed.)
4. nine turtles prints one long line starting with `$argon2id$`. That's the
   scrambled form, not your password. Select the whole line and copy it.
5. **Environment** (left menu) → **Add Environment Variable**:
   - **Key:** `NINE_TURTLES_PASSWORD_HASH`
   - **Value:** paste the line.
   - **Save Changes.** Render restarts nine turtles (about a minute).

**Check it (SPEC section 1):**
1. Open your address in a private window: only the password field.
2. Type a wrong password: "That isn't the password." After five wrong tries
   it asks you to wait.
3. Type the right one: you're in, with Status showing the version. Close the
   browser and reopen: still signed in.
4. **Sign out**, reload: back to the password field.
5. Do the same on your phone.

**To change your password later:** repeat step 4 and replace the old value.
Devices already signed in stay signed in.

**If the Shell tab is missing:** stop and tell an agent. The fallback (your
readable password in Render's settings) changes a written rule, so it needs
your go-ahead first.

## 5. Switch on the daily check (5 minutes)

So an agent can look at nine turtles' health once a day, the agents'
environment needs two settings. The current setup is Claude's cloud
environment (settings for the environment this project's agents use):

1. Allow its network to reach your nine turtles address (`slowfeed-….onrender.com`).
2. Add two environment variables: `SLOWFEED_ADDRESS` (your full address,
   starting `https://`) and `NINE_TURTLES_DIAGNOSTICS_KEY` (copy the value from
   Render → Environment).

Then tell an agent it's done; it schedules the check described in
[daily-check.md](daily-check.md).

## If something goes wrong

- **A merge didn't reach the live app** (Settings → Status shows an older
  version): on GitHub, **Actions** → **Container image** → the latest run.
  If "Tell Render to run the new version" failed, copy the deploy hook again
  (step 3) and replace the secret. nine turtles already ignores stray spaces,
  line breaks and quotes in it. Meanwhile, Render → **Manual Deploy** →
  **Deploy latest reference** puts the newest merged version live.
- **The deploy fails, or the page never says Live:** Render → **Logs**.
  Copy the last lines (they never contain your password) and give them to an
  agent.
- **nine turtles keeps asking you to wait, and you're sure of your password:**
  someone may be guessing. Render → your service → **Manual Deploy** →
  **Restart service** clears the wait. Devices already signed in aren't
  affected.
- **The sign-in page says the password setting isn't valid:** the line was
  cut short when pasting. Redo step 4.
- **A bad update reached the live app:** press **Revert** on the merged pull
  request on GitHub and merge the new pull request it creates.
