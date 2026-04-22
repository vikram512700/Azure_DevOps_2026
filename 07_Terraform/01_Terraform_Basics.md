# 01 — Terraform Basics

## 1. What is Terraform?

Terraform is an **Infrastructure as Code (IaC)** tool by HashiCorp that lets you define, provision, and manage cloud infrastructure using a declarative configuration language (HCL).

```
You write HCL code
       ↓
terraform plan   → Terraform computes what needs to change
       ↓
terraform apply  → Terraform calls Azure APIs to create/update/delete resources
       ↓
terraform.tfstate → Terraform records what it created
```

---

## 2. Installation

```bash
# Linux (Ubuntu/Debian) — HashiCorp APT repo
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform -y

# Linux (RHEL/CentOS)
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo
sudo yum install terraform -y

# macOS
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# Windows (Chocolatey)
choco install terraform

# Verify
terraform version
# Terraform v1.7.5
# on linux_amd64

# tfenv — version manager (recommended for teams)
git clone https://github.com/tfutils/tfenv.git ~/.tfenv
export PATH="$HOME/.tfenv/bin:$PATH"
tfenv install 1.7.5
tfenv use 1.7.5
tfenv list
```

---

## 3. Azure CLI & Authentication Setup

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login interactively
az login

# Login with service principal (CI/CD)
az login --service-principal \
  --username $ARM_CLIENT_ID \
  --password $ARM_CLIENT_SECRET \
  --tenant $ARM_TENANT_ID

# Set subscription
az account set --subscription "My Azure Subscription"
az account show

# Required environment variables for Terraform Azure provider
export ARM_SUBSCRIPTION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export ARM_TENANT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export ARM_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export ARM_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Or using managed identity on Azure VM / ACI (no credentials needed)
export ARM_USE_MSI=true
```

---

## 4. Your First Terraform Project

### Directory Structure

```
my-azure-project/
├── main.tf           # main resources
├── variables.tf      # input variable declarations
├── outputs.tf        # output declarations
├── providers.tf      # provider configuration
├── versions.tf       # required versions
└── terraform.tfvars  # variable values (do NOT commit secrets)
```

### providers.tf

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }
}

provider "azurerm" {
  features {}

  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id
}
```

### main.tf — First Resource: Resource Group

```hcl
resource "azurerm_resource_group" "main" {
  name     = "rg-payment-service-dev-eastus"
  location = "East US"

  tags = {
    Environment = "dev"
    Project     = "payment-service"
    ManagedBy   = "terraform"
    Owner       = "devops-team"
  }
}
```

### variables.tf

```hcl
variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
}

variable "tenant_id" {
  description = "Azure Tenant ID"
  type        = string
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "East US"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project" {
  description = "Project name used in resource naming"
  type        = string
  default     = "payment-service"
}
```

### outputs.tf

```hcl
output "resource_group_name" {
  description = "Name of the created resource group"
  value       = azurerm_resource_group.main.name
}

output "resource_group_id" {
  description = "Resource ID of the resource group"
  value       = azurerm_resource_group.main.id
}

output "location" {
  description = "Azure region where resources are deployed"
  value       = azurerm_resource_group.main.location
}
```

### terraform.tfvars

```hcl
# terraform.tfvars — never commit secrets to git
subscription_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
tenant_id       = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
location        = "East US"
environment     = "dev"
project         = "payment-service"
```

---

## 5. The Core CLI Workflow

```bash
# ── Step 1: Initialize ──────────────────────────────────────
terraform init
# Downloads:
#   - azurerm provider plugin
#   - any modules referenced
# Creates: .terraform/ directory and .terraform.lock.hcl

# Upgrade provider versions
terraform init -upgrade

# ── Step 2: Validate ────────────────────────────────────────
terraform validate
# Checks HCL syntax and provider schema
# Does NOT require credentials or network access

# ── Step 3: Format ──────────────────────────────────────────
terraform fmt             # format current directory
terraform fmt -recursive  # format all subdirectories
terraform fmt -check      # check only (exit 1 if unformatted — use in CI)
terraform fmt -diff       # show diff of formatting changes

# ── Step 4: Plan ────────────────────────────────────────────
terraform plan
terraform plan -var="environment=staging"
terraform plan -var-file="prod.tfvars"
terraform plan -out=tfplan              # save plan to file (use in CI)
terraform plan -target=azurerm_resource_group.main  # plan single resource
terraform plan -destroy                 # preview destroy

# ── Step 5: Apply ────────────────────────────────────────────
terraform apply                         # interactive (asks yes/no)
terraform apply -auto-approve           # non-interactive (CI/CD)
terraform apply tfplan                  # apply saved plan
terraform apply -var="environment=prod" -auto-approve
terraform apply -target=azurerm_resource_group.main  # apply single resource
terraform apply -parallelism=5          # control concurrency (default 10)

# ── Step 6: Destroy ─────────────────────────────────────────
terraform destroy                       # destroy everything
terraform destroy -auto-approve         # non-interactive
terraform destroy -target=azurerm_virtual_machine.app  # destroy specific resource
```

