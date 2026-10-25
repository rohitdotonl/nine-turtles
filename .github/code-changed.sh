#!/usr/bin/env bash
# Tells GitHub Actions what a change touches, so it runs only the checks and
# deploys that can matter (decisions 0065, 0066). Prints two lines:
#   code=false  only documents changed: every check and deploy is skipped.
#   app=false   only documents and the website (website/) changed: the app's
#               checks, its image build and its deploy to Render are skipped.
# Anything that can't be worked out counts as changed (true).
# docs/libraries.md feeds the library check, so it counts as code.
#
# Usage: code-changed.sh <event name> [commit before a push to main]
# Needs the checkout to have its parent commit (fetch-depth: 2).

set -euo pipefail

changed=""
if [ "$1" = pull_request ]; then
  # On a pull request the checkout is GitHub's trial merge, so its first
  # parent is main and the difference is the pull request.
  changed=$(git diff --no-renames --name-only HEAD^1 HEAD)
elif [ "$1" = push ] && [ -n "${2:-}" ] && [ "${2:-}" != 0000000000000000000000000000000000000000 ]; then
  # On main: everything since the last push, which may be several commits.
  if git fetch --quiet --depth=1 origin "$2" 2>/dev/null; then
    changed=$(git diff --no-renames --name-only "$2" HEAD)
  fi
fi

code=true
app=true
if [ -n "$changed" ]; then
  echo "$changed" >&2
  documents='$0 == "docs/libraries.md" || !/^(docs\/.*|[^\/]*)\.md$/'
  if [ -z "$(echo "$changed" | awk "$documents")" ]; then
    code=false
    echo "::notice::Only documents changed, so the slow checks are skipped." >&2
  fi
  if [ -z "$(echo "$changed" | awk "$documents" | grep -v '^website/' || true)" ]; then
    app=false
    echo "::notice::Only documents and the website changed, so the app's checks and deploy are skipped." >&2
  fi
fi
echo "code=$code"
echo "app=$app"
