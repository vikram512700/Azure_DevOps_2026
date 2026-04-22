# 🐙 03 — Git Remote Operations

## 📌 1. Cloning a Repository

```bash
# Clone via HTTPS
git clone https://github.com/org/payment-service.git

# Clone via SSH (preferred in CI/CD — no password prompts)
git clone git@github.com:org/payment-service.git

# Clone into a specific directory
git clone git@github.com:org/payment-service.git my-local-name

# Shallow clone — only last N commits (faster for CI pipelines)
git clone --depth 1 git@github.com:org/payment-service.git

# Shallow clone with a specific branch
git clone --depth 1 --branch main git@github.com:org/payment-service.git

# Clone a specific branch only
git clone --single-branch --branch develop git@github.com:org/payment-service.git

# Clone with all submodules
git clone --recurse-submodules git@github.com:org/payment-service.git
```

### 🔹 Real-Time Scenario: Jenkins pipeline checkout optimization

```groovy
// Jenkinsfile — shallow clone to speed up build time
checkout([
  $class: 'GitSCM',
  branches: [[name: env.BRANCH_NAME]],
  extensions: [[$class: 'CloneOption', shallow: true, depth: 1]],
  userRemoteConfigs: [[url: 'git@github.com:org/payment-service.git',
                        credentialsId: 'github-ssh-key']]
])
```

______________________________________________________________________

## 📌 2. Managing Remotes

```bash
# List remotes
git remote
git remote -v                  # with URLs

# Add a remote
git remote add origin git@github.com:org/payment-service.git
git remote add upstream git@github.com:original-owner/payment-service.git

# Change remote URL (e.g. migrating from HTTPS to SSH)
git remote set-url origin git@github.com:org/payment-service.git

# Rename a remote
git remote rename origin gitlab

# Remove a remote
git remote remove upstream

# Show detailed info about a remote
git remote show origin
```

### 🔹 Real-Time Scenario: Migrating from GitHub to GitLab

```bash
# Add new GitLab remote
git remote add gitlab git@gitlab.com:org/payment-service.git

# Push all branches and tags to GitLab
git push gitlab --mirror

# Verify then update origin
git remote set-url origin git@gitlab.com:org/payment-service.git
git remote remove gitlab

# Confirm
git remote -v
```

______________________________________________________________________

## 📌 3. Fetch vs Pull vs Pull --rebase

```
fetch  = download remote changes, do NOT touch working tree
pull   = fetch + merge
pull --rebase = fetch + rebase (keeps linear history — DevOps standard)
```

```bash
# Fetch all remotes (safe — never changes working files)
git fetch
git fetch origin
git fetch --all             # all remotes
git fetch --prune           # also remove stale remote refs

# Pull and merge (creates merge commits — noisy history)
git pull origin main

# Pull and rebase (recommended — keeps history linear)
git pull --rebase origin main
git pull --rebase           # uses tracked upstream

# Make rebase the default pull strategy globally
git config --global pull.rebase true

# Pull with fast-forward only (safe — fail if merge needed)
git pull --ff-only origin main
```

### 🔹 Visual Difference

```
# git pull (merge)
  A──B──C  (origin/main)
          \
           M  (merge commit — noise in log)
          /
  A──B──D  (local)

# git pull --rebase
  A──B──C──D  (clean linear history)
```

______________________________________________________________________

## 📌 4. Pushing

```bash
# Push current branch to tracked upstream
git push

# Push to specific remote and branch
git push origin feature/payments

# Push and set upstream tracking
git push -u origin feature/payments

# Push all local branches
git push --all origin

# Push all tags
git push --tags
git push origin v2.1.3          # push specific tag

# Force push (use with caution — only on feature branches you own)
git push --force-with-lease     # SAFE: fails if remote has new commits
git push --force                # UNSAFE: overwrites remote blindly

# Delete a remote branch via push
git push origin --delete feature/old-feature
```

### 🔹 Real-Time Scenario: Force push after rebase (on feature branch only)

```bash
# You rebased your feature branch on main
git rebase origin/main

# Now your local history diverges from remote — must force push
# ALWAYS use --force-with-lease, NOT --force
git push --force-with-lease origin feature/JIRA-789-add-2fa

# If someone else pushed to your branch meanwhile, --force-with-lease will FAIL
# Check what they added first
git fetch origin
git log origin/feature/JIRA-789-add-2fa --oneline
```

