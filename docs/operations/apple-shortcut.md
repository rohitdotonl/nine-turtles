# The Apple Shortcut "Add to nine turtles"

iPhone and iPad readers follow a site from Safari's Share button with a
ready-made Shortcut (decision 0177). Apple only lets a Shortcut be shared
from a device signed in to iCloud, so the owner makes it once and an agent
puts its iCloud link in `SHORTCUT_LINK` in `web/src/lib/share.ts`. Until
then, Settings › Add from anywhere hides the iPhone row.

## Making it (about five minutes, on the owner's iPhone)

1. Open the **Shortcuts** app and tap **+**.
2. Tap the name at the top, choose **Rename**, and type **Add to nine turtles**.
3. Tap **ⓘ** at the bottom, turn on **Show in Share Sheet**, tap **Done**.
4. In "Receive **Any** input from Share Sheet", tap **Any**, tap **Clear**,
   and tick only **Safari web pages** and **URLs**.
5. Add the action **URL Encode**.
6. Add the action **Text**: type `https://app.nineturtles.app/add?url=` and,
   with no space after it, insert **URL Encoded Text**.
7. Add the action **Open URLs**. Tap **Done**.
8. Try it: in Safari, Share › **Add to nine turtles** on a blog; nine turtles
   asks "Follow …?".
9. Press and hold the shortcut › **Share** › **Copy iCloud Link**, and give
   the link to an agent.

## Putting the link in

Set `SHORTCUT_LINK` to the link, update Help › Follow someone's iPhone line
to "press **Get the Shortcut**…", and adjust the test in
`web/tests/feeds.spec.ts` that expects the row hidden.

## If the app's address changes

The Shortcut has `app.nineturtles.app` written inside it, so it must be made
again and its new link put in.
