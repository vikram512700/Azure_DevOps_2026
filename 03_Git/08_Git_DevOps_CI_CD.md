# 08 — Git in DevOps CI/CD Pipelines

## 1. GitHub Actions — Full Pipeline

```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  release:
    types: [published]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ─────────────────────────────────────────
  # Job 1: Lint & Test
  # ─────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0               # full history for SonarQube

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Test with coverage
        run: npm test -- --coverage --ci

      - name: Upload coverage
        uses: codecov/codecov-action@v4

  # ─────────────────────────────────────────
  # Job 2: Security Scan
  # ─────────────────────────────────────────
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Dependency audit
        run: npm audit --audit-level=high

      - name: Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'

  # ─────────────────────────────────────────
  # Job 3: Build & Push Docker Image
  # ─────────────────────────────────────────
  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=,suffix=,format=short
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─────────────────────────────────────────
  # Job 4: Deploy to Staging
  # ─────────────────────────────────────────
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Update image tag in infra repo
        run: |
          git clone https://x-access-token:${{ secrets.INFRA_PAT }}@github.com/org/infra-repo.git
          cd infra-repo
          IMAGE_TAG=$(echo "${{ needs.build.outputs.image-tag }}" | head -1)
          sed -i "s|image: payment-service:.*|image: ${IMAGE_TAG}|" \
            environments/staging/payment-service/deployment.yaml
          git config user.email "github-actions@company.com"
          git config user.name  "GitHub Actions"
          git commit -am "deploy(payment-service): update staging to ${IMAGE_TAG} [skip ci]"
          git push

  # ─────────────────────────────────────────
  # Job 5: Deploy to Production (on release)
  # ─────────────────────────────────────────
  deploy-prod:
    needs: build
    runs-on: ubuntu-latest
    if: github.event_name == 'release'
    environment:
      name: production
      url: https://payment.company.com
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production cluster
        uses: azure/k8s-deploy@v1
        with:
          manifests: kubernetes/production/
          images: ${{ needs.build.outputs.image-tag }}
          namespace: production
```

---

## 2. Jenkins Pipeline (Declarative)

```groovy
// Jenkinsfile
pipeline {
    agent {
        kubernetes {
            yaml '''
            apiVersion: v1
            kind: Pod
            spec:
              containers:
              - name: docker
                image: docker:24-dind
                securityContext:
                  privileged: true
              - name: kubectl
                image: bitnami/kubectl:latest
                command: ["cat"]
                tty: true
            '''
        }
    }

    environment {
        REGISTRY     = "harbor.company.com"
        APP_NAME     = "payment-service"
        IMAGE        = "${REGISTRY}/${APP_NAME}"
        SONAR_URL    = "https://sonar.company.com"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_BRANCH_NAME = env.BRANCH_NAME ?: sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Lint & Test') {
            parallel {
                stage('Lint') {
                    steps { sh 'npm run lint' }
                }
                stage('Unit Tests') {
                    steps {
                        sh 'npm test -- --coverage --ci'
                        publishHTML(target: [
                            reportDir: 'coverage/lcov-report',
                            reportFiles: 'index.html',
                            reportName: 'Coverage Report'
                        ])
                    }
                }
            }
        }

        stage('SonarQube') {
            when { not { changeRequest() } }
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh """
                        sonar-scanner \
                          -Dsonar.projectKey=${APP_NAME} \
                          -Dsonar.sources=src \
                          -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                          -Dsonar.scm.revision=${env.GIT_COMMIT_SHORT}
                    """
                }
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                container('docker') {
                    sh """
                        docker build \
                          --build-arg GIT_COMMIT=${env.GIT_COMMIT_SHORT} \
                          --build-arg BUILD_DATE=\$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
                          -t ${IMAGE}:${env.GIT_COMMIT_SHORT} \
                          -t ${IMAGE}:${env.GIT_BRANCH_NAME} \
                          .
                    """
                }
            }
        }

        stage('Push Image') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                    branch pattern: 'release/.*', comparator: 'REGEXP'
                }
            }
            steps {
                container('docker') {
                    withCredentials([usernamePassword(
                        credentialsId: 'harbor-registry',
                        usernameVariable: 'REGISTRY_USER',
                        passwordVariable: 'REGISTRY_PASS'
                    )]) {
                        sh """
                            docker login ${REGISTRY} -u $REGISTRY_USER -p $REGISTRY_PASS
                            docker push ${IMAGE}:${env.GIT_COMMIT_SHORT}
                            docker push ${IMAGE}:${env.GIT_BRANCH_NAME}
                        """
                    }
                }
            }
        }

        stage('Deploy to Staging') {
            when { branch 'develop' }
            steps {
                container('kubectl') {
                    withKubeConfig([credentialsId: 'staging-kubeconfig']) {
                        sh """
                            kubectl set image deployment/${APP_NAME} \
                              ${APP_NAME}=${IMAGE}:${env.GIT_COMMIT_SHORT} \
                              -n staging
                            kubectl rollout status deployment/${APP_NAME} -n staging --timeout=120s
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            slackSend(
                channel: '#deployments',
                color: 'good',
                message: "✅ ${APP_NAME} build ${env.BUILD_NUMBER} succeeded on ${env.GIT_BRANCH_NAME} (${env.GIT_COMMIT_SHORT})"
            )
        }
        failure {
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: "❌ ${APP_NAME} build ${env.BUILD_NUMBER} FAILED on ${env.GIT_BRANCH_NAME} — ${env.BUILD_URL}"
            )
        }
        always {
            cleanWs()
        }
    }
}
```

---

## 3. GitLab CI/CD Pipeline

