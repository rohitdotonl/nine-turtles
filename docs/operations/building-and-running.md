# Building and running slowfeed

## What you need

- **Rust** through `rustup` (<https://rustup.rs>). The exact version is in
  `rust-toolchain.toml`; `rustup` installs it on first use.
- **Node** 22.12 or newer (CI uses the version in `.node-version`).
- For the browser checks only: **Chromium**, installed with
  `cd web && npx playwright install chromium`, or an existing copy named in
  the `SLOWFEED_CHROMIUM` setting (its full path).

## Build

```sh
cd web && npm ci && npm run build    # the frontend, into web/dist/
cd ../server && cargo build --release  # the program, with web/dist/ packed inside
```

The result is one file: `server/target/release/slowfeed`.

## Run

```sh
server/target/release/slowfeed
```

It prints `slowfeed is running at http://127.0.0.1:8080`. Open that address
in a browser.

| Setting | Meaning | Default |
|---|---|---|
| `SLOWFEED_LISTEN` | The address and port to listen on. `0.0.0.0:8080` accepts connections from other computers. | `127.0.0.1:8080` (this computer only) |

The full list of settings will live in `settings.md` from Milestone 2.

## Working on the frontend

`cd web && npm run dev` starts Vite's development server, which shows changes
as soon as a file is saved. It serves only the frontend; anything that needs
the server is tested with the built program.

## Check everything

```sh
scripts/check.sh
```

See [checks.md](checks.md).
