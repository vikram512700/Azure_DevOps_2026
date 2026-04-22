# 09 — Git Troubleshooting & Performance

## 1. Common Errors & Fixes

______________________________________________________________________

### Error: `Your local changes would be overwritten by merge`

```bash
# You have uncommitted changes and tried to pull/checkout
error: Your local changes to the following files would be overwritten by merge:
        src/app.js

# Fix Option 1: Stash changes, then pull
git stash push -u -m "WIP before pull"
git pull --rebase origin main
git stash pop

# Fix Option 2: Discard local changes and take remote
git restore src/app.js
git pull --rebase origin main

# Fix Option 3: Commit first
git add -p && git commit -m "wip: save local changes"
git pull --rebase origin main
```

______________________________________________________________________

### Error: `fatal: refusing to merge unrelated histories`

```bash
# Happens when two repos have no common commit ancestry
error: fatal: refusing to merge unrelated histories

# Fix: allow unrelated histories (use cautiously — understand WHY)
git pull origin main --allow-unrelated-histories

# This happens when:
# - git init locally and then tried to pull from a new GitHub repo
# - Repos were initialized separately
```

______________________________________________________________________

### Error: `rejected — non-fast-forward`

```bash
error: failed to push some refs to 'origin'
hint: Updates were rejected because the remote contains work that you do not have locally.

# Fix: pull and rebase before pushing
git pull --rebase origin main
git push origin main

# OR for your feature branch
git fetch origin
git rebase origin/feature/my-branch
git push --force-with-lease origin feature/my-branch
```

______________________________________________________________________

### Error: `cannot lock ref` or `loose object` errors

```bash
error: cannot lock ref 'refs/remotes/origin/feature/x': is at ... but expected ...

# Fix: repair the repo
git remote prune origin
git gc --prune=now
git fetch --all

# If pack files are corrupted
git fsck --full
git gc --aggressive --prune=now
```

______________________________________________________________________

### Error: Detached HEAD

```bash
# You're on a commit, not a branch
HEAD detached at a3f1c9b

# Fix 1: Create a branch to save your work
git switch -c my-recovery-branch

# Fix 2: Just get back to main (LOSING commits made in detached state)
git switch main
# Before doing this, note your current SHA:
git log --oneline -1
# then: git switch -c rescue HEAD  (to save them)
```

______________________________________________________________________

### Error: `CONFLICT (modify/delete)` during merge

```bash
CONFLICT (modify/delete): src/old-api.js deleted in feature/cleanup
but modified in main. Version main of src/old-api.js left in tree.

# Fix: decide which version to keep
# Keep the file (accept main's modification)
git add src/old-api.js

# Delete the file (accept the deletion)
git rm src/old-api.js

# Then complete the merge
git commit
```

______________________________________________________________________

### Error: `index.lock file exists`

```bash
fatal: Unable to create '.git/index.lock': File exists.

# Cause: A previous git operation crashed and didn't clean up
# Fix: Delete the lock file
rm -f .git/index.lock

# Only do this if no other git process is running!
# Check for running git processes first:
ps aux | grep git
```

______________________________________________________________________

### Error: SSL Certificate Problem

```bash
fatal: unable to access 'https://github.com/...': SSL certificate problem

# Fix 1: Update CA certificates (Linux)
sudo apt-get update && sudo apt-get install --reinstall ca-certificates

# Fix 2: Specify cert bundle
git config --global http.sslCAInfo /etc/ssl/certs/ca-certificates.crt

# Fix 3: Temporary bypass (NOT for production — security risk)
git config --global http.sslVerify false
# Re-enable after: git config --global http.sslVerify true

# Fix 4: Use SSH instead of HTTPS
git remote set-url origin git@github.com:org/repo.git
```

______________________________________________________________________

### Error: `Permission denied (publickey)`

```bash
git@github.com: Permission denied (publickey).

# Debug: check which key is being offered
ssh -vT git@github.com 2>&1 | grep "Offering\|Authenticated"

# Check SSH agent has the key loaded
ssh-add -l

# Add the key
ssh-add ~/.ssh/github_ed25519

# Verify SSH config
cat ~/.ssh/config

# Test connection
ssh -T git@github.com
```

______________________________________________________________________

## 2. Recovery Scenarios

______________________________________________________________________

### Recover a Deleted Branch

```bash
# Find the last commit SHA of the deleted branch via reflog
git reflog | grep feature/deleted-branch

# Example output:
# a3f1c9b HEAD@{4}: checkout: moving from feature/deleted-branch to main

# Re-create the branch
git branch feature/deleted-branch a3f1c9b
git switch feature/deleted-branch

# If branch was on remote, check there
git fetch origin
git branch -a | grep deleted-branch
git switch -c feature/deleted-branch origin/feature/deleted-branch
```

______________________________________________________________________

### Recover a Dropped Stash

```bash
# Stash objects remain in git objects for ~90 days
# Find dangling stash objects
git fsck --unreachable | grep commit

# Inspect each unreachable commit to find your stash
git show <hash>

# Restore as a branch
git branch recovered-stash <hash>
```

______________________________________________________________________

### Undo a Pushed Merge to Main

```bash
# The merge commit on main: e9f1c2b
# SAFE approach (preserves history)
git revert -m 1 e9f1c2b
git push origin main

# Explanation of -m 1:
# Merge commits have 2+ parents. -m 1 keeps the mainline (parent 1)
# and discards the feature branch changes (parent 2).
```

______________________________________________________________________

### Restore a Single File from a Previous Commit

