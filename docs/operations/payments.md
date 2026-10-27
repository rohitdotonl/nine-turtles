# Payments: switching on Dodo's test mode

*Written 26 October 2026 (decision 0094). For the owner, step by step. You
never paste a key into a chat or into GitHub: keys go only into Render.*

**What this does:** lets you try paying for nine turtles with Dodo's **test
mode**, where no real money moves. Until you do these steps, payments are
simply off: nobody pays and nothing is limited.

**What you'll need:** about 20 minutes, and a Dodo Payments account. Test
mode works without Dodo's approval; you don't need your ID or bank yet.

## 1. Make a Dodo account and switch to test mode

1. Go to [app.dodopayments.com](https://app.dodopayments.com) and sign up
   with your email.
2. In the dashboard, find the switch between **Test mode** and **Live
   mode** (usually at the top). Make sure it says **Test mode**. Everything
   below is done in test mode.

## 2. Make the product (the plan)

1. Go to **Products** and press **Create product** (or Add product).
2. Name: `nine turtles`. Description: the one from
   `dodo-application.md` ("nine turtles is a calm reading app…").
3. Choose **Subscription** (not one-time), billed **monthly**, at any test
   price, for example 5 US dollars. (The real price is decided later; this
   is only for trying.)
4. Save it. Dodo shows the product's **ID**, starting `pdt_`. Copy it
   somewhere private for a minute (a note on your computer, not a chat).
5. Optional: make a second product the same way, billed **yearly**, and
   copy its ID too.

## 3. Make an API key

1. Go to **Developer** › **API Keys** (or Settings › API Keys).
2. Press **Add API key** (or Create), name it `nine turtles on Render`.
3. Copy the key Dodo shows. It is shown only once.

## 4. Tell Dodo where to send its messages (the webhook)

1. Go to **Developer** › **Webhooks** and press **Add endpoint**.
2. Address (URL): `https://app.nineturtles.app/payments/dodo`
3. Events: choose all the **subscription** events (or all events; nine
   turtles ignores the ones it doesn't need).
4. Save. Open the endpoint and copy its **Signing secret**, which starts
   `whsec_`.
5. Still in Dodo, under **Settings** › **Customer portal** (if you see it),
   turn on letting customers cancel.

## 5. Put the settings into Render

1. Open [dashboard.render.com](https://dashboard.render.com), the
   **slowfeed** service, then **Environment**.
2. Press **Add Environment Variable** for each of these, pasting each value
   from Dodo:

   | Key | Value |
   |---|---|
   | `NINE_TURTLES_DODO_API_KEY` | the API key from step 3 |
   | `NINE_TURTLES_DODO_WEBHOOK_SECRET` | the signing secret from step 4 (starts `whsec_`) |
   | `NINE_TURTLES_DODO_MONTHLY_PRODUCT` | the monthly product's ID (starts `pdt_`) |
   | `NINE_TURTLES_DODO_YEARLY_PRODUCT` | the yearly product's ID, only if you made one |
   | `NINE_TURTLES_PRICE_MONTHLY` | how the price reads in Settings, e.g. `$5 a month` (optional) |
   | `NINE_TURTLES_PRICE_YEARLY` | e.g. `$50 a year` (optional) |

   Leave out `NINE_TURTLES_DODO_MODE`: without it nine turtles stays in
   test mode. `NINE_TURTLES_PUBLIC_URL` must already be set (it is, for
   email).
3. Press **Save, rebuild and deploy**. When it's live, delete the note
   where you kept the keys.

## 6. Try it

1. Open nine turtles in a private window, press **Sign up** and sign up
   as a test reader.
2. In that window, Settings › **Your plan** says "Free trial".
3. Press **Monthly**. Dodo's test checkout opens. Card number
   `4242 4242 4242 4242`, any future date, any three digits, any name.
4. You come back to Settings › Your plan. Within a minute it says "Monthly plan" and
   when it renews. Your own Readers page shows "Monthly plan" under that
   reader.
5. Press **Billing and cancelling**, cancel, and come back: it says
   "Cancelled. It lasts until …".
6. Delete that test reader's account when you're done (Settings › Account
   › Delete account…).

If something doesn't work, the Readers page's problems list shows what nine
turtles noticed (for example "a payment message arrived without Dodo's
signature", which means the signing secret doesn't match).

## Later: live payments

Only after Dodo approves the live site (`dodo-application.md`). Then make
the same product, API key and webhook again in **live mode**, replace the
three Dodo settings in Render with the live ones, and add
`NINE_TURTLES_DODO_MODE` = `live`. Never pay with a real card to test
(Dodo suspends accounts for it); use a 100% discount code instead.

## The settings, for reference

All of them are in [settings.md](settings.md). The first three go
together: some but not all stops nine turtles with a message naming the
missing ones.
