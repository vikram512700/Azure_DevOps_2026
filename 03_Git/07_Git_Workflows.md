# 🐙 07 — Git Workflows for DevOps

## 📌 1. Overview of Common Workflows

| Workflow | Best For | Release Cadence |
|----------|----------|----------------|
| **Trunk-Based Development** | High-velocity teams, microservices | Continuous / Multiple per day |
| **GitHub Flow** | Small teams, web apps | On merge to main |
| **GitFlow** | Scheduled releases, version software | Periodic (weekly/sprint) |
| **GitOps** | Infrastructure / Kubernetes | On merge (declarative) |

______________________________________________________________________

## 📌 2. Trunk-Based Development (TBD)

The most common workflow in elite DevOps shops (Google, Netflix, Amazon).

### 🔹 Rules

- **One main branch** (`main` / `trunk`) — always deployable
- **Short-lived feature branches** — merge within 1-2 days
- **Feature flags** control what users see, not branches
- **CI runs on every commit**

```
main: ──o──o──o──o──o──o──o──o──  (deploy each commit or batched)
         |   |       |
        feat feat   feat  (max 1-2 days old, then merge)
```

### 🔹 Daily Workflow

```bash
# Start of day — sync trunk
git switch main
git pull --rebase origin main

# Create short-lived branch
git switch -c feature/JIRA-901-add-rate-limit

# Work in small commits
git add -p && git commit -m "feat(api): add rate limiter middleware"
git add -p && git commit -m "test(api): add rate limiter unit tests"

# Sync frequently (multiple times per day)
git fetch origin && git rebase origin/main

# Push and open PR as soon as possible
git push -u origin feature/JIRA-901-add-rate-limit
gh pr create --title "feat(api): add rate limiter [JIRA-901]" --base main

# After CI passes and 1 approval → merge (squash or rebase)
# Feature flag controls rollout:
# if (featureFlags.isEnabled('rate_limiter', userId)) { ... }
```

### 🔹 Real-Time Scenario: CI gate on Trunk-Based

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test -- --coverage

      - name: Coverage Gate
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi

      - name: Build
        run: npm run build

      - name: Docker Build
        run: docker build -t payment-service:${{ github.sha }} .
```

______________________________________________________________________

## 📌 3. GitHub Flow

Simple, pull-request-centric workflow. Ideal for web apps with continuous delivery.

```
main: ──o──────────────────o──────── (always deployable)
              \           /
              feature/X──  (PR review → merge → auto-deploy)
```

### 🔹 Steps

```bash
# 1. Branch from main
git switch main && git pull
git switch -c feature/add-dark-mode

# 2. Commit frequently
git commit -m "feat(ui): add dark mode toggle component"
git commit -m "feat(ui): persist dark mode preference to localStorage"

# 3. Push early, open PR (even as draft)
git push -u origin feature/add-dark-mode
gh pr create --draft --title "feat(ui): dark mode [WIP]" --base main

# 4. CI runs automatically on push

# 5. Request review when ready
gh pr ready         # convert draft to ready for review

# 6. Merge when CI passes + reviewed
gh pr merge --squash --delete-branch

# 7. Auto-deploy fires (GitHub Actions / Heroku / Vercel)
```

______________________________________________________________________

## 📌 4. GitFlow

Structured workflow with dedicated branches for each phase. Good for versioned software.

```
main:    ──────────────────────o─────────────────o────  (release tags only)
                               │                 │
release:              ─────────o──────bug──────>─│
                      │                           │
develop: ──o──o──o──o─│──────────────────o──o──o─│──
            │   │     │                  │   │
           feat feat  release/2.0.0     feat feat
