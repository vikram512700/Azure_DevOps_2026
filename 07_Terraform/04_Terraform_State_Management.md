# 04 — Terraform State Management

## 1. What is Terraform State?

The state file (`terraform.tfstate`) is Terraform's source of truth — it maps your HCL configuration to real Azure resources.

```
HCL Code  →  terraform.tfstate  →  Real Azure Resources
              (JSON file)

State records:
  - Resource IDs (e.g., /subscriptions/.../resourceGroups/rg-app-dev)
  - All attributes Terraform knows about each resource
  - Metadata: schema versions, dependencies
  - Outputs
```

**Why remote state matters in teams:**
- Local state → only works on one machine
- Remote state → shared across team + CI/CD
- State locking → prevents concurrent applies (data corruption)

---

## 2. Remote Backend — Azure Blob Storage

### Backend Configuration (backend.tf)

```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "sttfstatepayment"
    container_name       = "tfstate"
    key                  = "prod/payment-service.tfstate"
    # key = <environment>/<project>.tfstate — naming convention
  }
}
```

### Bootstrap the Backend (run once)

```bash
#!/bin/bash
# scripts/bootstrap-backend.sh
set -euo pipefail

LOCATION="East US"
RG_NAME="rg-terraform-state"
SA_NAME="sttfstatemycompany"   # must be globally unique, 3-24 chars, lowercase
CONTAINER="tfstate"

# Create resource group
az group create \
  --name "$RG_NAME" \
  --location "$LOCATION" \
  --tags ManagedBy=manual Purpose=terraform-state

# Create storage account with security settings
az storage account create \
  --name          "$SA_NAME" \
  --resource-group "$RG_NAME" \
  --location      "$LOCATION" \
  --sku           Standard_GRS \
  --kind          StorageV2 \
  --https-only    true \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --enable-hierarchical-namespace false \
  --tags ManagedBy=manual Purpose=terraform-state

# Enable versioning (accidental state delete recovery)
az storage account blob-service-properties update \
  --account-name "$SA_NAME" \
  --resource-group "$RG_NAME" \
  --enable-versioning true \
  --enable-delete-retention true \
  --delete-retention-days 30

# Create container
az storage container create \
  --name "$CONTAINER" \
  --account-name "$SA_NAME" \
  --auth-mode login

echo "Backend ready. Add to backend.tf:"
echo ""
echo 'terraform {'
echo '  backend "azurerm" {'
echo "    resource_group_name  = \"$RG_NAME\""
echo "    storage_account_name = \"$SA_NAME\""
echo "    container_name       = \"$CONTAINER\""
echo '    key                  = "dev/payment-service.tfstate"'
echo '  }'
echo '}'
```

### Initialize with Backend Config

```bash
# Inline (useful in CI where backend.tf is generic)
terraform init \
  -backend-config="resource_group_name=rg-terraform-state" \
  -backend-config="storage_account_name=sttfstatemycompany" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=prod/payment-service.tfstate"

# Migrate local state to remote backend
terraform init -migrate-state

# Force re-initialization (change backends)
terraform init -reconfigure
```

---

## 3. State Locking

Azure Blob backend uses **blob leases** for locking — only one `apply` can run at a time.

```bash
# If a lock is stuck (e.g., CI pipeline crashed mid-apply)
# First find the lock ID
terraform force-unlock LOCK_ID

# List blobs in state container to find lease
az storage blob list \
  --account-name sttfstatemycompany \
  --container-name tfstate \
  --output table

# Break a stuck lease via Azure CLI
az storage blob lease break \
  --blob-name "prod/payment-service.tfstate" \
  --container-name tfstate \
  --account-name sttfstatemycompany

# Or via Terraform (if you have the lock ID from error output)
terraform force-unlock "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## 4. State File Structure (Understand for Troubleshooting)

```json
{
  "version": 4,
  "terraform_version": "1.7.5",
  "serial": 42,
  "lineage": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "outputs": {
    "resource_group_name": {
      "value": "rg-payment-prod-eus",
      "type": "string"
    }
  },
  "resources": [
    {
      "mode": "managed",
      "type": "azurerm_resource_group",
      "name": "main",
      "provider": "provider[\"registry.terraform.io/hashicorp/azurerm\"]",
      "instances": [
        {
          "schema_version": 0,
          "attributes": {
            "id": "/subscriptions/xxx/resourceGroups/rg-payment-prod-eus",
            "location": "eastus",
            "name": "rg-payment-prod-eus",
            "tags": { "Environment": "prod" }
          }
        }
      ]
    }
  ]
}
```

---

## 5. State Commands

### Viewing State

```bash
# List all resources tracked in state
terraform state list

# Example output:
# azurerm_resource_group.main
# azurerm_virtual_network.main
# azurerm_subnet.app["snet-app"]
# azurerm_subnet.app["snet-data"]
# module.aks.azurerm_kubernetes_cluster.main

# Show details of a specific resource
terraform state show azurerm_resource_group.main
terraform state show 'azurerm_subnet.app["snet-app"]'
terraform state show 'module.aks.azurerm_kubernetes_cluster.main'

# Pull entire state to stdout as JSON
terraform state pull
terraform state pull | jq '.resources[] | .type' | sort | uniq
```

### Moving State

```bash
# Rename a resource in state (after refactoring code)
terraform state mv \
  azurerm_resource_group.old_name \
  azurerm_resource_group.new_name

