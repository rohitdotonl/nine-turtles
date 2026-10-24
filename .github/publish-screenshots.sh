#!/usr/bin/env bash
# Saves a pull request's screenshots on the `pr-screenshots` side branch and
# shows them in one comment on the pull request, updated on every push
# (docs/decisions/0005-screenshots.md). Runs inside GitHub Actions.
#
# The side branch is always a single commit holding only the latest pictures
# of each pull request. It is replaced (force-pushed) every time, so old
# pictures don't pile up in the repository's history.
#
# Usage: publish-screenshots.sh <folder of .png files>
# Needs: GH_TOKEN, PR_NUMBER, HEAD_SHA, GITHUB_REPOSITORY.

set -euo pipefail

source_dir=$(realpath "$1")
branch=pr-screenshots
short_sha=${HEAD_SHA:0:7}
folder="pr-$PR_NUMBER/$short_sha"
marker="<!-- slowfeed-screenshots -->"

shopt -s nullglob
pictures=("$source_dir"/*.png)
if [ ${#pictures[@]} -eq 0 ]; then
  echo "No screenshots were taken (the checks probably stopped early)."
  exit 0
fi

# Start from the side branch's current pictures (other pull requests' too),
# replace this pull request's, and save the result as one fresh commit.
store=$(mktemp -d)
git -C "$store" init --quiet
git -C "$store" remote add origin "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
if git -C "$store" fetch --quiet --depth 1 origin "$branch"; then
  git -C "$store" checkout --quiet FETCH_HEAD
fi
git -C "$store" checkout --quiet --orphan "fresh-$PR_NUMBER"
printf '# Screenshots\n\nPictures posted on pull requests by the checks. Not part of slowfeed.\n' > "$store/README.md"
rm -rf "${store:?}/pr-$PR_NUMBER"
mkdir -p "$store/$folder"
cp "${pictures[@]}" "$store/$folder/"
git -C "$store" add -A
git -C "$store" -c user.name="slowfeed checks" -c user.email="checks@users.noreply.github.com" \
  commit --quiet -m "Latest screenshots of each pull request"
git -C "$store" push --quiet --force origin "HEAD:refs/heads/$branch"

# Build the comment: one row per screen and theme, desktop and phone side by side.
base="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${branch}/${folder}"
{
  echo "$marker"
  echo "### Screenshots"
  echo
  echo "Every screen in off-white, sepia and dark (the other themes on the list, article, Settings and Edit feed screens), as of commit $short_sha."
  echo
  echo "| Screen and theme | Desktop | Phone |"
  echo "|---|---|---|"
  for desktop in "$source_dir"/*-desktop.png; do
    name=$(basename "$desktop" -desktop.png)
    echo "| $name | <img src=\"$base/$name-desktop.png\" width=\"400\" alt=\"$name, desktop\"> | <img src=\"$base/$name-phone.png\" width=\"160\" alt=\"$name, phone\"> |"
  done
} > comment.md

existing=$(gh api "repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" --paginate \
  --jq ".[] | select(.body | startswith(\"$marker\")) | .id" | head -n 1)
if [ -n "$existing" ]; then
  gh api --method PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/$existing" -F body=@comment.md >/dev/null
else
  gh pr comment "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" --body-file comment.md
fi
echo "Posted ${#pictures[@]} screenshots."
