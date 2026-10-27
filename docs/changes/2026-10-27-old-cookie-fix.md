## 27 October 2026: Signing in works again on devices from before the rename

- A device first signed in back when the app was called slowfeed could get stuck: after signing out, the reader signed in again and landed straight back on the sign-in page. The browser kept sending the old, dead sign-in ticket first. Now the new one always wins, and signing out or deleting an account clears both.
