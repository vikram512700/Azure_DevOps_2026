# ☁️ 09 — Terraform Best Practices

## 📌 1. Project Structure Standards

### 🔹 Recommended File Layout

```
infrastructure/
├── modules/                        # reusable internal modules
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   └── README.md              # document every module
│   ├── aks/
│   └── key-vault/
│
├── environments/
│   ├── dev/
│   │   ├── main.tf                # calls modules
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── locals.tf              # complex locals in own file
│   │   ├── providers.tf           # provider config
│   │   ├── versions.tf            # required_providers block
│   │   ├── backend.tf             # remote backend config
│   │   └── dev.auto.tfvars        # auto-loaded — safe values only
│   ├── staging/
│   └── prod/
│
└── .github/
    └── workflows/
        └── terraform.yml
```

### 🔹 Standard File Responsibilities

```
main.tf       → resources and module calls (no variables declared here)
variables.tf  → all variable declarations
outputs.tf    → all output declarations
locals.tf     → complex local computations
providers.tf  → provider and terraform blocks
versions.tf   → required_providers (can merge with providers.tf)
backend.tf    → remote backend configuration
*.auto.tfvars → environment variable values
```

______________________________________________________________________

## 📌 2. Naming Conventions

```hcl
# Azure resource naming: lowercase, hyphens, no underscores
# <abbreviation>-<project>-<environment>-<region-short>

# Resource type abbreviations (Azure CAF — Cloud Adoption Framework)
# rg-   = Resource Group
# vnet- = Virtual Network
# snet- = Subnet
# nsg-  = Network Security Group
# rt-   = Route Table
# pe-   = Private Endpoint
# pip-  = Public IP Address
# aks-  = AKS Cluster
# acr   = Container Registry (no hyphen — alphanumeric only)
# kv-   = Key Vault
# sql-  = SQL Server
# db-   = Database
# st    = Storage Account (no hyphen)
# app-  = App Service
# asp-  = App Service Plan
# appi- = Application Insights
# log-  = Log Analytics Workspace
# id-   = Managed Identity
# vm-   = Virtual Machine
# lb-   = Load Balancer

# Terraform resource names: snake_case, match Azure resource type
resource "azurerm_virtual_network" "main" { ... }         # main VNet
resource "azurerm_subnet" "aks_nodes" { ... }             # AKS node subnet
resource "azurerm_kubernetes_cluster" "main" { ... }      # main cluster

# Local names should NOT include the resource type
# BAD:
resource "azurerm_resource_group" "resource_group_main" { ... }
# GOOD:
resource "azurerm_resource_group" "main" { ... }
```

______________________________________________________________________

## 📌 3. Variable Design

```hcl
# Always add description and type
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  # Don't add a default for required values — force explicit setting
}

# Use objects for related config
variable "aks_config" {
  description = "AKS cluster configuration"
  type = object({
    kubernetes_version    = string
    system_node_vm_size   = string
    system_node_count     = number
    app_node_vm_size      = string
    app_node_min_count    = number
    app_node_max_count    = number
  })
}

# Use optional() for genuinely optional fields (Terraform 1.3+)
variable "tags" {
  type = object({
    Environment = string
    Project     = string
    Owner       = optional(string, "devops-team")
    CostCenter  = optional(string, "engineering")
  })
}

# Always validate
variable "location" {
  type = string
  validation {
    condition = contains([
      "East US", "East US 2", "West US", "West Europe",
      "North Europe", "UK South", "Southeast Asia"
    ], var.location)
    error_message = "Location must be a supported Azure region."
  }
}
```

______________________________________________________________________

## 📌 4. Tagging Strategy

```hcl
# locals.tf — centralized tagging
locals {
  mandatory_tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
    Owner       = var.owner_email
    CostCenter  = var.cost_center
  }

  common_tags = merge(
    local.mandatory_tags,
    var.additional_tags,
    {
      TerraformWorkspace = terraform.workspace
      Repository         = "github.com/myorg/infra-repo"
    }
  )
}

# Apply to every resource
resource "azurerm_resource_group" "main" {
  name     = "rg-${local.prefix}"
  location = var.location
  tags     = local.common_tags   # always use common_tags
}
```

