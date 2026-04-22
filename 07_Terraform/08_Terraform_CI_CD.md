# 08 — Terraform in CI/CD Pipelines

## 1. GitHub Actions — Full Terraform Pipeline

```yaml
# .github/workflows/terraform.yml
name: Terraform CI/CD

on:
  push:
    branches: [main]
    paths: ["infrastructure/**"]
  pull_request:
    branches: [main]
    paths: ["infrastructure/**"]

env:
  TF_VERSION: "1.7.5"
  ARM_TENANT_ID:       ${{ secrets.ARM_TENANT_ID }}
  ARM_CLIENT_ID:       ${{ secrets.ARM_CLIENT_ID }}
  ARM_CLIENT_SECRET:   ${{ secrets.ARM_CLIENT_SECRET }}
  ARM_SUBSCRIPTION_ID: ${{ secrets.ARM_SUBSCRIPTION_ID }}

permissions:
  contents:      read
  pull-requests: write   # needed for PR comments
  id-token:      write   # for OIDC auth (see OIDC section)

jobs:
  # ────────────────────────────────────────────────
  # Validate — runs on every PR
  # ────────────────────────────────────────────────
  validate:
    name: Validate Terraform
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Format Check
        run: terraform fmt -recursive -check
        working-directory: infrastructure/environments/dev

      - name: Init
        run: terraform init -backend=false
        working-directory: infrastructure/environments/dev

      - name: Validate
        run: terraform validate
        working-directory: infrastructure/environments/dev

      - name: TFLint
        uses: terraform-linters/setup-tflint@v4
      - run: |
          tflint --init
          tflint --recursive

      - name: Checkov Security Scan
        uses: bridgecrewio/checkov-action@master
        with:
          directory: infrastructure/
          framework: terraform
          soft_fail: false

  # ────────────────────────────────────────────────
  # Plan — runs on PR (posts comment with plan)
  # ────────────────────────────────────────────────
  plan:
    name: Terraform Plan
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'pull_request'
    strategy:
      matrix:
        environment: [dev, staging]   # plan both envs on PR

    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Init
        run: terraform init
        working-directory: infrastructure/environments/${{ matrix.environment }}

      - name: Plan
        id: plan
        run: |
          terraform plan -no-color -out=tfplan 2>&1 | tee plan_output.txt
          echo "exitcode=$?" >> $GITHUB_OUTPUT
        working-directory: infrastructure/environments/${{ matrix.environment }}

      - name: Post Plan Comment
        uses: actions/github-script@v7
        if: always()
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('infrastructure/environments/${{ matrix.environment }}/plan_output.txt', 'utf8');
            const maxLen = 65000;
            const truncated = plan.length > maxLen ? plan.slice(0, maxLen) + '\n... truncated ...' : plan;
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Terraform Plan — \`${{ matrix.environment }}\`\n\`\`\`\n${truncated}\n\`\`\``
            });

      - name: Upload Plan
        uses: actions/upload-artifact@v4
        with:
          name: tfplan-${{ matrix.environment }}
          path: infrastructure/environments/${{ matrix.environment }}/tfplan

  # ────────────────────────────────────────────────
  # Apply Dev — on merge to main
  # ────────────────────────────────────────────────
  apply-dev:
    name: Apply to Dev
    runs-on: ubuntu-latest
    needs: validate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: dev

    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Init
        run: terraform init
        working-directory: infrastructure/environments/dev

      - name: Plan
        run: terraform plan -out=tfplan
        working-directory: infrastructure/environments/dev

      - name: Apply
        run: terraform apply -auto-approve tfplan
        working-directory: infrastructure/environments/dev

  # ────────────────────────────────────────────────
  # Apply Prod — manual approval gate
  # ────────────────────────────────────────────────
  apply-prod:
    name: Apply to Production
    runs-on: ubuntu-latest
    needs: apply-dev
    environment: prod   # requires manual approval in GitHub Environments UI

    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Init
        run: terraform init
        working-directory: infrastructure/environments/prod

      - name: Plan
        run: terraform plan -out=tfplan
        working-directory: infrastructure/environments/prod

      - name: Apply
        run: terraform apply -auto-approve tfplan
        working-directory: infrastructure/environments/prod
```

---

## 2. OIDC Authentication (No Secrets — Best Practice)

```yaml
# Using Workload Identity Federation — no client secrets stored in GitHub
permissions:
  id-token: write
  contents: read

