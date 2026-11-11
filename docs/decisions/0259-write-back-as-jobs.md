# 0259: Write back writes where your email is

**In one line:** Under Write back once pressed, Write in Gmail or Write in Outlook.com opens the same email as a draft there in a new tab and is kept on that device; the address box's way to their site is a link in its line, and its Write back the one solid button; quotes go in curly quotes, not "> "

*11 November 2026.*

Rohit asked for a critique of Write back "as Steve Jobs", keeping the app's
job: to facilitate writing to people, never to become an email app. He chose
all three ideas and the three bug fixes (the bug fixes shipped first, in #359).

**Decision.**

1. **Write in Gmail or Outlook.com.** On a computer, many people's email
   lives in a browser tab, so a `mailto:` link opens nothing, or an email app
   they never set up. The line under Write back, once pressed, now offers
   **Write in Gmail** and **Write in Outlook.com** beside Copy their address.
   One press opens the same email (address, subject, quotes) as a new draft
   there, in a new tab, and keeps the choice on this device (browser
   storage: a phone and a computer often differ). Write in your email app
   goes back. On a touch screen only Copy their address is offered, since a
   phone's email app always answers. nine turtles still never sends or sees
   the email: Gmail's and Outlook.com's own "new email" pages are filled in,
   as the `mailto:` link is. Only these two, the most used web email, so the
   line stays short; anyone else copies the address. While one is chosen, a
   line under the address always says so, with **Use your email app**, so a
   wrong press is never stuck (forgiving). Back from the email app, the
   line's "Opening…" goes but its ways on stay, for an app that opened
   wrong.

   **Not a branded share button** (DESIGN.md → "Never"): that rule keeps
   nine turtles from pushing articles out to platforms ("Share on X"). These
   are plain words, with no logo or brand color, that open the reader's own
   email, the same email the `mailto:` link writes, offered only after the
   email app didn't do it. Rohit chose them from a mockup naming Gmail and
   Outlook.
2. **One thing to do in the address box.** "Find it on their site" was a
   bordered button above the field, as loud as Write back. It's now a link
   at the end of the box's line ("Paste it here, or look on their site."),
   the field has a placeholder, and Write back is the box's one solid button
   (at an article's end the button that opens the box stays outlined,
   decision 0242). "It's saved" moved to the line under the buttons: "It
   sends from your own email, and nine turtles keeps the address for next
   time."
3. **Quote like a letter.** Highlights start the email in curly quotes
   (“…”), each with a blank line after it, instead of "> " at each line's
   start, which reads as code to most people and which Gmail shows as it is.

**Said no to** (the critique's own list): sending from nine turtles, an
inbox, templates or a signature, a link to the article in the email (the
title already says which), remembering who you wrote to, and more places to
press.

**Why.** Facilitate, don't become: each change makes the reader's own email
open, and read, as if nine turtles weren't there.
