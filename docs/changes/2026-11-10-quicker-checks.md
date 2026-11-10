## 10 November 2026: The checks finish sooner

- The browser tests run in six parts at once instead of four, so the slowest part no longer holds up every change for about 5 minutes.
- The browser those tests use is kept between runs instead of downloaded each time, which sometimes took over 3 minutes.
- A keyboard test that failed about one run in ten, for no real reason, is steady: it no longer mistakes the sidebar redrawing for having gone all the way round.
