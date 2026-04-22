# 05 — Undoing Changes

## Decision Tree

```
Need to undo something?
│
├── Not yet committed (working tree / staging area)?
│   ├── Discard working tree changes  → git restore <file>
│   ├── Unstage (keep changes)        → git restore --staged <file>
│   └── Discard everything            → git restore .
│
└── Already committed?
    ├── Not yet pushed to remote?
    │   ├── Fix last commit only      → git commit --amend
    │   ├── Undo last N commits       → git reset HEAD~N
    │   └── Rewrite history safely    → git rebase -i
    │
    └── Already pushed to remote?
        ├── Shared branch (main)      → git revert <hash>  (SAFE — adds new commit)
        └── Your feature branch only  → git push --force-with-lease (after reset/rebase)
```

---

## 1. Discard Working Tree Changes

```bash
# Discard changes to a specific file (restore from last commit)
git restore src/app.js
git checkout -- src/app.js        # classic syntax

# Discard all unstaged changes in working tree
git restore .
git checkout -- .                  # classic

# Remove untracked files (dry run first!)
git clean -n                       # show what WOULD be deleted
git clean -f                       # delete untracked files
git clean -fd                      # delete untracked files + directories
git clean -fdx                     # also delete gitignored files (careful!)
```

### Real-Time Scenario: Accidentally modified a config file during testing

```bash
# You edited helm/values-dev.yaml by mistake
git restore helm/values-dev.yaml

# Confirm it's clean
git status
```

---

## 2. Unstage Files (keep changes)

```bash
# Unstage a specific file
git restore --staged src/app.js
git reset HEAD src/app.js          # classic syntax

# Unstage all files
git restore --staged .
git reset HEAD                     # classic
```

---

## 3. git reset

`reset` moves HEAD (and the branch pointer) to a different commit.

```
--soft   = move HEAD, keep changes staged
--mixed  = move HEAD, unstage changes, keep in working tree  (DEFAULT)
--hard   = move HEAD, discard all changes (DESTRUCTIVE)
```

```bash
# Undo last commit — keep changes staged (for re-committing)
git reset --soft HEAD~1

# Undo last commit — unstage changes, keep in files (DEFAULT — safe)
git reset HEAD~1
git reset --mixed HEAD~1          # same

# Undo last 3 commits — keep files untouched
git reset HEAD~3

# Undo last commit and DISCARD all changes (IRREVERSIBLE)
git reset --hard HEAD~1

# Reset to a specific commit
git reset --hard a3f1c9b

# Reset to match remote (nuclear option — discard local commits)
git reset --hard origin/main
```

### Real-Time Scenario: Committed a password by accident (not yet pushed)

```bash
# Immediately unstage and reset
git reset --soft HEAD~1           # undo commit, keep file staged
git restore --staged config/db.yml

# Edit file to remove password
vim config/db.yml

# Add to .gitignore
echo "config/db.yml" >> .gitignore
git add .gitignore

# Re-commit without the secret
git add config/db.yml.example     # add template instead
git commit -m "chore: add db config template (no secrets)"
```

---

## 4. git revert (Safe for shared branches)

`revert` creates a **new commit** that undoes a previous one. It never rewrites history — safe for main/production branches.

```bash
# Revert the last commit
git revert HEAD

# Revert a specific commit
git revert a3f1c9b

# Revert without opening editor
git revert --no-edit a3f1c9b

# Revert a range (newest first)
git revert HEAD~3..HEAD

# Revert a merge commit (must specify which parent to keep)
git revert -m 1 <merge-commit-hash>   # keep parent 1 (main branch side)

# Stage the revert but don't commit yet (useful for batching)
git revert -n a3f1c9b
```

### Real-Time Scenario: Rolling back a bad deployment on main

```bash
# The commit e9f1c2b broke the payment API in production
git log --oneline -5
# e9f1c2b feat: add currency conversion endpoint
# a3f1c9b feat: add payment history pagination
# ...

# Safe rollback — creates a new "undo" commit
git revert e9f1c2b --no-edit
git push origin main

# CI/CD pipeline triggers, deploys the reverted code
# Meanwhile investigate the root cause on a branch
git checkout -b fix/currency-conversion-bug e9f1c2b
```

