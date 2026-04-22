# 🚀 02 — Continuous Integration Mastery

Continuous Integration (CI) is the backbone of modern software development. It ensures that multiple developers can work on the same codebase simultaneously without stepping on each other's toes. By automatically building and testing code every time a commit is pushed, CI guarantees that the `main` branch is always in a deployable state.

______________________________________________________________________

## 📌 1. Core Principles of CI

A world-class CI pipeline adheres to several non-negotiable principles:

1. **Maintain a Single Source Repository**: All source code, tests, database schemas, and infrastructure definitions (IaC) live in version control.
1. **Automate the Build**: The build process must be completely automated, requiring zero manual intervention.
1. **Make the Build Self-Testing**: The build must include automated unit and integration tests. If a test fails, the build fails.
1. **Every Commit is Built on an Integration Machine**: Developers build locally, but the CI server provides the ultimate source of truth.
1. **Keep the Build Fast**: A CI build should take less than 10 minutes. If it takes longer, developers will stop running it frequently.

______________________________________________________________________

## 📌 2. CI Pipeline Stages

A robust CI pipeline typically follows these stages:

### 🔹 1. Code Checkout

The CI server pulls the latest code from the repository.

### 🔹 2. Static Analysis & Linting

Tools analyze the source code without executing it. They check for code smells, stylistic errors, and adherence to team standards.

- *Tools*: ESLint (JS), Pylint (Python), Checkstyle (Java).

### 🔹 3. Unit Testing & Code Coverage

Tests that validate individual components of the software. Code coverage tools measure what percentage of your code is executed during tests.

- *Tools*: JUnit (Java), PyTest (Python), Jest (Node), SonarQube (Coverage reporting).

### 🔹 4. Build & Package

Compiling the source code into a deployable artifact.

- *Tools*: Maven/Gradle (Java), Webpack (Frontend), Docker (Containerization).

### 🔹 5. Artifact Publishing

The compiled artifact (e.g., a `.jar` file or a Docker image) is uploaded to an artifact repository so it can be deployed later.

- *Tools*: Azure Container Registry (ACR), Docker Hub, JFrog Artifactory.

______________________________________________________________________

## 📌 3. Real-World Example: Java Spring Boot CI Pipeline

Let's look at a "Best in the World" CI pipeline using **GitHub Actions**. This pipeline builds a Java Spring Boot application, runs unit tests, performs static analysis with SonarCloud, builds a Docker image, and pushes it to Azure Container Registry (ACR).

### 🔹 The GitHub Actions Workflow (`.github/workflows/ci.yml`)

```yaml
name: Java Spring Boot CI

# Trigger the pipeline on pushes and PRs to the main branch
on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

env:
  ACR_LOGIN_SERVER: myregistry.azurecr.io
  IMAGE_NAME: spring-boot-api

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    steps:
      # 1. Checkout the code
      - name: Checkout Code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for SonarCloud analysis

      # 2. Set up Java environment
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: maven

      # 3. Compile and Run Unit Tests
      - name: Build and Test with Maven
        run: mvn -B verify

      # 4. Static Code Analysis (SonarCloud)
      - name: Analyze with SonarCloud
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        run: mvn -B org.sonarsource.scanner.maven:sonar-maven-plugin:sonar \
             -Dsonar.projectKey=my-org_spring-boot-api

      # 5. Log in to Azure Container Registry
      - name: Log in to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: ${{ env.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}

      # 6. Build and Push Docker Image
      # We tag the image with the GitHub Commit SHA for traceability
      - name: Build and Push Docker image
        run: |
          docker build -t ${{ env.ACR_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:${{ github.sha }} .
          docker push ${{ env.ACR_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
```

> [!NOTE]
> **Why tag with `github.sha`?**
> Tagging Docker images with the Git Commit SHA (instead of just `latest`) ensures that every artifact is uniquely identifiable and traceable back to the exact code change that produced it. This is critical for debugging production issues and rolling back deployments.

______________________________________________________________________

> [!TIP]
> **Pro Tip:** When setting up your CI pipelines, use dependency caching (like `cache: maven` in the example above). Caching downloads dependencies once and reuses them across pipeline runs, slashing your build times in half!
