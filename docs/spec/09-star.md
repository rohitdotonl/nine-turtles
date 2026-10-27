# 9. Star

*Part of the spec ([index](../SPEC.md)). `docs/DESIGN.md` takes precedence.*

**What it does**
- One concept: **Star**. `s` (or the **Star** button in the article's toolbar) stars or unstars the current item. It can be undone like the other marks (section 8).
- Starred items appear in the **Starred** view and are kept forever.
- Stars and collections (section 34) are separate: starring an article never puts it on a collection, and putting it on one never stars it. Both keep it forever.

**How to check it**
1. Star an article: a small star mark appears on its row, and it shows up under Starred.
2. Unstar it: it leaves Starred.