```

### 🔹 Branch Types

| Branch | Purpose | Source | Merges Into |
|--------|---------|--------|-------------|
| `main` | Production code | – | – |
| `develop` | Integration | `main` | – |
| `feature/*` | New features | `develop` | `develop` |
| `release/*` | Release prep | `develop` | `main` + `develop` |
| `hotfix/*` | Production fixes | `main` | `main` + `develop` |

### 🔹 Full GitFlow Cycle

```bash
# Setup (first time)
git flow init -d          # accept defaults

# OR manually:
git switch -c develop main
git push -u origin develop

# --- FEATURE ---
git flow feature start JIRA-789-add-2fa
# === OR: ===
git switch develop && git pull --rebase origin develop
git switch -c feature/JIRA-789-add-2fa

# Work on feature
git commit -m "feat(auth): implement 2FA"

# Finish feature (merges into develop)
git flow feature finish JIRA-789-add-2fa
# === OR: ===
git switch develop
git merge --no-ff feature/JIRA-789-add-2fa
git branch -d feature/JIRA-789-add-2fa
git push origin develop

# --- RELEASE ---
git flow release start 2.4.0
# === OR: ===
git switch -c release/2.4.0 develop

# Bump version, update CHANGELOG
npm version 2.4.0 --no-git-tag-version
git commit -m "chore: bump version to 2.4.0"

# Bug fixes only on release branch
git commit -m "fix: edge case in payment validation"

# Finish release
git flow release finish 2.4.0
# === OR: ===
git switch main
git merge --no-ff release/2.4.0
git tag -a v2.4.0 -m "Release 2.4.0"
git switch develop
git merge --no-ff release/2.4.0
git branch -d release/2.4.0
git push origin main develop --tags

# --- HOTFIX ---
git flow hotfix start CVE-2024-log4j v2.4.0
git commit -m "fix(security): upgrade log4j to 2.21.0"
git flow hotfix finish CVE-2024-log4j
# Merges to main AND develop, tags v2.4.1
git push origin main develop --tags
```

______________________________________________________________________

## 📌 5. GitOps Workflow (Infrastructure as Code)

GitOps uses Git as the single source of truth for infrastructure state. An operator (ArgoCD, Flux) reconciles cluster state with the repo.

```
Developer → PR → Review → Merge to main
                                │
                          ArgoCD/Flux detects change
                                │
                         Applies to Kubernetes cluster
                                │
                         Reconciliation loop keeps cluster in sync
```

### 🔹 Repository Structure

```
infra-repo/
├── apps/
│   ├── payment-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── kustomization.yaml
│   └── auth-service/
├── environments/
│   ├── dev/
│   ├── staging/
│   └── prod/
└── base/
    └── common configs
```

### 🔹 GitOps Workflow in Practice

```bash
# 1. Change image tag to trigger deployment
vim apps/payment-service/deployment.yaml
# image: payment-service:2.4.1  ← bumped version

git add apps/payment-service/deployment.yaml
git commit -m "deploy(payment-service): bump to v2.4.1"
git push origin main

# 2. ArgoCD detects change, syncs cluster
# argocd app sync payment-service  (or auto-sync enabled)

# 3. Check sync status
argocd app get payment-service
kubectl rollout status deploy/payment-service -n production

# Rollback in GitOps = revert the commit
git revert HEAD --no-edit
git push origin main
# ArgoCD reverts cluster to previous state automatically
```

### 🔹 Automated Image Promotion

```bash
# ci/update-image-tag.sh — called by CI pipeline after build
#!/bin/bash
APP=$1
NEW_TAG=$2
INFRA_REPO="git@github.com:org/infra-repo.git"

git clone "$INFRA_REPO" /tmp/infra-repo
cd /tmp/infra-repo

# Update image tag in staging
sed -i "s|image: ${APP}:.*|image: ${APP}:${NEW_TAG}|" \
  environments/staging/apps/${APP}/deployment.yaml

git config user.email "ci-bot@company.com"
git config user.name  "CI Bot"
git add .
git commit -m "deploy(${APP}): promote ${NEW_TAG} to staging [skip ci]"
git push origin main
```

______________________________________________________________________

## 📌 6. Multi-Repo vs Monorepo

### 🔹 Monorepo with Selective CI

```bash
# Trigger CI only for changed services
CHANGED=$(git diff --name-only origin/main...HEAD)

if echo "$CHANGED" | grep -q "^services/payment/"; then
  echo "Running payment service pipeline..."
  cd services/payment && npm test && docker build ...
fi

if echo "$CHANGED" | grep -q "^services/auth/"; then
  echo "Running auth service pipeline..."
  cd services/auth && mvn test && docker build ...
fi
```

______________________________________________________________________

## 📌 7. Branch Naming & Protection Rules (Enterprise)

```bash
# GitHub branch protection via CLI
gh api repos/org/payment-service/branches/main/protection \
  --method PUT \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["ci/github-actions", "security/snyk"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "required_linear_history": true
}
EOF
```

### 🔹 CODEOWNERS File

```bash
cat > .github/CODEOWNERS << 'EOF'
# Default owners for everything
*                               @org/platform-team

# Security-sensitive paths require security team review
secrets/                        @org/security-team
.github/workflows/              @org/security-team @org/devops-team
infrastructure/                 @org/devops-team
helm/                           @org/devops-team

# Service-specific owners
services/payment/               @org/payment-team
services/auth/                  @org/auth-team
EOF
```

______________________________________________________________________

## 📌 Summary: Workflow Selection Guide

```
Team size < 5, web app, continuous deploy?
  → GitHub Flow

Team size > 5, versioned releases, scheduled deploys?
  → GitFlow

High-frequency deploys, feature flags, CI at every commit?
  → Trunk-Based Development

Infrastructure / Kubernetes / IaC?
  → GitOps (ArgoCD / Flux)
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
