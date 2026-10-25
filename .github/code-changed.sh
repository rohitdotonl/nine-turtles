#!/usr/bin/env bash
# Prints code=true or code=false for GitHub Actions: false when a pull request
# changes only documents, so the slow checks and the image build can be
# skipped (decision 0065). Anything else, including pushes to main, is true.
# docs/libraries.md feeds the library check, so it counts as code.
# Needs the checkout to have its parent commit (fetch-depth: 2).
#
# Usage: code-changed.sh <event name>

set -euo pipefail

code=true
if [ "$1" = pull_request ]; then
  # On a pull request the checkout is GitHub's trial merge, so its first
  # parent is main and the difference is the pull request.
  git diff --no-renames --name-only HEAD^1 HEAD >&2
  others=$(git diff --no-renames --name-only HEAD^1 HEAD \
    | awk '$0 == "docs/libraries.md" || !/^(docs\/.*|[^\/]*)\.md$/')
  if [ -z "$others" ]; then
    code=false
    echo "::notice::Only documents changed, so the slow checks are skipped." >&2
  fi
fi
echo "code=$code"