```bash
# Restore a specific file to how it was 3 commits ago
git restore --source HEAD~3 -- src/payment/processor.js

# Restore from a specific commit
git restore --source a3f1c9b -- src/payment/processor.js

# Restore from another branch
git restore --source main -- config/database.yml

# Stage the restored file
git add src/payment/processor.js
git commit -m "fix: restore processor.js to working state"
```

______________________________________________________________________

### Split a Large Commit into Multiple Smaller Ones

```bash
# Reset the last commit (keep changes staged/unstaged)
git reset HEAD~1

# Now interactively stage chunks
git add -p

# Commit the first logical chunk
git commit -m "feat: add stripe payment client"

# Stage more chunks
git add -p
git commit -m "test: add unit tests for stripe client"

# Commit remaining changes
git add .
git commit -m "chore: update package.json dependencies"
```

______________________________________________________________________

## 3. Large Repository Optimization

______________________________________________________________________

### Shallow Clone for Speed

```bash
# Full clone of a large repo: 5 minutes → 15 seconds
git clone --depth 1 git@github.com:org/large-monorepo.git

# Deepen gradually if you need more history
git fetch --deepen=50

# Convert shallow to full
git fetch --unshallow
```

______________________________________________________________________

### Sparse Checkout (Monorepos — checkout only what you need)

```bash
# Clone without checking out files
git clone --no-checkout git@github.com:org/large-monorepo.git
cd large-monorepo

# Enable sparse checkout
git sparse-checkout init --cone

# Set the paths you care about
git sparse-checkout set services/payment infrastructure/terraform

# Now checkout
git checkout main

# Add more paths later
git sparse-checkout add services/auth

# List current sparse checkout paths
git sparse-checkout list
```

______________________________________________________________________

### Git LFS (Large File Storage)

```bash
# Install git-lfs
sudo apt install git-lfs
git lfs install

# Track large file types
git lfs track "*.jar"
git lfs track "*.zip"
git lfs track "*.psd"
git lfs track "datasets/**"

# This creates/updates .gitattributes
git add .gitattributes
git commit -m "chore: configure git-lfs tracking"

# Push (lfs uploads automatically)
git push origin main

# Check LFS status
git lfs status
git lfs ls-files

# Migrate existing large files to LFS
git lfs migrate import --include="*.jar" --everything
git push --force --all
```

______________________________________________________________________

### Garbage Collection & Repo Maintenance

```bash
# Standard cleanup
git gc

# Aggressive cleanup (slower but more thorough)
git gc --aggressive --prune=now

# Check repo size
git count-objects -vH

# Find large files in history
git rev-list --objects --all | \
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | \
  awk '/^blob/ {print substr($0,6)}' | \
  sort -k2 -rn | head -20

# Verify integrity
git fsck --full

# Remove unreachable objects
git prune --expire now
```

______________________________________________________________________

## 4. Debugging Tips

```bash
# Enable verbose git output
GIT_CURL_VERBOSE=1 git fetch
GIT_SSH_COMMAND="ssh -v" git fetch
GIT_TRACE=1 git pull

# Debug SSH connection
ssh -vvv -T git@github.com

# Show git config in effect (includes all inheritance)
git config --list --show-origin

# Find which .gitconfig/gitattributes rule applies to a file
git check-attr -a src/payment/processor.js

# Verify what HEAD points to
cat .git/HEAD
# ref: refs/heads/feature/payments

# Check if repo has shallow flag
cat .git/shallow
git rev-parse --is-shallow-repository
```

______________________________________________________________________

## 5. Git Aliases for DevOps Productivity

```bash
# Add these to ~/.gitconfig under [alias]
git config --global alias.st       "status -sb"
git config --global alias.co       "checkout"
git config --global alias.sw       "switch"
git config --global alias.br       "branch -vv"
git config --global alias.lg       "log --oneline --graph --decorate --all"
git config --global alias.last     "log -1 HEAD --stat"
git config --global alias.unstage  "restore --staged"
git config --global alias.discard  "restore"
git config --global alias.ap       "add -p"
git config --global alias.pushf    "push --force-with-lease"
git config --global alias.prune-branches "!git branch --merged main | grep -v 'main\\|develop\\|\\*' | xargs git branch -d"
git config --global alias.recent   "for-each-ref --sort=-committerdate refs/heads/ --format='%(refname:short) %(committerdate:relative) %(authorname)'"
git config --global alias.aliases  "config --get-regexp ^alias\\."

# Usage:
git lg          # visual log
git st          # short status
git ap          # interactive stage
git pushf       # safe force push
git prune-branches  # clean merged branches
git recent      # branches by last commit
```

______________________________________________________________________

## 6. Quick Diagnostic Checklist

```
Git command failing? Run through this checklist:

□ git status — what state is the repo in?
□ git remote -v — are remote URLs correct?
□ git branch -vv — is tracking set up correctly?
□ ssh -T git@github.com — is SSH auth working?
□ git config --list — any conflicting config?
□ git log --oneline -5 — where is HEAD?
□ git reflog | head -20 — what happened recently?
□ cat .git/HEAD — is HEAD pointing to a branch or commit?
□ ls .git/ — any lock files?
□ git fsck — any corruption?
```

______________________________________________________________________

## Summary: Emergency Commands

```bash
# "I broke everything" toolkit:
git reflog                          # find where you were
git reset --hard <good-sha>         # go back in time
git stash                           # save current mess
git merge --abort                   # cancel bad merge
git rebase --abort                  # cancel bad rebase
git cherry-pick --abort             # cancel cherry-pick
git restore .                       # discard all working tree changes
git clean -fd                       # remove all untracked files
rm -f .git/index.lock               # remove stale lock
git gc --prune=now                  # clean up objects
```
