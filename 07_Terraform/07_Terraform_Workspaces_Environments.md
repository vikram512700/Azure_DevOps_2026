# 07 — Workspaces & Environment Management

## 1. Terraform Workspaces

Workspaces let you maintain **multiple state files** within the same configuration directory. Each workspace has its own `.tfstate`.

```bash
# List workspaces (default always exists)
terraform workspace list
# * default
#   dev
#   staging
#   prod

# Create new workspace
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Switch workspace
terraform workspace select prod
terraform workspace select dev

# Show current workspace
terraform workspace show

# Delete a workspace (must not be current, must be empty state)
terraform workspace select default
terraform workspace delete dev
```

______________________________________________________________________

## 2. Using Workspace Name in Configuration

```hcl
# Use terraform.workspace in your config
locals {
  environment = terraform.workspace    # "dev", "staging", "prod"

  env_config = {
    default = {
      location         = "East US"
      vm_size          = "Standard_B2ms"
      aks_node_count   = 1
      db_sku           = "Basic"
      replication      = "LRS"
    }
    dev = {
      location         = "East US"
      vm_size          = "Standard_B2ms"
      aks_node_count   = 1
      db_sku           = "S0"
      replication      = "LRS"
    }
    staging = {
      location         = "East US"
      vm_size          = "Standard_D2s_v3"
      aks_node_count   = 2
      db_sku           = "S2"
      replication      = "GRS"
    }
    prod = {
      location         = "East US"
      vm_size          = "Standard_D4s_v3"
      aks_node_count   = 3
      db_sku           = "S4"
      replication      = "GZRS"
    }
  }

  config = lookup(local.env_config, local.environment, local.env_config["default"])
}

resource "azurerm_resource_group" "main" {
  name     = "rg-payment-${local.environment}-eus"
  location = local.config.location
  tags     = local.common_tags
}

resource "azurerm_mssql_database" "main" {
  sku_name  = local.config.db_sku
  server_id = azurerm_mssql_server.main.id
}
```

______________________________________________________________________

## 3. Environment Strategy — Separate Directories (Recommended for Production)

Workspaces are simple but can become risky at scale. A more robust pattern uses **separate directories per environment**.

```
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── backend.tf           # key = "dev/main.tfstate"
│   │   └── dev.auto.tfvars     # auto-loaded tfvars
│   │
│   ├── staging/
│   │   ├── main.tf
│   │   ├── backend.tf           # key = "staging/main.tfstate"
│   │   └── staging.auto.tfvars
│   │
│   └── prod/
│       ├── main.tf
│       ├── backend.tf           # key = "prod/main.tfstate"
│       └── prod.auto.tfvars
│
└── modules/
    ├── networking/
    ├── aks/
    └── ...
```

### environments/dev/dev.auto.tfvars

```hcl
environment    = "dev"
location       = "East US"
project        = "payment"

vm_size        = "Standard_B2ms"
aks_node_count = 1
db_sku         = "S0"
replication    = "LRS"

vnet_address_space = ["10.1.0.0/16"]
subnets = {
  "snet-aks"  = { address_prefixes = ["10.1.1.0/24"] }
  "snet-app"  = { address_prefixes = ["10.1.2.0/24"] }
  "snet-data" = { address_prefixes = ["10.1.3.0/24"] }
}
```

### environments/prod/prod.auto.tfvars

```hcl
environment    = "prod"
location       = "East US"
project        = "payment"

vm_size        = "Standard_D4s_v3"
aks_node_count = 3
db_sku         = "BusinessCritical_Gen5_4"
replication    = "GZRS"

vnet_address_space = ["10.3.0.0/16"]
subnets = {
  "snet-aks"  = { address_prefixes = ["10.3.1.0/24"] }
  "snet-app"  = { address_prefixes = ["10.3.2.0/24"] }
  "snet-data" = { address_prefixes = ["10.3.3.0/24"] }
}
```

______________________________________________________________________

## 4. Promote from Dev → Staging → Prod