______________________________________________________________________

## 📌 5. SSH Key Setup for Remote Authentication

```bash
# Generate SSH key pair
ssh-keygen -t ed25519 -C "vikram.akula1987@gmail.com" -f ~/.ssh/github_ed25519

# Start ssh-agent and add key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/github_ed25519

# Copy public key to add to GitHub/GitLab
cat ~/.ssh/github_ed25519.pub

# Test connection
ssh -T git@github.com
# Hi Vikram! You've successfully authenticated.

# Configure SSH to use specific key for GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_ed25519
  IdentitiesOnly yes

Host gitlab.com
  HostName gitlab.com
  User git
  IdentityFile ~/.ssh/gitlab_ed25519
  IdentitiesOnly yes
EOF
```

### 🔹 Real-Time Scenario: CI/CD deploy key for a GitHub repo

```bash
# Generate deploy key (read-only is fine for clone; read-write for push)
ssh-keygen -t ed25519 -C "jenkins-payment-service" -f /home/jenkins/.ssh/deploy_key_payment -N ""

# Add public key to GitHub repo: Settings > Deploy Keys > Add
cat /home/jenkins/.ssh/deploy_key_payment.pub

# Jenkins pipeline uses this key via SSH agent binding
withCredentials([sshUserPrivateKey(credentialsId: 'payment-service-deploy-key',
                                   keyFileVariable: 'SSH_KEY')]) {
    sh 'GIT_SSH_COMMAND="ssh -i $SSH_KEY" git clone git@github.com:org/payment-service.git'
}
```

______________________________________________________________________

## 📌 6. Working with Forks (Open Source / Enterprise)

```bash
# Fork on GitHub UI, then:
git clone git@github.com:yourname/payment-service.git
cd payment-service

# Add the original repo as upstream
git remote add upstream git@github.com:original-org/payment-service.git

# Sync your fork with upstream
git fetch upstream
git switch main
git merge upstream/main       # or: git rebase upstream/main
git push origin main

# Create a feature branch and PR
git switch -c fix/typo-in-readme
# ... make changes ...
git push -u origin fix/typo-in-readme
gh pr create --repo original-org/payment-service --base main
```

______________________________________________________________________

## 📌 7. Fetching a Remote PR Locally (GitHub)

```bash
# Checkout a PR locally to test/review
git fetch origin pull/42/head:pr-42
git switch pr-42

# Or using GitHub CLI
gh pr checkout 42

# Get back to your branch
git switch main
git branch -D pr-42
```

______________________________________________________________________

## 📌 8. Git Bundle (Offline Transfer)

```bash
# Create a bundle (portable file containing git objects)
git bundle create payment-service.bundle --all

# Transfer it to an air-gapped environment then clone from it
git clone payment-service.bundle payment-service-clone
cd payment-service-clone
git remote set-url origin git@internal-gitlab:org/payment-service.git
git push --mirror origin
```

______________________________________________________________________

## 📌 9. Real-Time Scenario: Multi-Remote GitOps Setup

```bash
# A DevOps team pushes to GitHub AND mirrors to an internal GitLab
git remote add origin    git@github.com:org/infra-repo.git
git remote add internal  git@gitlab.internal:ops/infra-repo.git

# Push to both remotes in one command using a push refspec
git config remote.all.url git@github.com:org/infra-repo.git
git config --add remote.all.pushurl git@github.com:org/infra-repo.git
git config --add remote.all.pushurl git@gitlab.internal:ops/infra-repo.git

git push all main   # pushes to both GitHub and internal GitLab
```

______________________________________________________________________

## 📌 Summary Table

| Command | Purpose |
|---------|---------|
| `git clone --depth 1` | Shallow clone for CI speed |
| `git remote -v` | List all remotes with URLs |
| `git remote set-url` | Change a remote URL |
| `git fetch --prune` | Download + clean stale refs |
| `git pull --rebase` | Sync with linear history |
| `git push -u origin` | Push + set upstream |
| `git push --force-with-lease` | Safe force push |
| `git push origin --delete` | Delete remote branch |
| `gh pr checkout <n>` | Checkout a GitHub PR locally |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
