# 🐙 06 — Advanced Git Commands

## 📌 1. git stash

Stash saves your uncommitted changes and gives you a clean working tree.

```bash
# Stash current changes (tracked files only)
git stash

# Stash with a descriptive message
git stash push -m "WIP: payment webhook handler"

# Stash including untracked files
git stash push -u -m "WIP: including new files"

# Stash including untracked AND gitignored files
git stash push -a

# List all stashes
git stash list
# stash@{0}: On feature/payments: WIP: payment webhook handler
# stash@{1}: WIP on main: temp debug logging

# Apply most recent stash (keeps it in stash list)
git stash apply

# Apply a specific stash
git stash apply stash@{1}

# Pop most recent stash (apply + remove from list)
git stash pop

# Show what's in a stash
git stash show stash@{0}
git stash show -p stash@{0}     # with full diff

# Drop a specific stash
git stash drop stash@{1}

# Clear all stashes
git stash clear

# Create a branch from a stash
git stash branch feature/stashed-work stash@{0}
```

### 🔹 Real-Time Scenario: Urgent hotfix interrupts feature work

```bash
# You're mid-feature when a P1 alert fires in production
git stash push -u -m "WIP: JIRA-789 2FA implementation — incomplete"

# Switch to main, create hotfix
git switch main
git pull --rebase origin main
git switch -c hotfix/api-null-ptr

# Fix and deploy
vim src/api/handler.js
git add -p && git commit -m "fix: null pointer in API handler on empty cart"
git push -u origin hotfix/api-null-ptr

# After hotfix merged — resume your work
git switch feature/JIRA-789-add-2fa
git stash pop
```

______________________________________________________________________

## 📌 2. Git Tags

```bash
# List tags
git tag
git tag -l "v2.*"              # filter by pattern

# Lightweight tag (just a pointer to commit)
git tag v2.1.0

# Annotated tag (recommended — stores tagger, date, message)
git tag -a v2.1.0 -m "Release version 2.1.0 — payment gateway integration"

# Tag a past commit
git tag -a v2.0.1 a3f1c9b -m "Hotfix release 2.0.1"

# Show tag details
git show v2.1.0

# Push a specific tag
git push origin v2.1.0

# Push all tags
git push origin --tags

# Delete a local tag
git tag -d v2.1.0

# Delete a remote tag
git push origin --delete v2.1.0
git push origin :refs/tags/v2.1.0   # old syntax

# Checkout a tag (detached HEAD)
git checkout v2.1.0

# Create a branch from a tag
git checkout -b release/2.1.x v2.1.0
```

### 🔹 Real-Time Scenario: Automated release tagging in CI

```bash
#!/bin/bash
# ci/tag-release.sh
VERSION=$(cat package.json | grep '"version"' | sed 's/.*"\(.*\)".*/\1/')
TAG="v${VERSION}"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists. Skipping."
  exit 0
fi

git tag -a "$TAG" -m "Release $TAG — $(git log -1 --pretty=%s)"
git push origin "$TAG"
echo "Tagged and pushed: $TAG"
```

______________________________________________________________________

## 📌 3. git bisect (Binary Search for Bugs)

```bash
# Start bisect session
git bisect start

# Mark current commit as bad
git bisect bad

# Mark a known-good commit (e.g., last release)
git bisect good v2.0.0

# Git checks out middle commit — test your code, then mark:
git bisect good     # if this commit is fine
git bisect bad      # if this commit is broken

# Git keeps halving until it finds the first bad commit
# Example output:
# a3f1c9b is the first bad commit
# Author: Vikram <vikram@company.com>
# Date: Mon Jan 15 2024
#     feat: add async payment processing

# End bisect session (returns to original branch)
git bisect reset

# Automate bisect with a test script
git bisect start HEAD v2.0.0
git bisect run ./tests/check-payment.sh
# Script must exit 0 for good, non-zero for bad
```

### 🔹 Real-Time Scenario: Performance regression in production

```bash
# Performance test shows API latency doubled since last month
# Commits between good and bad:
git log --oneline v2.1.0..v2.3.0

git bisect start
git bisect bad HEAD
git bisect good v2.1.0

# Bisect runs — test each commit automatically
git bisect run bash -c 'npm test -- --testNamePattern="payment API latency"'

# Git identifies: b3c4d5e introduced the regression
# git show b3c4d5e  → "feat: add synchronous audit logging to payment flow"
```

______________________________________________________________________

## 📌 4. git blame

```bash
# Show who changed each line of a file
git blame src/payment/processor.js

# Blame with line numbers and timestamps
git blame -n -t src/payment/processor.js

# Blame a specific range of lines
git blame -L 45,60 src/payment/processor.js

# Ignore whitespace changes
git blame -w src/payment/processor.js

# Follow renames
git blame -C src/payment/processor.js

# Blame at a specific commit
git blame v2.0.0 -- src/payment/processor.js
```

### 🔹 Real-Time Scenario: Who broke the prod config?

```bash
git blame -L 1,20 config/database.yml
# 3a4b5c6d (Vikram 2024-03-15) host: prod-db.company.com
# 7e8f9a0b (CI-Bot  2024-03-20) host: staging-db.company.com  ← BUG!

git show 7e8f9a0b
# Automated commit from CD pipeline accidentally used staging config
```

______________________________________________________________________

## 📌 5. git submodules