# Move resource into a module
terraform state mv \
  azurerm_virtual_network.main \
  module.networking.azurerm_virtual_network.main

# Move resource out of a module
terraform state mv \
  module.old.azurerm_key_vault.main \
  azurerm_key_vault.main

# Move between workspaces (pull → push pattern)
terraform workspace select staging
terraform state pull > /tmp/staging.tfstate

terraform workspace select prod
terraform state push /tmp/staging.tfstate   # CAUTION: overwrites prod state
```

### Removing State

```bash
# Remove a resource from state WITHOUT destroying it in Azure
# Use when: you want Terraform to forget a resource (e.g., hand-managed)
terraform state rm azurerm_resource_group.main
terraform state rm 'azurerm_subnet.app["snet-app"]'
terraform state rm module.aks

# After rm: the real Azure resource still exists, Terraform just doesn't track it
```

### Importing Existing Resources

```bash
# Add an existing Azure resource to Terraform state
# Step 1: Write the HCL resource block in your config
# Step 2: Import using the Azure resource ID

terraform import azurerm_resource_group.main \
  /subscriptions/xxxxxxxx/resourceGroups/rg-payment-prod

terraform import azurerm_virtual_network.main \
  /subscriptions/xxxxxxxx/resourceGroups/rg-app/providers/Microsoft.Network/virtualNetworks/vnet-app-prod

terraform import 'azurerm_subnet.app["snet-app"]' \
  /subscriptions/xxxxxxxx/resourceGroups/rg-app/providers/Microsoft.Network/virtualNetworks/vnet-app/subnets/snet-app

# After import: run terraform plan
# It should show 0 changes if your HCL matches the real resource
# If it shows changes: update your HCL to match
```

### Import Block (Terraform 1.5+ — declarative import)

```hcl
# import.tf — import existing resources declaratively
import {
  to = azurerm_resource_group.main
  id = "/subscriptions/xxxxxxxx/resourceGroups/rg-payment-prod"
}

import {
  to = azurerm_virtual_network.main
  id = "/subscriptions/xxxxxxxx/resourceGroups/rg-app/providers/Microsoft.Network/virtualNetworks/vnet-app"
}
```

```bash
# Generate HCL from existing resources (Terraform 1.5+)
terraform plan -generate-config-out=generated.tf
# Review generated.tf and move to main.tf
terraform apply
```

---

## 6. Multiple State Files — Project Structure

```
terraform/
├── 00-bootstrap/           # Backend + Service Principal (run once manually)
│   ├── main.tf
│   └── terraform.tfstate   # local state for bootstrap (small, safe)
│
├── 01-networking/          # VNet, Subnets, NSGs, Route Tables
│   ├── main.tf
│   └── backend.tf          # key = "networking.tfstate"
│
├── 02-shared-services/     # Key Vault, ACR, Log Analytics
│   ├── main.tf
│   └── backend.tf          # key = "shared-services.tfstate"
│
├── 03-aks/                 # AKS cluster
│   ├── main.tf
│   └── backend.tf          # key = "aks.tfstate"
│
└── 04-apps/                # App Service, SQL, Redis
    ├── main.tf
    └── backend.tf          # key = "apps.tfstate"
```

---

## 7. Remote State Data Source — Read Another Layer's State

```hcl
# In 03-aks/main.tf — read subnet IDs from the networking state
data "terraform_remote_state" "networking" {
  backend = "azurerm"
  config = {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "sttfstatemycompany"
    container_name       = "tfstate"
    key                  = "networking.tfstate"
  }
}

# Use the output from networking layer
resource "azurerm_kubernetes_cluster" "main" {
  default_node_pool {
    vnet_subnet_id = data.terraform_remote_state.networking.outputs.aks_subnet_id
  }
}

# In 01-networking/outputs.tf — export the subnet ID
output "aks_subnet_id" {
  value = azurerm_subnet.aks.id
}
```

---

## 8. State Security Best Practices

```bash
# 1. Enable storage account encryption (enabled by default in Azure)
# 2. Enable soft delete and versioning (shown in bootstrap script above)
# 3. Lock the state container with RBAC

# Give Terraform SP access to state storage
az role assignment create \
  --assignee "$SP_OBJECT_ID" \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/$SUB/resourceGroups/rg-terraform-state/providers/Microsoft.Storage/storageAccounts/sttfstatemycompany"

# 4. Enable diagnostics on state storage account
az monitor diagnostic-settings create \
  --name "diag-tfstate" \
  --resource "/subscriptions/$SUB/.../sttfstatemycompany" \
  --workspace "$LOG_ANALYTICS_ID" \
  --logs '[{"category":"StorageRead","enabled":true},{"category":"StorageWrite","enabled":true}]'

# 5. Never store sensitive values in outputs without sensitive = true
# 6. Use Azure Key Vault for secrets — reference via data source
# 7. Always use -out=tfplan in CI to ensure reviewed plan is what gets applied
```

---

## Summary Table

| Command | Purpose |
|---------|---------|
| `terraform state list` | List all tracked resources |
| `terraform state show <resource>` | Show resource attributes |
| `terraform state pull` | Download state as JSON |
| `terraform state mv old new` | Rename/move resource in state |
| `terraform state rm <resource>` | Remove from state (keep in Azure) |
| `terraform import <resource> <id>` | Import existing Azure resource |
| `terraform force-unlock <id>` | Break stuck state lock |
| `terraform init -migrate-state` | Move local state to remote |
| `data "terraform_remote_state"` | Read another layer's state |
