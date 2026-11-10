## 10 November 2026: Fewer false alarms and less waiting around each change

- A Write back test that sometimes failed though nothing was wrong now waits for its save before moving on. The checks guide says how tests avoid this and other tests' articles.
- Agents now bring in the latest version and go through the reviewer's list themselves before opening a change, are told the moment the checks finish instead of checking on a timer, and check just before merging that no other change has taken their decision number (`node scripts/decisions.mjs --free`).
