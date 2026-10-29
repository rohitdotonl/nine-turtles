## 29 October 2026: A check that keeps the code tidy

- Behind the scenes, a new automatic check, "Code stays tidy", runs on every change to the app. It fails if a file of the app's code grows past 800 lines (the few files that are already longer may only get shorter), or if a piece of code is no longer used by anything.
- It found two small unused leftovers, which are gone: a way to list keyboard shortcuts that weren't built yet (all of them are now), and an unused name in a test.
- Nothing looks or works differently.
