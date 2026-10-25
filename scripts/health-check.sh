#!/usr/bin/env bash
# Is the live nine turtles answering? Asks its status page and fails (exit 1)
# if it doesn't say "nine turtles is running". GitHub Actions runs this every
# 15 minutes (.github/workflows/health-check.yml) and emails the owner when it
# fails; any other scheduler, or a person, can run it the same way.
# What it's for: docs/operations/health-check.md (decision 0075).
#
#   scripts/health-check.sh [address]
#
# The address defaults to https://app.nineturtles.app.
# A deploy restarts the app for a minute or two, so it tries 5 times, a minute
# apart, before saying it's down.

set -uo pipefail

address="${1:-https://app.nineturtles.app}"
address="${address%/}" # "//status" would reach the front page instead
tries="${HEALTH_CHECK_TRIES:-5}"
wait_seconds="${HEALTH_CHECK_WAIT:-60}"

for try in $(seq 1 "$tries"); do
  answer="$(curl -sS --max-time 30 "$address/status" 2>&1)"
  if printf '%s' "$answer" | grep -q '^nine turtles is running'; then
    printf 'nine turtles is answering at %s (%s)\n' \
      "$address" "$(printf '%s' "$answer" | grep '^version' || echo 'no version line')"
    exit 0
  fi
  printf 'Try %s of %s: no proper answer from %s/status\n%s\n' \
    "$try" "$tries" "$address" "$(printf '%s' "$answer" | head -c 300)"
  if [ "$try" -lt "$tries" ]; then sleep "$wait_seconds"; fi
done

echo "nine turtles isn't answering at $address. See docs/operations/health-check.md for what to do."
exit 1
