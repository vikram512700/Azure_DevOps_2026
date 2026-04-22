# 🐙 01 — Git Basics

## 📌 1. Installation & Verification

```bash
# Linux (Ubuntu/Debian)
sudo apt update && sudo apt install git -y

# Linux (RHEL/CentOS/Amazon Linux)
sudo yum install git -y          # CentOS 7
sudo dnf install git -y          # CentOS 8+, Amazon Linux 2023

# macOS
brew install git

# Verify
git --version
# git version 2.43.0
```

______________________________________________________________________

## 📌 2. First-Time Global Configuration

```bash
git config --global user.name  "Vikram Akula"
git config --global user.email "vikram.akula1987@gmail.com"
git config --global core.editor "vim"           # default editor
git config --global init.defaultBranch main      # default branch name
git config --global pull.rebase true             # rebase on pull (DevOps best practice)
git config --global core.autocrlf input          # line endings (Linux/Mac)
git config --global core.autocrlf true           # line endings (Windows)

# View all config
git config --list

# View a single value
git config user.name
```

### 🔹 Real-Time Scenario: Setting up a new EC2 instance for a CI runner

```bash
# On a fresh Jenkins/GitLab runner EC2 instance
sudo apt install git -y

git config --global user.name  "jenkins-bot"
git config --global user.email "devops-team@company.com"
git config --global core.sshCommand "ssh -i /home/ubuntu/.ssh/deploy_key -o StrictHostKeyChecking=no"
```

______________________________________________________________________

## 📌 3. Initializing a Repository

```bash
# Initialize a new local repo
mkdir my-app && cd my-app
git init

# Initialize with an explicit branch name
git init -b main

# Initialize a bare repo (used on servers / CI systems — no working tree)
git init --bare /srv/repos/my-app.git
```

### 🔹 Real-Time Scenario: Bootstrapping a new microservice repo

```bash
mkdir payment-service && cd payment-service
git init -b main
echo "# Payment Service" > README.md
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "dist/" >> .gitignore
git add .
git commit -m "chore: initial project scaffold"
git remote add origin git@github.com:org/payment-service.git
git push -u origin main
```

______________________________________________________________________

## 📌 4. Staging and Committing

```bash
# Check working tree status
git status
git status -s               # short format

# Stage specific file
git add src/app.js

# Stage all changes
git add .
git add -A                  # includes deletions

# Stage interactively (hunk by hunk) — best practice for clean commits
git add -p

# Unstage a file (keep changes in working tree)
git restore --staged src/app.js

# Commit staged changes
git commit -m "feat: add payment gateway integration"

# Stage and commit tracked files in one step
git commit -am "fix: correct null check in payment handler"

# Amend the last commit (before pushing)
git commit --amend -m "feat: add payment gateway integration (stripe)"
git commit --amend --no-edit   # keep same message, add staged files
```

### 🔹 Commit Message Convention (Conventional Commits — used in CI/CD)

```
<type>(<scope>): <short description>

Types:
  feat     – new feature
  fix      – bug fix
  chore    – build/tooling changes
  docs     – documentation
  refactor – code restructure
  test     – tests
  ci       – CI/CD pipeline changes
  perf     – performance improvement
  revert   – reverts a commit

Examples:
  feat(auth): add OAuth2 SSO support
  fix(api): handle 504 timeout from payment service
  ci(jenkins): add SonarQube quality gate stage
  chore(deps): upgrade log4j to 2.21.0
```

______________________________________________________________________

## 📌 5. Viewing History

```bash
# Full log
git log

# One-line compact log
git log --oneline

# Graph with branches
git log --oneline --graph --all --decorate

# Last N commits
git log -5

# Log for a specific file
git log --oneline -- src/app.js

# Log with diff (patch)
git log -p

# Log between two dates
git log --since="2024-01-01" --until="2024-12-31"

# Log by author
git log --author="Vikram"

# Search commits by message keyword
git log --grep="payment"

# One-liner pretty format used in pipelines
git log --pretty=format:"%h %ad %s [%an]" --date=short
```

### 🔹 Real-Time Scenario: Finding who introduced a breaking change in prod

```bash
git log --oneline --since="2 days ago" --author-date-order
# Identify the suspect commit hash e.g. a3f1c9b

git show a3f1c9b
# Shows full diff and commit metadata

git log --oneline --follow -- src/payment/processor.js
# Track renames across history
```

______________________________________________________________________

## 📌 6. Viewing Differences

```bash
# Working tree vs staging area (unstaged changes)
git diff

# Staging area vs last commit (staged changes)
git diff --staged
git diff --cached           # same thing

# Working tree vs last commit (all changes)
git diff HEAD

# Compare two commits
git diff a3f1c9b 7d2e8fa

# Compare two branches
git diff main..feature/payments

# Show only changed file names
git diff --name-only main..feature/payments
git diff --stat main..feature/payments

# Diff a single file between commits
git diff HEAD~3 HEAD -- src/app.js
```

______________________________________________________________________

## 📌 7. .gitignore

```bash
# Create a .gitignore at repo root
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
vendor/

# Build output
dist/
build/
*.jar
*.war
*.class

# Environment & secrets
.env
.env.*
*.pem
*.key
secrets/

# IDE files
.idea/
.vscode/
*.iml

# OS files
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Terraform state
*.tfstate
*.tfstate.backup
.terraform/
EOF

# Check if a file is being ignored
git check-ignore -v path/to/file

# Track a file that is gitignored (force add)
git add -f config/special.env
```

### 🔹 Real-Time Scenario: Accidentally committed .env file

```bash
# Remove from tracking without deleting the file
git rm --cached .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: stop tracking .env file"

# If pushed to remote — you MUST rotate credentials AND purge history:
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Modern approach with git-filter-repo (recommended)
pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push origin --force --all
```

______________________________________________________________________

## 📌 8. Git Objects & Internals (Know for Interviews)

```bash
# Every commit, tree, blob has a SHA-1 hash
git cat-file -t HEAD            # type: commit
git cat-file -p HEAD            # print commit object
git cat-file -p HEAD^{tree}     # print tree of HEAD
git ls-tree HEAD                # list files at HEAD

# Show object size
git cat-file -s a3f1c9b

# The .git directory structure
.git/
  HEAD          # points to current branch ref
  config        # local repo config
  objects/      # all Git objects (blobs, trees, commits)
  refs/         # branch and tag pointers
  hooks/        # client-side hook scripts
  COMMIT_EDITMSG
  index         # staging area
```

______________________________________________________________________

## 📌 Summary Table

| Command | Purpose |
|---------|---------|
| `git init` | Create new repo |
| `git config --global` | Set global user config |
| `git status` | Show working tree state |
| `git add -p` | Stage interactively |
| `git commit -m` | Create a commit |
| `git commit --amend` | Fix last commit |
| `git log --oneline --graph` | Visual history |
| `git diff --staged` | Review staged changes |
| `git rm --cached` | Untrack a file |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