---

## 6. Understanding Plan Output

```bash
terraform plan
# Terraform will perform the following actions:

# + = create new resource
# azurerm_resource_group.main will be created
#   + resource "azurerm_resource_group" "main" {
#       + id       = (known after apply)
#       + location = "eastus"
#       + name     = "rg-payment-service-dev-eastus"
#       + tags     = {
#           + "Environment" = "dev"
#           + "ManagedBy"   = "terraform"
#         }
#     }

# ~ = update in-place
# - = destroy
# -/+ = destroy and recreate (forces replacement)
# <= = data source read

# Summary line:
# Plan: 1 to add, 0 to change, 0 to destroy.
```

---

## 7. Terraform State Basics

```bash
# View current state
terraform show
terraform show -json | jq .

# List all resources in state
terraform state list

# Show a specific resource in state
terraform state show azurerm_resource_group.main

# Pull remote state to stdout
terraform state pull

# Refresh state (sync with actual Azure resources)
terraform refresh
```

---

## 8. .terraform.lock.hcl — Dependency Lock File

```hcl
# .terraform.lock.hcl — ALWAYS commit this to version control
# It locks provider versions so everyone on the team uses the same provider

provider "registry.terraform.io/hashicorp/azurerm" {
  version     = "3.100.0"
  constraints = "~> 3.100"
  hashes = [
    "h1:abc123...",
    "zh:def456...",
  ]
}
```

```bash
# Commit lock file
git add .terraform.lock.hcl
git commit -m "chore: lock azurerm provider to 3.100.0"

# DO NOT commit:
echo ".terraform/" >> .gitignore
echo "terraform.tfstate" >> .gitignore
echo "terraform.tfstate.backup" >> .gitignore
echo "*.tfvars" >> .gitignore         # may contain secrets
echo "tfplan" >> .gitignore
```

---

## 9. Real-Time Scenario: Bootstrap a New Azure Environment

```bash
#!/bin/bash
# bootstrap.sh — First-time setup for a new environment
set -euo pipefail

ENVIRONMENT="${1:-dev}"
LOCATION="East US"
PROJECT="payment-service"

echo "Bootstrapping $ENVIRONMENT environment..."

# 1. Create Service Principal for Terraform
SP=$(az ad sp create-for-rbac \
  --name "sp-terraform-${PROJECT}-${ENVIRONMENT}" \
  --role Contributor \
  --scopes "/subscriptions/$(az account show --query id -o tsv)" \
  --sdk-auth)

echo "Service Principal created:"
echo $SP | jq '{clientId, clientSecret, tenantId, subscriptionId}'

# 2. Create storage account for Terraform state
RG_NAME="rg-terraform-state-${ENVIRONMENT}"
SA_NAME="sttfstate${PROJECT//-/}${ENVIRONMENT}"  # no hyphens in storage account name
CONTAINER="tfstate"

az group create --name "$RG_NAME" --location "$LOCATION"

az storage account create \
  --name "$SA_NAME" \
  --resource-group "$RG_NAME" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --encryption-services blob

az storage container create \
  --name "$CONTAINER" \
  --account-name "$SA_NAME" \
  --auth-mode login

echo "Terraform backend ready:"
echo "  storage_account_name = \"$SA_NAME\""
echo "  container_name       = \"$CONTAINER\""
echo "  key                  = \"${ENVIRONMENT}.tfstate\""

# 3. Initialize Terraform
terraform init \
  -backend-config="storage_account_name=$SA_NAME" \
  -backend-config="container_name=$CONTAINER" \
  -backend-config="key=${ENVIRONMENT}.tfstate" \
  -backend-config="resource_group_name=$RG_NAME"

terraform workspace new "$ENVIRONMENT" 2>/dev/null || terraform workspace select "$ENVIRONMENT"
echo "Bootstrap complete for $ENVIRONMENT!"
```

---

## Summary Table

| Command | Purpose |
|---------|---------|
| `terraform init` | Download providers, init backend |
| `terraform init -upgrade` | Upgrade provider versions |
| `terraform validate` | Check HCL syntax |
| `terraform fmt -recursive` | Auto-format all .tf files |
| `terraform plan -out=tfplan` | Preview + save plan |
| `terraform apply tfplan` | Apply saved plan |
| `terraform apply -auto-approve` | Apply without prompt (CI) |
| `terraform destroy -auto-approve` | Destroy without prompt |
| `terraform state list` | List managed resources |
| `terraform show` | Human-readable state |
| `terraform output` | Print all outputs |