______________________________________________________________________

## 📌 5. Security Best Practices

### 🔹 Never Store Secrets in Code

```hcl
# BAD — secret in code
variable "db_password" {
  default = "MyP@ssword123!"     # NEVER do this
}

# GOOD 1 — read from Key Vault at plan time
data "azurerm_key_vault_secret" "db_password" {
  name         = "db-admin-password"
  key_vault_id = data.azurerm_key_vault.main.id
}

# GOOD 2 — generate and store in Key Vault
resource "random_password" "db_admin" {
  length  = 24
  special = true
}

resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-admin-password"
  value        = random_password.db_admin.result
  key_vault_id = azurerm_key_vault.main.id
}

# GOOD 3 — use managed identity (no password at all)
# Azure SQL with AAD auth only — no SQL password
resource "azurerm_mssql_server" "main" {
  azuread_administrator {
    login_username              = "app-identity"
    object_id                   = azurerm_user_assigned_identity.app.principal_id
    azuread_authentication_only = true   # disable SQL auth entirely
  }
}
```

### .gitignore for Terraform

```
# .gitignore
.terraform/
*.tfstate
*.tfstate.backup
*.tfvars          # if they contain secrets
tfplan
.terraform.lock.hcl   # DO commit this — version lock

# Keep these:
# *.tf          → always commit
# *.tfvars.example  → safe template
# .terraform.lock.hcl → always commit
```

### 🔹 Use Sensitive Outputs

```hcl
output "aks_kube_config" {
  value     = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive = true   # masked in CLI, still in state
}
```

______________________________________________________________________

## 📌 6. Linting & Static Analysis

### 🔹 TFLint

```bash
# Install
curl -s https://raw.githubusercontent.com/terraform-linters/tflint/master/install_linux.sh | bash

# .tflint.hcl
cat > .tflint.hcl << 'EOF'
config {
  format = "default"
  plugin_dir = "~/.tflint.d/plugins"
}

plugin "azurerm" {
  enabled = true
  version = "0.25.1"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

rule "terraform_naming_convention" {
  enabled = true
}

rule "terraform_unused_declarations" {
  enabled = true
}

rule "terraform_required_version" {
  enabled = true
}
EOF

# Run
tflint --init
tflint --recursive
```

### 🔹 Checkov — Security & Compliance

```bash
# Install
pip install checkov

# Scan Terraform code
checkov -d infrastructure/ --framework terraform

# Scan with specific check IDs
checkov -d infrastructure/ --check CKV_AZURE_13,CKV_AZURE_35

# Common Azure checks:
# CKV_AZURE_13  — ensure App Service uses managed identity
# CKV_AZURE_35  — ensure storage account uses HTTPS
# CKV_AZURE_50  — ensure AKS uses RBAC
# CKV_AZURE_115 — ensure AKS node pool is not using public IP
# CKV_AZURE_141 — ensure SQL server has AAD admin set

# Skip a check inline
resource "azurerm_storage_account" "main" {
  # checkov:skip=CKV_AZURE_33:Custom logs configured elsewhere
}
```

### 🔹 Terraform-docs — Auto Documentation

```bash
# Install
brew install terraform-docs

# Generate README for a module
terraform-docs markdown table . > README.md
terraform-docs markdown table --output-file README.md .

# .terraform-docs.yml config
cat > .terraform-docs.yml << 'EOF'
formatter: "markdown table"
output:
  file: README.md
  mode: inject
sort:
  enabled: true
  by: required
EOF

# Run automatically on modules
terraform-docs --config .terraform-docs.yml modules/networking/
```

______________________________________________________________________

## 📌 7. Testing with Terratest

