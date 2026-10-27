## 27 October 2026: Retry can't be used to hammer a publisher

- Feed health's Retry now asks a publisher at most once every five minutes for each feed, and never re-fetches a working feed checked in the last half hour. Pressing it again sooner just shows how the last try went. Before, every press fetched the feed, so a reader (or a script) could make nine turtles hit someone's site over and over.
