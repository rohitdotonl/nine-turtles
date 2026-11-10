## 10 November 2026: Changes made at the same time no longer trip over each other

- Each decision note now says what it decided in one line, under its title, and `node scripts/decisions.mjs` lists them all. Before, nearly every change added a row to one shared table, and two changes made at once clashed there and had to run the checks again.
- The design guide's "Last updated" paragraph, which repeated every decision and was rewritten by every design change, now points to that list. The brand page's list of numbers went the same way.
