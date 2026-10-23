# Protecting main: a step-by-step guide for the owner

**What this does.** It makes GitHub refuse any change to main unless it
comes through a pull request whose automatic checks all passed. Nobody can
save straight to main or rewrite its history, agents included. It's free for
public repositories.

**When to do it.** Once, after the Milestone 1 pull request exists and its
checks have run at least once (GitHub only lets you require a check it has
already seen). Before you merge it.

**Time:** about 5 minutes.

## Steps

1. Open the repository on github.com and click **Settings** (the tab with a
   gear, at the top right of the repository's tabs).
2. In the left-hand list, under **Code and automation**, click **Rules**, then
   **Rulesets**.
3. Click **New ruleset**, then **New branch ruleset**.
4. **Ruleset name:** `Protect main`.
5. **Enforcement status:** choose **Active**.
6. **Bypass list:** leave it empty. (Even you go through pull requests. That's
   the point.)
7. **Target branches:** click **Add target**, choose **Include default
   branch**. It should then show `main`.
8. Under **Branch rules**, tick these:
   - **Restrict deletions** (on by default; keep it).
   - **Require a pull request before merging.** Inside it, set **Required
     approvals** to **0**. You're the only person here, and GitHub doesn't let
     you approve your own pull request, so a required approval could stop
     you from merging. Leave the other boxes inside it unticked.
   - **Require status checks to pass.** Inside it, click **Add checks**, type
     `All checks`, and pick the one that appears (from GitHub Actions).
     Leave the other boxes inside it unticked.
   - **Block force pushes** (on by default; keep it).
9. Leave everything else as it is, and click **Create** at the bottom.

## How to check it worked

- Open the Milestone 1 pull request. Near the bottom it should say **All
  checks** is required.
- Open the deliberately broken pull request the agent made. Its **Merge**
  button should be greyed out, with a message that required checks have
  failed.

## Things to know

- The separate `pr-screenshots` branch is deliberately not protected: GitHub
  Actions saves pull request screenshots there. It's never merged into main.
- If a future change renames the `All checks` check, the ruleset must be
  updated too, or no pull request could be merged. An agent will tell you if
  that's ever needed.
- To switch it off temporarily (for example, to rescue a stuck repository),
  set **Enforcement status** to **Disabled**, and back to **Active** after.
