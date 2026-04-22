# 🐙 04 — Merging, Rebasing & Cherry-Pick

## 📌 1. Merge Strategies

### 🔹 Fast-Forward Merge

```
Before:
  main: A──B
  feat:      ──C──D  (HEAD)

After git merge feature (fast-forward):
  main: A──B──C──D  (no merge commit — linear)
```

```bash
# Default merge (fast-forward if possible, else creates merge commit)
git merge feature/payments

# Force fast-forward only (fail if not possible)
git merge --ff-only feature/payments

# Force a merge commit even if fast-forward is possible
git merge --no-ff feature/payments
```

### 🔹 No-Fast-Forward Merge (Recommended for feature branches)

```
Before:
  main: A──B──E
  feat:      ──C──D

After git merge --no-ff:
  main: A──B──E──M  (M = merge commit preserving branch history)
                /
         C──D──
```

```bash
# Merge with explicit merge commit message
git merge --no-ff feature/payments -m "feat: merge payment gateway feature [JIRA-789]"
```

______________________________________________________________________

## 📌 2. Merge Conflict Resolution

```bash
# When a merge hits conflicts:
git merge feature/payments
# Auto-merging src/config.js
# CONFLICT (content): Merge conflict in src/config.js
# Automatic merge failed; fix conflicts and then commit the result.

# See which files have conflicts
git status
git diff --name-only --diff-filter=U    # U = unmerged

# The conflict markers inside the file:
<<<<<<< HEAD
  const PAYMENT_TIMEOUT = 3000;    # your change
=======
  const PAYMENT_TIMEOUT = 5000;    # incoming change
>>>>>>> feature/payments

# After manually editing the file to resolve:
git add src/config.js

# Complete the merge
git commit                          # editor opens with merge commit message
git commit --no-edit                # accept default message

# Abort the merge (return to pre-merge state)
git merge --abort
```

### 🔹 Using a Merge Tool

```bash
# Configure your merge tool
git config --global merge.tool vimdiff
git config --global merge.tool vscode

# For VSCode:
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'

# Launch merge tool
git mergetool

# After resolving, clean up .orig files
git clean -f *.orig
```

### 🔹 Real-Time Scenario: Merge conflict in a Helm values file

```bash
git merge release/2.4.0
# CONFLICT: helm/values-prod.yaml

# View the conflict
cat helm/values-prod.yaml

# Edit to keep correct image tag and replica count
# <<<<<<< HEAD
#   replicaCount: 3
#   image: myapp:2.3.1
# =======
#   replicaCount: 2
#   image: myapp:2.4.0
# >>>>>>> release/2.4.0
#
# Resolution: keep replicaCount from HEAD (prod scale), take new image tag

git add helm/values-prod.yaml
git commit -m "chore: resolve merge conflict in helm values — keep prod replica count, take 2.4.0 image"
```

______________________________________________________________________

## 📌 3. Rebase

### 🔹 What is Rebase?

Rebase re-applies your commits on top of another branch's tip, giving a **linear history**.

```
Before:
  main: A──B──C
  feat: A──B──X──Y

git rebase main (from feat branch):
  main: A──B──C
  feat: A──B──C──X'──Y'  (X and Y are replayed as new commits X', Y')
```

```bash
# Rebase current branch onto main
git rebase main
git rebase origin/main         # rebase onto remote main

# Rebase a specific branch onto main
git rebase main feature/payments

# Abort a rebase in progress
git rebase --abort

# Continue after resolving conflicts
git add <resolved-file>
git rebase --continue

# Skip a conflicting commit (use sparingly)
git rebase --skip
```

### 🔹 Interactive Rebase (Clean up commits before PR)

```bash
# Squash, reorder, edit last 4 commits
git rebase -i HEAD~4

# Editor opens with:
pick a3f1c9b feat: add stripe client
pick 7d2e8fa fix: typo in error message
pick 1a2b3c4 wip: working on webhook
pick 9e8f7d6 test: add webhook tests

# Change to:
pick a3f1c9b feat: add stripe client
squash 7d2e8fa fix: typo in error message
squash 1a2b3c4 wip: working on webhook
squash 9e8f7d6 test: add webhook tests
# → Squashes last 4 into one clean commit

# Interactive rebase verbs:
# pick    = use commit as-is
# reword  = use commit but edit message
# squash  = merge into previous commit (combines messages)
# fixup   = merge into previous commit (discards message)
# drop    = delete the commit
# edit    = pause to amend the commit
```

### 🔹 Real-Time Scenario: Preparing a clean PR