steps:
  - name: Azure Login via OIDC
    uses: azure/login@v2
    with:
      client-id:       ${{ secrets.AZURE_CLIENT_ID }}
      tenant-id:       ${{ secrets.AZURE_TENANT_ID }}
      subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      # No client_secret — uses OIDC token instead!

  - name: Terraform Init
    run: terraform init
    env:
      # ARM_USE_OIDC=true tells the provider to use the OIDC token
      ARM_USE_OIDC: "true"
      ARM_CLIENT_ID:       ${{ secrets.AZURE_CLIENT_ID }}
      ARM_TENANT_ID:       ${{ secrets.AZURE_TENANT_ID }}
      ARM_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

```bash
# Setup federated credential on the Service Principal (one-time)
az ad app federated-credential create \
  --id "$SP_APP_ID" \
  --parameters '{
    "name": "github-actions-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:myorg/infra-repo:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# For PRs
az ad app federated-credential create \
  --id "$SP_APP_ID" \
  --parameters '{
    "name": "github-actions-prs",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:myorg/infra-repo:pull_request",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

---

## 3. Azure DevOps Pipeline

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main]
  paths:
    include: [infrastructure/*]

pr:
  branches:
    include: [main]
  paths:
    include: [infrastructure/*]

variables:
  TF_VERSION: '1.7.5'
  TF_WORKING_DIR: 'infrastructure/environments/$(ENVIRONMENT)'
  serviceConnection: 'sc-azure-devops-terraform'

stages:
  # ─── Validate ───────────────────────────────────────
  - stage: Validate
    displayName: Validate Terraform
    jobs:
      - job: validate
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: TerraformInstaller@1
            inputs:
              terraformVersion: $(TF_VERSION)

          - script: terraform fmt -recursive -check
            displayName: Format Check
            workingDirectory: infrastructure

          - script: terraform init -backend=false
            displayName: Init (no backend)
            workingDirectory: $(TF_WORKING_DIR)
            env:
              ARM_SUBSCRIPTION_ID: $(ARM_SUBSCRIPTION_ID)
              ARM_TENANT_ID:       $(ARM_TENANT_ID)
              ARM_CLIENT_ID:       $(ARM_CLIENT_ID)
              ARM_CLIENT_SECRET:   $(ARM_CLIENT_SECRET)

          - script: terraform validate
            displayName: Validate
            workingDirectory: $(TF_WORKING_DIR)

  # ─── Plan ───────────────────────────────────────────
  - stage: Plan
    displayName: Terraform Plan
    dependsOn: Validate
    jobs:
      - job: plan
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: TerraformInstaller@1
            inputs:
              terraformVersion: $(TF_VERSION)

          - task: TerraformTaskV4@4
            displayName: Init
            inputs:
              provider: azurerm
              command: init
              workingDirectory: $(TF_WORKING_DIR)
              backendServiceArm: $(serviceConnection)
              backendAzureRmResourceGroupName:  rg-terraform-state
              backendAzureRmStorageAccountName: sttfstatemycompany
              backendAzureRmContainerName:      tfstate
              backendAzureRmKey:                $(ENVIRONMENT)/payment.tfstate

          - task: TerraformTaskV4@4
            displayName: Plan
            inputs:
              provider:            azurerm
              command:             plan
              workingDirectory:    $(TF_WORKING_DIR)
              commandOptions:      -out=tfplan -var-file=$(ENVIRONMENT).auto.tfvars
              environmentServiceNameAzureRM: $(serviceConnection)
              publishPlanResults:  tfplan

          - publish: $(TF_WORKING_DIR)/tfplan
            artifact: tfplan-$(ENVIRONMENT)

  # ─── Apply Dev ──────────────────────────────────────
  - stage: ApplyDev
    displayName: Apply to Dev
    dependsOn: Plan
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    variables:
      ENVIRONMENT: dev
    jobs:
      - deployment: apply_dev
        environment: dev
        pool:
          vmImage: ubuntu-latest
        strategy:
          runOnce:
            deploy:
              steps:
                - task: TerraformTaskV4@4
                  displayName: Apply Dev
                  inputs:
                    provider: azurerm
                    command: apply
                    workingDirectory: $(TF_WORKING_DIR)
                    commandOptions: -auto-approve tfplan
                    environmentServiceNameAzureRM: $(serviceConnection)

  # ─── Apply Prod (Manual Gate) ───────────────────────
  - stage: ApplyProd
    displayName: Apply to Production
    dependsOn: ApplyDev
    variables:
      ENVIRONMENT: prod
    jobs:
      - deployment: apply_prod
        environment: production   # requires manual approval in Environments UI
        pool:
          vmImage: ubuntu-latest
        strategy:
          runOnce:
            deploy:
              steps:
                - task: TerraformTaskV4@4
                  displayName: Init Prod
                  inputs:
                    provider: azurerm
                    command: init
                    workingDirectory: $(TF_WORKING_DIR)
                    backendServiceArm: $(serviceConnection)
                    backendAzureRmKey: prod/payment.tfstate

                - task: TerraformTaskV4@4
                  displayName: Plan Prod
                  inputs:
                    provider: azurerm
                    command: plan
                    commandOptions: -out=tfplan
                    workingDirectory: $(TF_WORKING_DIR)
                    environmentServiceNameAzureRM: $(serviceConnection)

                - task: TerraformTaskV4@4
                  displayName: Apply Prod
                  inputs:
                    provider: azurerm
                    command: apply
                    commandOptions: -auto-approve tfplan
                    workingDirectory: $(TF_WORKING_DIR)
                    environmentServiceNameAzureRM: $(serviceConnection)
```