---

## 5. git reflog (Your Safety Net)

`reflog` records every position HEAD has been, even after resets and rebases. This is your **undo for the undo**.

```bash
# Show reference log
git reflog
git reflog show HEAD

# Sample output:
# a3f1c9b HEAD@{0}: commit: feat: payment pagination
# 7d2e8fa HEAD@{1}: rebase finished: returning to refs/heads/feature/payments
# 1a2b3c4 HEAD@{2}: rebase: feat: add stripe client
# e9f1c2b HEAD@{3}: checkout: moving from main to feature/payments

# Recover a commit that was "lost" after git reset --hard
git reset --hard HEAD@{3}

# Recover a deleted branch
git branch recovered-branch HEAD@{5}

# Reflog for a specific branch
git reflog show feature/payments

# Reflog entries expire after 90 days by default
```

### Real-Time Scenario: Accidentally ran git reset --hard

```bash
# Disaster! You ran git reset --hard and lost 3 commits
git reset --hard HEAD~3    # whoops

# Recovery via reflog
git reflog
# 7d2e8fa HEAD@{0}: reset: moving to HEAD~3
# a3f1c9b HEAD@{1}: commit: feat: final payment UI
# ...

# Recover to before the reset
git reset --hard HEAD@{1}
# or
git reset --hard a3f1c9b   # exact SHA from reflog
```

---

## 6. git restore (Modern — Git 2.23+)

```bash
# Discard working tree changes (replaces: git checkout -- <file>)
git restore src/app.js
git restore .

# Unstage (replaces: git reset HEAD <file>)
git restore --staged src/app.js
git restore --staged .

# Restore a file from a specific commit or branch
git restore --source main -- src/app.js
git restore --source HEAD~2 -- src/config.js

# Restore from a remote branch
git restore --source origin/main -- helm/values-prod.yaml
```

---

## 7. Removing Sensitive Data from History

### Using git filter-repo (Recommended)

```bash
# Install
pip install git-filter-repo

# Remove a file from all history
git filter-repo --path secrets/prod.env --invert-paths

# Remove a string from all files in history
git filter-repo --replace-text <(echo "AKIAIOSFODNN7EXAMPLE==>REDACTED")

# Remove a directory from history
git filter-repo --path config/secrets/ --invert-paths

# After filter-repo, force push all refs
git remote add origin git@github.com:org/repo.git
git push origin --force --all
git push origin --force --tags

# All collaborators must re-clone or run:
git fetch && git reset --hard origin/main
```

### Using BFG Repo-Cleaner (Alternative)

```bash
# Download BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Delete a file from history
java -jar bfg-1.14.0.jar --delete-files secrets.env my-repo.git

# Replace passwords (add to passwords.txt: secretpassword)
java -jar bfg-1.14.0.jar --replace-text passwords.txt my-repo.git

# Cleanup and push
cd my-repo.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

---

## 8. Comparison Table

| Scenario | Command | Rewrites History? | Safe for Remote? |
|----------|---------|-------------------|-----------------|
| Discard working tree file | `git restore <file>` | No | Yes |
| Unstage file | `git restore --staged <file>` | No | Yes |
| Fix last commit message | `git commit --amend` | Yes | Only if not pushed |
| Undo N local commits (keep files) | `git reset HEAD~N` | Yes | Only if not pushed |
| Undo N commits (destroy files) | `git reset --hard HEAD~N` | Yes | Only if not pushed |
| Undo a pushed commit safely | `git revert <hash>` | **No** | **YES** |
| Recover lost commits | `git reflog` → `git reset` | No | N/A |
| Remove file from all history | `git filter-repo` | Yes | Only after team coordination |

---

## Summary: Safe vs Dangerous

```
SAFE (can always undo):
  git restore, git revert, git reflog

DANGEROUS (rewrites history — coordinate with team first):
  git reset --hard, git rebase, git commit --amend (after push),
  git filter-repo / BFG, git push --force
```