```go
// test/networking_test.go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
    "github.com/gruntwork-io/terratest/modules/azure"
    "github.com/stretchr/testify/assert"
)

func TestNetworkingModule(t *testing.T) {
    t.Parallel()

    tfOptions := &terraform.Options{
        TerraformDir: "../modules/networking",
        Vars: map[string]interface{}{
            "environment":          "test",
            "project":              "test",
            "location":             "East US",
            "resource_group_name":  "rg-test-networking",
            "vnet_address_space":   []string{"10.99.0.0/16"},
            "subnets": map[string]interface{}{
                "snet-test": map[string]interface{}{
                    "address_prefixes": []string{"10.99.1.0/24"},
                },
            },
        },
    }

    // Destroy at end of test
    defer terraform.Destroy(t, tfOptions)

    // Deploy
    terraform.InitAndApply(t, tfOptions)

    // Get outputs
    vnetId   := terraform.Output(t, tfOptions, "vnet_id")
    subnetIds := terraform.OutputMap(t, tfOptions, "subnet_ids")

    // Assert
    assert.NotEmpty(t, vnetId)
    assert.Contains(t, subnetIds, "snet-test")
}
```

```bash
# Run tests
cd test
go test -v -timeout 30m ./...
go test -v -run TestNetworkingModule -timeout 20m
```

______________________________________________________________________

## 📌 8. Drift Detection & Compliance

```bash
# Detect drift (check if Azure resources changed outside Terraform)
terraform plan -detailed-exitcode
# Exit code 0 = no changes
# Exit code 1 = error
# Exit code 2 = changes detected (drift!)

# Refresh state without making changes
terraform refresh

# Check for drift on a specific resource
terraform plan -target=azurerm_kubernetes_cluster.main -detailed-exitcode

# Azure Policy + Terraform — prevent drift
az policy assignment create \
  --name "require-tags-${ENV}" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/rg-payment-prod-eus" \
  --policy "/providers/Microsoft.Authorization/policyDefinitions/xxxxxxxx" \
  --params '{"tagName": {"value": "ManagedBy"}, "tagValue": {"value": "terraform"}}'
```

______________________________________________________________________

## 📌 9. Resource Lifecycle Best Practices

```hcl
# Production databases: always prevent destroy
resource "azurerm_mssql_server" "main" {
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [administrator_login_password]
  }
}

# Stateful storage: prevent destroy + ignore content changes
resource "azurerm_storage_account" "main" {
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [tags["LastModified"]]
  }
}

# AKS — ignore autoscaler-managed node count
resource "azurerm_kubernetes_cluster" "main" {
  lifecycle {
    ignore_changes = [
      default_node_pool[0].node_count,
      default_node_pool[0].upgrade_settings,
      kubernetes_version
    ]
  }
}

# App Service — ignore slot swaps managed externally
resource "azurerm_linux_web_app" "main" {
  lifecycle {
    ignore_changes = [site_config[0].virtual_application]
  }
}
```

______________________________________________________________________

## 📌 10. Version Constraints

```hcl
# Terraform version — use >= minimum with no upper bound
terraform {
  required_version = ">= 1.5.0, < 2.0.0"
}

# Provider versions — use pessimistic (~>) to allow patch + minor bumps
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"    # allows 3.100.x and 3.101.x, NOT 4.x
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.47"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
```

______________________________________________________________________

## 📌 Summary Checklist

```
Code Quality:
  ✓ terraform fmt -recursive passes
  ✓ terraform validate passes
  ✓ tflint passes with no errors
  ✓ checkov passes (no CRITICAL/HIGH)
  ✓ All variables have description and type
  ✓ All modules have README.md
  ✓ .terraform.lock.hcl committed

Security:
  ✓ No secrets in .tf files or .tfvars committed
  ✓ Sensitive outputs marked sensitive = true
  ✓ Remote state with encryption and versioning
  ✓ State access via RBAC (not storage account key)
  ✓ OIDC used in CI (no long-lived client secrets)

Reliability:
  ✓ prevent_destroy on prod databases and storage
  ✓ lifecycle.ignore_changes for externally managed attributes
  ✓ Version constraints on all providers
  ✓ Drift detection scheduled in CI

Operations:
  ✓ -out=tfplan used in CI (reviewed plan applied)
  ✓ Manual approval gate for prod applies
  ✓ Common tags on all resources
  ✓ Log Analytics workspace connected
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
