# 0091: The Readers page shows the day each reader was last here

*26 October 2026. The owner answered the open question from decision 0090:
"Should the Readers page show when each reader last visited? Yes."*

**Decision.**

- **Each reader's row on the Readers page says "Last here today" or "Last
  here 24 October 2026"**, in the muted grey under "Joined … · … feeds".
  Only the day, never a time.
- **Nothing new is recorded.** It's the same *last here* nine turtles
  already keeps to decide whether a reader's feeds rest (decision 0090):
  the latest of when they joined, when one of their devices was last used,
  and when they last signed in, opened nine turtles or synced from another
  app. Each of those is noted at most once every 24 hours, so it costs no
  extra writes, and the day shown can be one behind: a reader noted at
  8 pm who comes back at 9 the next morning still shows the day before. No structure change, so no backup was needed.
- **Readers are told.** Every reader but the owner sees, under Account in
  Settings: "Whoever runs this nine turtles can see your email, when you
  joined, how many feeds you follow and the day you were last here. Never
  which feeds or what you read." The website's privacy policy lists it too.

**Why.** It tells the owner whether a tester has tried nine turtles yet,
without saying anything about what anyone reads. A day is enough for that,
and a day behind at worst doesn't change the answer.
