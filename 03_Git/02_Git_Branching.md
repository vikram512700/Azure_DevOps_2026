# 02 — Git Branching

## 1. Understanding Branches

A branch is a lightweight movable pointer to a commit. `HEAD` is a special pointer that tells Git which branch you're currently on.

```
main    ──o──o──o──o
                   \
feature             o──o──o  (HEAD)
```

______________________________________________________________________

## 2. Creating and Switching Branches

```bash
# List local branches (* = current)
git branch

# List remote branches
git branch -r

# List all branches (local + remote)
git branch -a

# Create a new branch (stays on current branch)
git branch feature/add-login

# Switch to a branch
git switch feature/add-login       # modern (Git 2.23+)
git checkout feature/add-login     # classic

# Create AND switch in one step
git switch -c feature/add-login
git checkout -b feature/add-login  # classic equivalent

# Create a branch from a specific commit/tag
git switch -c hotfix/null-ptr v2.1.3
git checkout -b hotfix/null-ptr a3f1c9b

# Create a branch from a remote branch
git switch -c feature/payments origin/feature/payments
```

______________________________________________________________________

## 3. Branch Naming Conventions (DevOps Standard)

```
main              – production-ready code
develop           – integration branch
feature/<ticket>  – new features    e.g. feature/JIRA-123-payment-api
bugfix/<ticket>   – bug fixes       e.g. bugfix/JIRA-456-null-check
hotfix/<ticket>   – prod hotfixes   e.g. hotfix/CVE-2024-1234
release/<version> – release prep    e.g. release/2.4.0
chore/<task>      – maintenance     e.g. chore/upgrade-node-18
```

______________________________________________________________________

## 4. Renaming and Deleting Branches

```bash
# Rename current branch
git branch -m new-name

# Rename a specific branch
git branch -m old-name new-name

# Delete a merged branch (safe)
git branch -d feature/add-login

# Force delete an unmerged branch
git branch -D feature/abandoned-idea

# Delete a remote branch
git push origin --delete feature/add-login
git push origin :feature/add-login    # older syntax (same effect)

# Prune stale remote-tracking refs
git fetch --prune
git remote prune origin
```

### Real-Time Scenario: Cleaning up after a sprint

```bash
# List branches merged into main (safe to delete)
git branch --merged main

# Delete all locally merged feature branches except main/develop
git branch --merged main | grep -v "^\* \|main\|develop" | xargs git branch -d

# Delete remote branches that no longer exist locally
git fetch --prune
```

______________________________________________________________________

## 5. Tracking Branches

```bash
# Set upstream for an existing branch
git branch --set-upstream-to=origin/main main
git branch -u origin/feature/payments feature/payments

# Push and set upstream in one step
git push -u origin feature/payments

# Show tracking info for all branches
git branch -vv

# Sample output:
# * feature/payments  a3f1c9b [origin/feature/payments] feat: add stripe integration
#   main              7d2e8fa [origin/main] chore: update dependencies
```

______________________________________________________________________

## 6. Comparing Branches

```bash
# Show commits in feature but NOT in main
git log main..feature/payments --oneline

# Show commits in either branch but not both (symmetric diff)
git log main...feature/payments --oneline

# Show files changed between branches
git diff main..feature/payments --name-only

# Show full diff between branches
git diff main..feature/payments

# How many commits ahead/behind
git rev-list --count main..feature/payments   # commits ahead
git rev-list --count feature/payments..main   # commits behind
```

### Real-Time Scenario: Pre-merge branch review in CI pipeline

```bash
# In a Jenkins/GitHub Actions pipeline — check if feature is too far behind main
BEHIND=$(git rev-list --count feature/payments..origin/main)
if [ "$BEHIND" -gt 10 ]; then
  echo "Branch is $BEHIND commits behind main. Please rebase."
  exit 1
fi
```

______________________________________________________________________

## 7. Branch Protection (Concept + GitHub CLI)

```bash
# Using GitHub CLI to add branch protection
gh api repos/org/payment-service/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci/jenkins"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2}' \
  --field restrictions=null

# List protected branches
gh api repos/org/payment-service/branches --jq '.[] | select(.protected==true) | .name'
```

______________________________________________________________________

## 8. Detached HEAD State

```bash
# Checkout a specific commit (enters detached HEAD)
git checkout a3f1c9b

# You are now in 'detached HEAD' state
# Any commits here are NOT on any branch

# Create a branch to save your work
git switch -c experiment/test-idea

# Or discard and return to main
git switch main
```

______________________________________________________________________

## 9. Real-Time Scenario: Feature Branch Workflow (Full Cycle)

```bash
# 1. Sync main before branching
git switch main
git pull --rebase origin main

# 2. Create feature branch from ticket
git switch -c feature/JIRA-789-add-2fa

# 3. Work on the feature
vim src/auth/twoFactor.js
git add -p
git commit -m "feat(auth): implement TOTP-based 2FA"

vim src/auth/twoFactor.test.js
git add src/auth/twoFactor.test.js
git commit -m "test(auth): add unit tests for 2FA"

# 4. Keep branch up-to-date with main (rebase preferred in CI)
git fetch origin
git rebase origin/main

# 5. Push feature branch
git push -u origin feature/JIRA-789-add-2fa

# 6. Open Pull Request (GitHub CLI)
gh pr create \
  --title "feat(auth): implement TOTP-based 2FA [JIRA-789]" \
  --body "## Summary\n- Adds TOTP-based 2FA support\n- Requires JIRA-789\n\n## Test Plan\n- [ ] Unit tests pass\n- [ ] Manual QA in staging" \
  --base main \
  --assignee "@me" \
  --label "feature"

# 7. After PR merge — cleanup
git switch main
git pull --rebase origin main
git branch -d feature/JIRA-789-add-2fa
git push origin --delete feature/JIRA-789-add-2fa
```

______________________________________________________________________

## 10. Real-Time Scenario: Hotfix on Production

```bash
# Production is broken — create hotfix from the production tag
git switch -c hotfix/CVE-2024-log4j v2.3.1

# Apply the fix
sed -i 's/log4j-core:2.14.1/log4j-core:2.21.0/g' pom.xml
git add pom.xml
git commit -m "fix(security): upgrade log4j-core to 2.21.0 (CVE-2024-44228)"

# Push immediately
git push -u origin hotfix/CVE-2024-log4j

# Fast-track PR merge and tag
gh pr create --title "HOTFIX: CVE-2024-log4j upgrade" --base main --label hotfix
# After merge:
git switch main && git pull
git tag -a v2.3.2 -m "Hotfix: CVE-2024-log4j patch"
git push origin v2.3.2

# Also merge hotfix into develop to keep it consistent
git switch develop
git merge --no-ff hotfix/CVE-2024-log4j
git push origin develop

# Delete hotfix branch
git branch -d hotfix/CVE-2024-log4j
git push origin --delete hotfix/CVE-2024-log4j
```

______________________________________________________________________

## Summary Table

| Command | Purpose |
|---------|---------|
| `git branch` | List local branches |
| `git switch -c <name>` | Create and switch |
| `git branch -d <name>` | Delete merged branch |
| `git branch -D <name>` | Force delete branch |
| `git push origin --delete <name>` | Delete remote branch |
| `git branch --merged main` | Branches safe to delete |
| `git branch -vv` | Show tracking info |
| `git rev-list --count` | Count ahead/behind commits |
| `git fetch --prune` | Remove stale remote refs |