```bash
# You have 6 WIP commits on your feature branch
git log --oneline HEAD~6..HEAD
# e1f2a3b WIP
# d4c5b6a still working
# a7b8c9d added test
# f0e1d2c fixed lint
# b3a4c5d feat: add 2FA support
# 9c8d7e6 initial 2FA scaffold

# Squash into 2 meaningful commits
git rebase -i HEAD~6

# Result:
# pick 9c8d7e6 feat: add TOTP-based 2FA support
# pick a7b8c9d test: add 2FA unit and integration tests

git push --force-with-lease origin feature/JIRA-789-add-2fa
```

______________________________________________________________________

## 📌 4. Cherry-Pick

Cherry-pick applies a specific commit from one branch to another.

```bash
# Apply a single commit to current branch
git cherry-pick a3f1c9b

# Apply multiple commits
git cherry-pick a3f1c9b 7d2e8fa 1a2b3c4

# Apply a range of commits (exclusive..inclusive)
git cherry-pick a3f1c9b..9e8f7d6

# Cherry-pick without committing (stage only)
git cherry-pick -n a3f1c9b

# Cherry-pick and edit the commit message
git cherry-pick -e a3f1c9b

# Continue after resolving conflicts
git cherry-pick --continue

# Abort
git cherry-pick --abort
```

### 🔹 Real-Time Scenario: Backporting a security fix to an older release

```bash
# A critical security fix was committed to main as commit a3f1c9b
# We need to backport it to release/2.3.x (currently maintained)

git switch release/2.3.x
git pull --rebase origin release/2.3.x

# Cherry-pick the fix
git cherry-pick a3f1c9b
# If conflict — resolve then: git cherry-pick --continue

git push origin release/2.3.x

# Tag the patched release
git tag -a v2.3.2 -m "Security patch: CVE-2024-1234 backport"
git push origin v2.3.2
```

### 🔹 Real-Time Scenario: Pulling a fix from develop to main without full merge

```bash
# Specific bug fix on develop: commit hash b9f3d2a
git log develop --oneline | grep "fix: payment timeout"
# b9f3d2a fix: payment timeout handling in checkout flow

git switch main
git cherry-pick b9f3d2a
git push origin main
```

______________________________________________________________________

## 📌 5. Squash Merge (GitHub/GitLab PR Strategy)

```bash
# Squash all commits from feature branch into one on main
git merge --squash feature/payments
git commit -m "feat: complete payment gateway integration [JIRA-789]"

# This is what GitHub "Squash and merge" button does
```

______________________________________________________________________

## 📌 6. Octopus Merge (Multiple branches at once)

```bash
# Merge multiple feature branches simultaneously (rare but valid)
git merge feature/auth feature/payments feature/notifications
# Git attempts a 3-way merge across all — fails if conflicts
```

______________________________________________________________________

## 📌 7. Merge vs Rebase Decision Guide

| Scenario | Recommendation |
|----------|---------------|
| Feature branch → main (team collab) | `--no-ff merge` or squash merge |
| Syncing feature branch with main updates | `rebase origin/main` |
| Shared/public branch | **Never rebase** — use merge |
| Personal feature branch (not shared) | Rebase freely |
| Hotfix on production | `--no-ff merge` + tag |
| Open source PR | Squash or rebase |
| CI pipeline sync | `pull --rebase` |

### 🔹 The Golden Rule of Rebase

> **Never rebase a branch that others are working on.** Rebase rewrites commit hashes, which causes diverged history for any teammate who has the old commits.

______________________________________________________________________

## 📌 8. Real-Time Scenario: Resolving a complex 3-way conflict in a microservice

```bash
# main has been updated 15 commits ahead while feature was being developed
git fetch origin
git rebase origin/main

# Conflict in src/services/payment.js
# Open file, look for <<<<<<< markers
# Use VS Code / IntelliJ merge tool for complex files

git add src/services/payment.js
git rebase --continue

# Another conflict in package.json (two devs added different packages)
# Edit package.json manually — keep both dependencies
git add package.json
git rebase --continue

# Rebase complete — force push
git push --force-with-lease origin feature/JIRA-789
```

______________________________________________________________________

## 📌 Summary Table

| Command | Purpose |
|---------|---------|
| `git merge --no-ff` | Merge with explicit merge commit |
| `git merge --abort` | Cancel in-progress merge |
| `git rebase main` | Replay commits on top of main |
| `git rebase -i HEAD~N` | Interactive rebase — squash/edit |
| `git rebase --continue` | Continue after conflict resolve |
| `git cherry-pick <hash>` | Apply specific commit to branch |
| `git cherry-pick --abort` | Cancel cherry-pick |
| `git merge --squash` | Flatten branch into one commit |
| `git mergetool` | Launch visual merge tool |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
