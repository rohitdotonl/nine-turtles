## 28 October 2026: One copy of the small helpers

- Behind the scenes, the server had several copies of the same small pieces (turning bytes into text, reading and writing dates, reading web forms). Each now lives in one place, so a fix in one fixes all. Nothing changes in the app, except that a starred-articles file whose dates are written as a plain day (like `2026-10-23`) now keeps those dates on import.