```bash
# Add a submodule
git submodule add git@github.com:org/shared-lib.git libs/shared

# Initialize submodules after clone
git submodule init
git submodule update
git submodule update --init --recursive   # nested submodules

# Clone and init all submodules in one step
git clone --recurse-submodules git@github.com:org/main-app.git

# Update submodule to latest commit on its tracked branch
git submodule update --remote libs/shared

# Show submodule status
git submodule status

# Remove a submodule
git submodule deinit libs/shared
git rm libs/shared
rm -rf .git/modules/libs/shared
git commit -m "chore: remove shared-lib submodule"
```

### 🔹 Real-Time Scenario: Shared Terraform modules as submodule

```bash
# Main infra repo uses shared terraform modules
git submodule add git@github.com:org/tf-modules.git modules/shared
git commit -m "chore: add shared terraform modules submodule"

# CI pipeline always initializes before plan
git submodule update --init --recursive
terraform init -backend-config=backend.tfvars
terraform plan
```

______________________________________________________________________

## 📌 6. Git Hooks

Hooks are scripts that run automatically on Git events. Located in `.git/hooks/`.

```bash
ls .git/hooks/
# applypatch-msg    pre-applypatch  pre-push
# commit-msg        pre-commit      pre-rebase
# post-commit       pre-merge-commit prepare-commit-msg
# post-merge        post-receive    update
```

### 🔹 pre-commit hook (run linting and tests before commit)

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
set -e

echo "Running pre-commit checks..."

# Run linter
npm run lint
if [ $? -ne 0 ]; then
  echo "Linting failed. Commit aborted."
  exit 1
fi

# Run unit tests
npm test -- --testPathPattern="unit"
if [ $? -ne 0 ]; then
  echo "Unit tests failed. Commit aborted."
  exit 1
fi

echo "All checks passed!"
EOF

chmod +x .git/hooks/pre-commit
```

### 🔹 commit-msg hook (enforce Conventional Commits)

```bash
cat > .git/hooks/commit-msg << 'EOF'
#!/bin/bash
MSG=$(cat "$1")
PATTERN="^(feat|fix|chore|docs|refactor|test|ci|perf|revert)(\(.+\))?: .{1,72}"

if ! echo "$MSG" | grep -qP "$PATTERN"; then
  echo "ERROR: Commit message does not follow Conventional Commits format."
  echo "Expected: <type>(<scope>): <description>"
  echo "Example:  feat(auth): add OAuth2 support"
  exit 1
fi
EOF

chmod +x .git/hooks/commit-msg
```

### 🔹 Sharing hooks with the team (Husky for Node.js projects)

```bash
npm install --save-dev husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm test"

# Add commit-msg hook
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

______________________________________________________________________

## 📌 7. git shortlog & Statistics

```bash
# Summary of commits per author
git shortlog -sn

# Since a date
git shortlog -sn --since="30 days ago"

# Commit count per author
git shortlog -sn HEAD | head -10

# Lines changed per author (requires git log)
git log --author="Vikram" --pretty=tformat: --numstat \
  | awk '{add+=$1; del+=$2} END {print "Added:", add, "Deleted:", del}'

# File change frequency (hot spots)
git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20
```

______________________________________________________________________

## 📌 8. git archive (Export without .git)

```bash
# Export current HEAD as a tar.gz (no .git directory)
git archive --format=tar.gz --prefix=myapp-v2.1/ HEAD > myapp-v2.1.tar.gz

# Export a tag
git archive --format=zip v2.1.0 > release-v2.1.0.zip

# Export a specific path only
git archive HEAD:src/ --format=tar.gz > src-only.tar.gz
```

### 🔹 Real-Time Scenario: Creating a release artifact in CI

```bash
#!/bin/bash
# ci/create-release-artifact.sh
VERSION=$1
git archive --format=tar.gz \
  --prefix="payment-service-${VERSION}/" \
  --worktree-attributes \
  "v${VERSION}" > "payment-service-${VERSION}.tar.gz"

sha256sum "payment-service-${VERSION}.tar.gz" > "payment-service-${VERSION}.tar.gz.sha256"
```

______________________________________________________________________

## 📌 9. git worktree (Multiple Working Trees)

```bash
# Create a second working tree for a different branch
git worktree add ../hotfix-tree hotfix/CVE-2024-1234

# List worktrees
git worktree list

# Work in the second tree (in a different terminal)
cd ../hotfix-tree
# ... make fixes, commit, push ...

# Remove worktree when done
git worktree remove ../hotfix-tree
```

### 🔹 Real-Time Scenario: Working on a hotfix while mid-feature

```bash
# Instead of stashing, use a worktree
git worktree add ../hotfix main
cd ../hotfix
git switch -c hotfix/security-patch
# ... fix, commit, push, PR merged ...
git worktree remove ../hotfix

# Your original working tree with feature branch untouched
cd ../main-repo
```

______________________________________________________________________

## 📌 Summary Table

| Command | Purpose |
|---------|---------|
| `git stash push -u -m` | Save WIP with message |
| `git stash pop` | Restore most recent stash |
| `git tag -a v1.0 -m` | Create annotated tag |
| `git bisect run <script>` | Auto binary search for bug |
| `git blame -L 10,20 <file>` | Who changed which lines |
| `git submodule update --init` | Init and update submodules |
| `git archive HEAD` | Export repo without .git |
| `git worktree add` | Multiple working directories |
| `.git/hooks/pre-commit` | Auto checks before commit |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
