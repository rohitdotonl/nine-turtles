# 0175: Pick up where you left off

*4 November 2026. Step 13 of the owner's review plan, approved by Rohit on
3 November. The words and where the line sits were decided in the owner's
review thread.*

**Why.** Each article already keeps its own place on each device (decision
0060), but coming back to nine turtles you had to remember what you were in
the middle of, and a phone never knew where the laptop left off.

**Decision.**

- **One article, kept on the server:** the latest one the reader left part of
  the way through, with its place (block and how far into it), in a
  `person_settings` row named `resume`. No structure change. Each device's
  own places for every article stay as they were, in the browser.
- **The line:** in the empty reading area, in place of "Time to read
  something beautiful.", the same muted serif reads "You were reading
  {title}, by {writer}." The title is the link, underlined in the text color,
  never the accent. The writer is the name the reader gave the person, else
  the article's author; with neither, the title alone. With no reading area
  (a phone), the same line sits at the top of the list.
- **It goes** once an article opens (a person's page or Settings leave it be). Opening a different article, finishing
  this one or scrolling it back to its top lets the place go for every
  device. A muted article, or one of a feed the reader left, isn't offered.
- **The newest place wins:** every place a device keeps is also sent to the server (a moment after scrolling stops, one request after another so they arrive in order), so the server's place replaces a device's older one for that article.
- **It never waits long:** if the server hasn't answered within 1.5 seconds, the usual line shows, and a late answer doesn't replace it.
- **Never** a pop-up, a count or a notification, and nothing is said when
  the server can't be reached: the line simply isn't offered.
