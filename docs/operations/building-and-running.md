# Building and running nine turtles

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

It prints `slowfeed: version … is running at http://127.0.0.1:8080`. Open
that address in a browser. The database is created in a `data` folder where
you started it.

To be able to sign in, give it a password first:

```sh
server/target/release/slowfeed set-password      # prints a line starting $argon2id$
SLOWFEED_PASSWORD_HASH='<that line>' server/target/release/slowfeed
```

(Single quotes matter: the line contains `$` signs.) Every setting is listed
in [settings.md](settings.md).

## Run the container image

```sh
docker build --build-arg SLOWFEED_VERSION=local -t nine turtles .
docker run --rm -p 10000:10000 -v slowfeed-data:/data slowfeed
```

Then open `http://127.0.0.1:10000`. This is exactly what Render runs
(docs/decisions/0011-container-image.md).

## Working on the frontend

`cd web && npm run dev` starts Vite's development server, which shows changes
as soon as a file is saved. It serves only the frontend; anything that needs
the server is tested with the built program.

## Check everything

```sh
scripts/check.sh
```

See [checks.md](checks.md).
