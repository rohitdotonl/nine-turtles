## 25 October 2026: Signing in by email, and invite links

- The sign-in page has an Email field above Password. You can leave it empty and sign in with your password alone, as before.
- Settings › Readers (only you see it): save your own email to sign in with, and see everyone with an account and when they joined, never what they read.
- Settings › Sign-up (only you): Closed (the default), Invite link, or Open. An invite link lets anyone you send it to make an account, until you make a new link or close sign-up. Open waits for confirmation emails, which come later.
- Wrong passwords are slowed down for each account on its own, so someone guessing another email never makes you wait. Your email and your password alone each get their own five tries, so nobody can find out which email is yours. nine turtles never says whether an email has an account.
- At most 20 sign-ups can be tried in any hour (a try with an email already taken counts too), and they go one at a time.
- Save your own email in Settings › Readers before you send an invite link; Settings reminds you while you have none. The invite in a link comes after a #, so it never reaches any server's logs.
- The database gains two empty columns for emails and passwords (structure change 13), backed up first as always.
