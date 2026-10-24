# 0058: nine turtles everywhere, with the old names still working

*24 October 2026. The owner's request: change the name completely,
everywhere. Changes 0056, which kept slowfeed behind the scenes.*

**Why.** 0056 changed only what readers see. The owner wants one name
throughout: the repository, the package, the program and its settings.

**What changed.**

- The repository is `rohitdotonl/nine-turtles` and the container image
  `ghcr.io/rohitdotonl/nine-turtles` (the owner renamed the repository).
- The program is `nine-turtles` (`nine-turtles set-password`), its settings
  are `NINE_TURTLES_*`, its database file `nine-turtles.sqlite`, its sign-in
  cookie `nine_turtles_session`, its version header `x-nine-turtles-version`,
  and the browser keeps preferences under `nine-turtles.*`. Starred exports
  carry `_nine_turtles`.
- **Nothing breaks on the way.** Each `NINE_TURTLES_*` setting falls back to
  its `SLOWFEED_*` name; a `slowfeed.sqlite` is renamed (with its `-wal` and
  `-shm` files) the first time the program starts; the old cookie still
  signs you in; old saved preferences and open folders are read when nothing
  is saved under the new name; the server also sends the old version header;
  the image keeps a `slowfeed` command.
- **What keeps the old name.** Render's address (slowfeed.onrender.com) is
  fixed when a service is made; a new one would mean a new service or the
  owner's own domain. The disk stays `slowfeed-data` (renaming it means a
  new, empty disk). The daily check's own `SLOWFEED_ADDRESS` and
  `SLOWFEED_DIAGNOSTICS_KEY` stay as its routine has them.

**Later.** Once Render uses only `NINE_TURTLES_*` names, the fallbacks can go.