```yaml
# .gitlab-ci.yml
image: node:20-alpine

variables:
  DOCKER_HOST: tcp://docker:2376
  DOCKER_TLS_CERTDIR: "/certs"
  IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

stages:
  - validate
  - test
  - build
  - deploy

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/

# ─── Validate ───────────────────────────────
lint:
  stage: validate
  script:
    - npm ci
    - npm run lint

commitlint:
  stage: validate
  script:
    - npm ci
    - npx commitlint --from $CI_MERGE_REQUEST_DIFF_BASE_SHA --to HEAD

# ─── Test ────────────────────────────────────
unit-tests:
  stage: test
  script:
    - npm ci
    - npm test -- --coverage --ci
  coverage: '/Lines\s*:\s*(\d+\.?\d*%)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

# ─── Build ───────────────────────────────────
docker-build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $IMAGE .
    - docker push $IMAGE
    - docker tag $IMAGE $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_REF_SLUG
  only:
    - main
    - develop
    - /^release\/.*/

# ─── Deploy ──────────────────────────────────
deploy-staging:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: https://staging.company.com
  script:
    - kubectl config use-context staging
    - kubectl set image deployment/payment-service
        payment-service=$IMAGE -n staging
    - kubectl rollout status deployment/payment-service -n staging
  only:
    - develop

deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://payment.company.com
  script:
    - kubectl config use-context production
    - kubectl set image deployment/payment-service
        payment-service=$IMAGE -n production
    - kubectl rollout status deployment/payment-service -n production
  when: manual
  only:
    - main
```

---

## 4. Git Commit SHA in Docker Labels

```dockerfile
# Dockerfile
FROM node:20-alpine

ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.revision=$GIT_COMMIT \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.source="https://github.com/org/payment-service"

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

ENV GIT_COMMIT=$GIT_COMMIT
EXPOSE 3000
CMD ["node", "src/index.js"]
```

```bash
# Build with git metadata baked in
docker build \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  -t payment-service:$(git rev-parse --short HEAD) .
```

---

## 5. Useful Git Commands in CI Scripts

```bash
#!/bin/bash
# Common CI git helpers

# Get short SHA (image tag)
GIT_SHA=$(git rev-parse --short HEAD)

# Get branch name
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Get latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")

# Get version from tag (e.g. v2.1.3 → 2.1.3)
VERSION=${LATEST_TAG#v}

# Check if HEAD is tagged
if git describe --exact-match --tags HEAD 2>/dev/null; then
  echo "This is a tagged release: $(git describe --exact-match --tags HEAD)"
fi

# Get number of commits since last tag (build number)
BUILD=$(git rev-list --count ${LATEST_TAG}..HEAD)

# Full version string: 2.1.3.45+a3f1c9b
FULL_VERSION="${VERSION}.${BUILD}+${GIT_SHA}"
echo "Version: $FULL_VERSION"

# Check if working tree is clean (CI safety check)
if ! git diff --quiet; then
  echo "ERROR: Working tree is dirty. CI should start from clean state."
  exit 1
fi

# List files changed in this PR/push (for selective testing)
if [ -n "$CI_MERGE_REQUEST_DIFF_BASE_SHA" ]; then
  git diff --name-only "$CI_MERGE_REQUEST_DIFF_BASE_SHA"..HEAD
else
  git diff --name-only HEAD~1..HEAD
fi
```

---

## 6. Semantic Versioning with Git Tags (Automated)

```bash
#!/bin/bash
# ci/auto-semver.sh — auto-bump version based on commit messages since last tag

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo "Last tag: $LAST_TAG"

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "${LAST_TAG#v}"

# Analyze commits since last tag
COMMITS=$(git log "${LAST_TAG}..HEAD" --pretty=format:"%s")

if echo "$COMMITS" | grep -qE "^(feat|fix)!|BREAKING CHANGE"; then
  MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0
  BUMP_TYPE="MAJOR"
elif echo "$COMMITS" | grep -q "^feat"; then
  MINOR=$((MINOR + 1)); PATCH=0
  BUMP_TYPE="MINOR"
else
  PATCH=$((PATCH + 1))
  BUMP_TYPE="PATCH"
fi

NEW_TAG="v${MAJOR}.${MINOR}.${PATCH}"
echo "Bump type: $BUMP_TYPE → New tag: $NEW_TAG"

git tag -a "$NEW_TAG" -m "Release $NEW_TAG (auto-generated)"
git push origin "$NEW_TAG"
```

---

## 7. Git Hooks for CI Quality Gates

```bash
# .git/hooks/pre-push — prevent pushing broken code
#!/bin/bash
echo "Running pre-push checks..."

# Run full test suite before push
npm test
if [ $? -ne 0 ]; then
  echo "Tests failed! Push aborted. Fix tests before pushing."
  exit 1
fi

# Prevent direct push to main (force PR workflow)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REMOTE=$1

if [ "$BRANCH" = "main" ] && [ "$REMOTE" = "origin" ]; then
  echo "Direct push to main is not allowed. Please open a Pull Request."
  exit 1
fi

echo "Pre-push checks passed."
exit 0
```

---

## Summary Table

| Concept | Tool/Command |
|---------|-------------|
| Get commit SHA for image tag | `git rev-parse --short HEAD` |
| Check if HEAD is a release | `git describe --exact-match --tags` |
| Build number since last tag | `git rev-list --count v1.0..HEAD` |
| Files changed in PR | `git diff --name-only BASE..HEAD` |
| Prevent push to main | `pre-push` hook |
| Auto-bump semver | Analyze commits with `git log` |
| Bake git info into Docker | `--build-arg GIT_COMMIT=` |
| Trigger deploy on merge | GitHub Actions `on: push: branches:` |
