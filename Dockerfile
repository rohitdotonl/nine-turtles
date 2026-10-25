# Builds nine turtles into a container image: a standard ready-to-run bundle that
# any host accepts. GitHub Actions builds it (.github/workflows/image.yml) and
# Render runs it, so what was tested is exactly what goes live.
# See docs/decisions/0011-container-image.md.

# 1. The frontend, built by Vite into web/dist.
FROM node:24-trixie-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2. The one nine turtles program, with the frontend packed inside it.
FROM rust:1.99.1-slim-trixie AS server
WORKDIR /src
COPY rust-toolchain.toml ./
COPY server/ server/
COPY --from=web /src/web/dist web/dist
# Shown in Settings → Status and on the status page: the build date and commit.
# A build by hand without --build-arg says "local-build".
ARG NINE_TURTLES_VERSION=local-build
ENV NINE_TURTLES_VERSION=${NINE_TURTLES_VERSION}
RUN cd server && cargo build --locked --release

# 3. What runs: a small Linux with only the program on it.
FROM debian:trixie-slim
# The list of trusted certificate authorities, so nine turtles can check it's
# really talking to each publisher's https:// website.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=server /src/server/target/release/nine-turtles /usr/local/bin/nine-turtles
# The old name still works in Render's Shell tab (`slowfeed set-password`).
RUN ln -s nine-turtles /usr/local/bin/slowfeed
# Render sends visitors to port 10000; the database lives on the disk at /data.
# WebSub hubs deliver new articles to the public address (decision 0068).
ENV NINE_TURTLES_LISTEN=0.0.0.0:10000 \
    NINE_TURTLES_DATA_DIR=/data \
    NINE_TURTLES_PUBLIC_URL=https://app.nineturtles.app
EXPOSE 10000
CMD ["nine-turtles"]