---

## 4. Atlantis — Terraform Pull Request Automation

Atlantis runs Terraform plan on PR and lets reviewers approve + apply from PR comments.

```yaml
# atlantis.yaml — place in repo root
version: 3
automerge: false
delete_source_branch_on_merge: false

projects:
  - name: payment-dev
    dir: infrastructure/environments/dev
    workspace: dev
    terraform_version: v1.7.5
    autoplan:
      when_modified: ["*.tf", "*.tfvars", "../../../modules/**/*.tf"]
      enabled: true
    apply_requirements: [approved, mergeable]

  - name: payment-staging
    dir: infrastructure/environments/staging
    workspace: staging
    terraform_version: v1.7.5
    autoplan:
      when_modified: ["*.tf", "*.tfvars"]
      enabled: true
    apply_requirements: [approved, mergeable]

  - name: payment-prod
    dir: infrastructure/environments/prod
    workspace: prod
    terraform_version: v1.7.5
    autoplan:
      when_modified: ["*.tf", "*.tfvars"]
      enabled: false   # don't auto-plan prod
    apply_requirements: [approved, mergeable]
    # Require 2 approvals for prod
```

```bash
# Atlantis PR commands (type in PR comment)
atlantis plan                    # plan all changed projects
atlantis plan -p payment-prod    # plan specific project
atlantis apply                   # apply after approval
atlantis apply -p payment-dev    # apply specific project

# Workflow:
# 1. Open PR → Atlantis auto-runs terraform plan
# 2. Plan posted as PR comment
# 3. Team reviews plan + approves PR
# 4. Comment "atlantis apply"
# 5. Atlantis applies + merges PR automatically
```

---

## 5. Scheduled Drift Detection

```yaml
# .github/workflows/drift-detection.yml
name: Terraform Drift Detection

on:
  schedule:
    - cron: '0 6 * * *'   # every day at 6 AM UTC

env:
  ARM_TENANT_ID:       ${{ secrets.ARM_TENANT_ID }}
  ARM_CLIENT_ID:       ${{ secrets.ARM_CLIENT_ID }}
  ARM_CLIENT_SECRET:   ${{ secrets.ARM_CLIENT_SECRET }}
  ARM_SUBSCRIPTION_ID: ${{ secrets.ARM_SUBSCRIPTION_ID }}

jobs:
  drift-check:
    strategy:
      matrix:
        environment: [dev, staging, prod]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.7.5"

      - name: Init
        run: terraform init
        working-directory: infrastructure/environments/${{ matrix.environment }}

      - name: Detect Drift
        id: plan
        run: |
          terraform plan -detailed-exitcode -no-color 2>&1
        working-directory: infrastructure/environments/${{ matrix.environment }}
        continue-on-error: true

      - name: Alert on Drift
        if: steps.plan.outputs.exitcode == '2'   # 2 = changes detected
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `🚨 Terraform Drift Detected — ${{ matrix.environment }}`,
              body: `Drift detected in **${{ matrix.environment }}** environment.\nRun \`terraform plan\` in \`infrastructure/environments/${{ matrix.environment }}\` to review.`,
              labels: ['terraform', 'drift', '${{ matrix.environment }}']
            });
```

---

## Summary Table

| Approach | Best For |
|----------|---------|
| GitHub Actions | GitHub repos, OIDC auth, PR plans |
| Azure DevOps Pipelines | Azure-native teams, ADO environments |
| Atlantis | GitOps-style, PR-driven apply workflow |
| Scheduled drift detection | Catch manual Azure portal changes |
| OIDC (no secrets) | Most secure — no client secrets in CI |
