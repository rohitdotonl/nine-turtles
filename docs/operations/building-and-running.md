# Building and running nine turtles

## What you need

- **Rust** through `rustup` (<https://rustup.rs>). The exact version is in
  `rust-toolchain.toml`; `rustup` installs it on first use.
- **OpenSSL's development files and `pkg-config`**, which webauthn-rs (passkey
  sign-in, decision 0109) builds against: `libssl-dev` and `pkg-config` on
  Debian or Ubuntu (GitHub's Ubuntu computers already have them), `openssl`
  from Homebrew on a Mac. The Dockerfile installs them itself.
- **Node** 22.12 or newer (CI uses the version in `.node-version`).
- For the browser checks only: **Chromium**, installed with
  `cd web && npx playwright install chromium`, or an existing copy named in
  the `NINE_TURTLES_CHROMIUM` setting (its full path).

## Build

```sh
cd web && npm ci && npm run build    # the frontend, into web/dist/
cd ../server && cargo build --release  # the program, with web/dist/ packed inside
```

The result is one file: `server/target/release/nine-turtles`.

## Run

```sh
server/target/release/nine-turtles
```

It prints `nine-turtles: version … is running at http://127.0.0.1:8080`. Open
that address in a browser. The database is created in a `data` folder where
you started it.

To be able to sign in, give it a password first:

```sh
server/target/release/nine-turtles set-password      # prints a line starting $argon2id$
NINE_TURTLES_PASSWORD_HASH='<that line>' server/target/release/nine-turtles
```

(Single quotes matter: the line contains `$` signs.) Sign in with any email
and that password: the first sign-in saves the email as the owner's
(decision 0116). Every setting is listed
in [settings.md](settings.md).

## Run the container image

```sh
docker build --build-arg NINE_TURTLES_VERSION=local -t nine-turtles .
docker run --rm -p 10000:10000 -v nine-turtles-data:/data nine-turtles
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

Or one part at a time: `scripts/check.sh frontend`, `scripts/check.sh rust`
or `scripts/check.sh browser`.

See [checks.md](checks.md).