```bash
#!/bin/bash
# scripts/promote.sh — promote config from one environment to the next
set -euo pipefail

SOURCE_ENV="${1:-dev}"
TARGET_ENV="${2:-staging}"
BASE_DIR="infrastructure/environments"

echo "Promoting $SOURCE_ENV → $TARGET_ENV"

# 1. Plan target environment
cd "$BASE_DIR/$TARGET_ENV"
terraform workspace select "$TARGET_ENV" 2>/dev/null || terraform workspace new "$TARGET_ENV"
terraform init -reconfigure
terraform plan -out=tfplan

# 2. Show the plan for review
terraform show tfplan

# 3. Require manual approval for prod
if [[ "$TARGET_ENV" == "prod" ]]; then
  read -p "Type 'yes' to apply to PRODUCTION: " CONFIRM
  [[ "$CONFIRM" != "yes" ]] && { echo "Aborted."; exit 1; }
fi

# 4. Apply
terraform apply tfplan
echo "Promotion to $TARGET_ENV complete!"
```

______________________________________________________________________

## 5. Managing Multiple Azure Subscriptions

```hcl
# providers.tf — multi-subscription setup
provider "azurerm" {
  alias           = "dev"
  features        {}
  subscription_id = var.dev_subscription_id
  tenant_id       = var.tenant_id
}

provider "azurerm" {
  alias           = "staging"
  features        {}
  subscription_id = var.staging_subscription_id
  tenant_id       = var.tenant_id
}

provider "azurerm" {
  alias           = "prod"
  features        {}
  subscription_id = var.prod_subscription_id
  tenant_id       = var.tenant_id
}

# Deploy to specific subscription
resource "azurerm_resource_group" "dev" {
  provider = azurerm.dev
  name     = "rg-payment-dev-eus"
  location = "East US"
}

resource "azurerm_resource_group" "prod" {
  provider = azurerm.prod
  name     = "rg-payment-prod-eus"
  location = "East US"
}
```

______________________________________________________________________

## 6. State File per Environment — Backend Pattern

```hcl
# environments/dev/backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "sttfstatemycompany"
    container_name       = "tfstate"
    key                  = "dev/payment-service.tfstate"
  }
}

# environments/staging/backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "sttfstatemycompany"
    container_name       = "tfstate"
    key                  = "staging/payment-service.tfstate"
  }
}

# environments/prod/backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "sttfstatemycompany"
    container_name       = "tfstate"
    key                  = "prod/payment-service.tfstate"
  }
}
```

______________________________________________________________________

## 7. Environment Variables for CI Targeting

```bash
# scripts/tf-env.sh — switch Terraform context for a given environment
#!/bin/bash
ENV="${1:?Usage: tf-env.sh <dev|staging|prod>}"
cd "infrastructure/environments/$ENV"

# Load environment-specific service principal
case "$ENV" in
  dev)
    export ARM_CLIENT_ID="$DEV_SP_CLIENT_ID"
    export ARM_CLIENT_SECRET="$DEV_SP_CLIENT_SECRET"
    ;;
  staging)
    export ARM_CLIENT_ID="$STAGING_SP_CLIENT_ID"
    export ARM_CLIENT_SECRET="$STAGING_SP_CLIENT_SECRET"
    ;;
  prod)
    export ARM_CLIENT_ID="$PROD_SP_CLIENT_ID"
    export ARM_CLIENT_SECRET="$PROD_SP_CLIENT_SECRET"
    ;;
esac

export ARM_TENANT_ID="$AZURE_TENANT_ID"
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)

terraform init -reconfigure
echo "Terraform context set to: $ENV"
```

______________________________________________________________________

## 8. Workspace vs Separate Directories

| Factor | Workspaces | Separate Directories |
|--------|-----------|---------------------|
| Simplicity | Simple for small projects | More files to maintain |
| Isolation | Same code, separate state | Fully separate code + state |
| Blast radius | Code error affects all envs | Isolated per environment |
| Access control | All share one directory | Git CODEOWNERS per dir |
| Drift between envs | Easy to drift | Explicit differences visible |
| Recommended for | Development, small teams | Production, enterprise teams |
| Terragrunt | Optional | Natural fit |

______________________________________________________________________

## Summary

```
Small team, simple infra?
  → Workspaces (one directory, terraform.workspace-based logic)

Large team, complex infra, multiple subscriptions?
  → Separate directories + remote state per env

Maximum control and DRY?
  → Terragrunt with environment hierarchy
```
