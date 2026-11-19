#!/usr/bin/env bash
# Puts the browser the tests use, and the system pieces it needs, on a
# GitHub Actions computer, quickly (decision 0322).
#
# Playwright's own "install --with-deps" downloads about 30 MB of system
# pieces (fonts and libraries) from Ubuntu's servers on every run, and those
# sometimes crawl at 100 kB/s: one run spent almost 5 minutes on it. Instead,
# the first run downloads them once into BROWSER_DEBS, which the workflow
# remembers (keyed on the computer's image and the web app's libraries), and
# later runs install them from there without asking Ubuntu for anything.
# If that ever fails, it falls back to Playwright's own install, so a run is
# never worse than before.
#
# Usage, from web/ after npm ci: ../.github/install-browser.sh
# Needs: BROWSER_DEBS (a folder the workflow remembers between runs).

set -euo pipefail

: "${BROWSER_DEBS:?Set BROWSER_DEBS to the folder kept between runs}"

# The browser itself (~/.cache/ms-playwright, remembered by the workflow).
npx playwright install chromium

fetch_from_ubuntu() {
  echo "Fetching the browser's system pieces from Ubuntu (kept for next time)."
  mkdir -p "$BROWSER_DEBS/partial"
  # Keep every package apt downloads, in the remembered folder.
  printf 'Dir::Cache::Archives "%s";\nAPT::Keep-Downloaded-Packages "true";\nBinary::apt-get::APT::Keep-Downloaded-Packages "true";\n' \
    "$BROWSER_DEBS" | sudo tee /etc/apt/apt.conf.d/99-nine-turtles-browser >/dev/null
  npx playwright install-deps chromium  # asks for sudo by itself
  sudo rm -f /etc/apt/apt.conf.d/99-nine-turtles-browser
  # Readable by the step that saves the folder for next time.
  sudo chown -R "$(id -u):$(id -g)" "$BROWSER_DEBS"
}

shopt -s nullglob
debs=("$BROWSER_DEBS"/*.deb)
if [ ${#debs[@]} -gt 0 ]; then
  echo "Installing the browser's ${#debs[@]} system pieces from the kept copies."
  if ! sudo apt-get install -y --no-install-recommends "${debs[@]}"; then
    echo "The kept copies didn't install; fetching them again."
    rm -rf "$BROWSER_DEBS"
    fetch_from_ubuntu
  fi
else
  fetch_from_ubuntu
fi
