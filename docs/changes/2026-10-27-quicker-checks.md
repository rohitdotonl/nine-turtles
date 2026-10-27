## 27 October 2026: Quicker, steadier checks

- The checks on each change finish sooner: the Rust tests run several times
  faster, GitHub fetches a much smaller saved build, and the browser tests
  run in four even parts at once instead of two uneven ones.
- Five tests that failed now and then for no real reason (a sign-in wait,
  pressing Tab through a long sidebar, a touch target, a keys test and a
  newsletter test) no longer depend on how fast the computer is or on which
  tests run beside them. Nothing the checks check has changed.
