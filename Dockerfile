# Builds slowfeed into a container image: a standard ready-to-run bundle that
# any host accepts. GitHub Actions builds it (.github/workflows/image.yml) and
# Render runs it, so what was tested is exactly what goes live.
# See docs/decisions/0010-container-image.md.

# 1. The frontend, built by Vite into web/dist.
FROM node:24-trixie-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2. The one slowfeed program, with the frontend packed inside it.
FROM rust:1.99.1-slim-trixie AS server
WORKDIR /src
COPY rust-toolchain.toml ./
COPY server/ server/
COPY --from=web /src/web/dist web/dist
# Shown in Settings → Status and on the status page: the build date and commit.
ARG SLOWFEED_VERSION
ENV SLOWFEED_VERSION=${SLOWFEED_VERSION}
RUN cd server && cargo build --locked --release

# 3. What runs: a small Linux with only the program on it.
FROM debian:trixie-slim
COPY --from=server /src/server/target/release/slowfeed /usr/local/bin/slowfeed
# Render sends visitors to port 10000; the database lives on the disk at /data.
ENV SLOWFEED_LISTEN=0.0.0.0:10000 \
    SLOWFEED_DATA_DIR=/data
EXPOSE 10000
CMD ["slowfeed"]
