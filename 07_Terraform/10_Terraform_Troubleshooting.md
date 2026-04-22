# ☁️ 10 — Terraform Troubleshooting & Recovery

## 📌 1. Debug Logging

```bash
# Enable detailed logging
export TF_LOG=DEBUG          # DEBUG, INFO, WARN, ERROR, TRACE
export TF_LOG_PATH=./terraform.log

terraform plan 2>&1 | tee terraform.log

# Provider-specific logging
export TF_LOG_PROVIDER=DEBUG

# Core engine logging only
export TF_LOG_CORE=DEBUG

# Disable logging
unset TF_LOG
export TF_LOG=off

# Search logs for Azure API calls
grep "Request" terraform.log | grep -v "DEBUG"
grep "Response" terraform.log | grep "Status: 4"   # 4xx errors
```

______________________________________________________________________

## 📌 2. Common Errors & Fixes

______________________________________________________________________

### 🔹 Error: `Error: A resource with the ID "..." already exists`

```
Error: A resource with the ID "/subscriptions/.../resourceGroups/rg-payment-dev" 
already exists - to be managed via Terraform this resource needs to be imported.
```

```bash
# Fix: Import the existing resource into state
terraform import azurerm_resource_group.main \
  /subscriptions/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/resourceGroups/rg-payment-dev

# Then run plan — fix any attribute differences shown
terraform plan
```

______________________________________________________________________

### 🔹 Error: `Error: context deadline exceeded` or timeout

```bash
# Fix 1: Increase timeout via environment variable (seconds)
export ARM_AZURE_ENVIRONMENT=public
export ARM_POLLING_INTERVAL=300    # 5 minutes
export ARM_REQUEST_TIMEOUT=600     # 10 minutes

# Fix 2: Retry the apply
terraform apply -auto-approve

# Fix 3: Target the timed-out resource only
terraform apply -target=azurerm_kubernetes_cluster.main
```

______________________________________________________________________

### 🔹 Error: `Error: Provider "hashicorp/azurerm" is incompatible`

```bash
# Fix: Clean .terraform and reinit
rm -rf .terraform .terraform.lock.hcl
terraform init

# Or upgrade provider
terraform init -upgrade
```

______________________________________________________________________

### 🔹 Error: `Error: Backend configuration changed`

```
Error: Backend configuration changed
A change in the backend configuration has been detected...
```

```bash
# Fix: Reinitialize with reconfigure flag
terraform init -reconfigure

# Or migrate state to new backend
terraform init -migrate-state
```

______________________________________________________________________

### 🔹 Error: `Error: Error locking state: Error acquiring the state lock`

```
Error: Error locking state: Error acquiring the state lock
Lock Info:
  ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Who: vikram@prod-deploy-machine
  Operation: OperationTypePlan
```

```bash
# Cause: Previous plan/apply crashed and didn't release lock

# Fix 1: Force unlock using the lock ID from error output
terraform force-unlock xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Fix 2: Break the Azure Blob lease manually
az storage blob lease break \
  --blob-name "prod/payment.tfstate" \
  --container-name tfstate \
  --account-name sttfstatemycompany

# Fix 3: Check if a previous apply is still running
# Look at CI pipeline logs / running processes
ps aux | grep terraform
```

______________________________________________________________________

### 🔹 Error: `Error: Invalid index`

```
Error: Invalid index
  on main.tf line 45:
  45:   subnet_id = azurerm_subnet.subnets["snet-aks"].id
The given key does not identify an element in this collection value.
```

```bash
# Fix: Check what's actually in the for_each map
terraform state list | grep subnet
terraform console
> var.subnets          # inspect the variable
> keys(var.subnets)    # list keys
```

______________________________________________________________________

### 🔹 Error: `Error: Insufficient permissions`

```
Error: authorization.RoleAssignmentsClient#Create: 
Failure responding to request: StatusCode=403 
-- Original Error: autorest/azure: Service returned an error.
Status=403 Code="AuthorizationFailed"
Message="The client '...' does not have authorization to perform 
action 'Microsoft.Authorization/roleAssignments/write'"
```

```bash
# Fix: Grant the Service Principal RBAC permissions
# For role assignments, SP needs "Owner" or "User Access Administrator" role
az role assignment create \
  --assignee "$SP_OBJECT_ID" \
  --role "User Access Administrator" \
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# Check current SP permissions
az role assignment list --assignee "$SP_CLIENT_ID" --output table
```

______________________________________________________________________

### 🔹 Error: `Resource already exists in a different resource group`

```bash
# Resources like VNet peerings, DNS zones — check correct scope
# Use data source to reference existing resource
data "azurerm_virtual_network" "existing" {
  name                = "vnet-shared-prod"
  resource_group_name = "rg-shared-networking"   # correct RG!
}
```

______________________________________________________________________

### 🔹 Error: `Error: creating Key Vault: Code="VaultAlreadyExists"`

```bash
# Azure Key Vault names are globally unique AND soft-delete keeps them after destroy
az keyvault list-deleted --query "[].name" -o table
az keyvault recover --name "kv-payment-prod-abc123"   # recover it
# OR permanently purge if truly abandoned:
az keyvault purge --name "kv-payment-prod-abc123" --location "East US"
```

______________________________________________________________________

### 🔹 Error: `Storage account name too long or invalid`

```bash
# Storage accounts: 3-24 characters, lowercase letters and numbers only, globally unique
# Fix: Remove hyphens and check length
locals {
  sa_name = lower(substr(replace("st${var.project}${var.environment}${random_string.suffix.result}", "-", ""), 0, 24))
}
```

______________________________________________________________________

## 📌 3. State Recovery Scenarios

### 🔹 Scenario: Corrupted or accidentally deleted state

```bash
# If using Azure Blob backend — recover from versioning
# List versions of the state blob
az storage blob list \
  --account-name sttfstatemycompany \
  --container-name tfstate \
  --include v \
  --prefix "prod/payment.tfstate" \
  --query "[].{name:name, last_modified:properties.lastModified, version:versionId}" \
  -o table

# Download a previous version
az storage blob download \
  --account-name sttfstatemycompany \
  --container-name tfstate \
  --name "prod/payment.tfstate" \
  --version-id "2024-04-20T10:00:00Z" \
  --file recovered.tfstate

# Push the recovered state
terraform state push recovered.tfstate
```

______________________________________________________________________

### 🔹 Scenario: Resource deleted in Azure but still in state

```bash
# terraform plan shows: "will be created" for resource that was deleted manually
# Fix 1: Apply to re-create it (usually right answer)
terraform apply

# Fix 2: Remove from state (if you don't want Terraform to manage it)
terraform state rm azurerm_storage_account.main

# Fix 3: Refresh state first, then plan
terraform refresh
terraform plan
```

______________________________________________________________________

### 🔹 Scenario: Rename a resource without destroying it

```bash
# You renamed a resource block in your .tf file
# Terraform would destroy old + create new by default

# Fix: Move the state entry to match new name
terraform state mv \
  azurerm_resource_group.old_name \
  azurerm_resource_group.new_name

# Moved resource from module to root
terraform state mv \
  module.networking.azurerm_virtual_network.main \
  azurerm_virtual_network.main

# Moved resource from root to module
terraform state mv \
  azurerm_virtual_network.main \
  module.networking.azurerm_virtual_network.main

# After mv: run plan — should show 0 changes
terraform plan
```

______________________________________________________________________

### 🔹 Scenario: Import all resources from an existing Azure environment

```bash
#!/bin/bash
# import-existing.sh — bulk import existing Azure resources
SUBSCRIPTION="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
RG="rg-payment-prod-eus"
BASE="/subscriptions/$SUBSCRIPTION/resourceGroups/$RG"

# Resource Group
terraform import azurerm_resource_group.main \
  "$BASE"

# Virtual Network
terraform import azurerm_virtual_network.main \
  "$BASE/providers/Microsoft.Network/virtualNetworks/vnet-payment-prod-eus"

# Subnets
for subnet in snet-aks snet-app snet-data; do
  terraform import "azurerm_subnet.subnets[\"$subnet\"]" \
    "$BASE/providers/Microsoft.Network/virtualNetworks/vnet-payment-prod-eus/subnets/$subnet"
done

# Key Vault
terraform import azurerm_key_vault.main \
  "$BASE/providers/Microsoft.KeyVault/vaults/kv-paymentprodeus"

# AKS
terraform import azurerm_kubernetes_cluster.main \
  "$BASE/providers/Microsoft.ContainerService/managedClusters/aks-payment-prod-eus"

echo "Import complete. Run terraform plan to verify."
terraform plan
```

______________________________________________________________________

## 📌 4. terraform taint (Deprecated — use -replace)

```bash
# Force a resource to be destroyed and recreated on next apply

# Old way (deprecated in Terraform 0.15.2)
terraform taint azurerm_linux_virtual_machine.app[0]
terraform taint "azurerm_subnet.subnets[\"snet-app\"]"

# New way (Terraform 1.0+)
terraform apply -replace=azurerm_linux_virtual_machine.app[0]
terraform apply -replace="azurerm_linux_virtual_machine.app[0]"

# Real-Time Scenario: VM is unhealthy, recreate it
terraform apply -replace="azurerm_linux_virtual_machine.app[0]" -auto-approve
```

______________________________________________________________________

## 📌 5. terraform console — Interactive Expression Testing

```bash
terraform console
# Opens an interactive REPL for testing expressions against your state

> var.environment
"dev"

> local.prefix
"payment-dev-eus"

> length(var.subnets)
3

> keys(var.subnets)
["snet-aks", "snet-app", "snet-data"]

> cidrhost("10.0.0.0/16", 10)
"10.0.0.10"

> formatdate("YYYY-MM-DD", timestamp())
"2024-04-22"

> merge({"a" = 1}, {"b" = 2})
{"a" = 1, "b" = 2}

> [for s in var.subnets : s.address_prefixes[0]]
["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]

# Reference a real resource from state
> azurerm_resource_group.main.id
"/subscriptions/xxx/resourceGroups/rg-payment-dev-eus"

# Exit
> exit
```

______________________________________________________________________

## 📌 6. terraform graph — Visualize Dependencies

```bash
# Generate dependency graph (DOT format)
terraform graph | dot -Tsvg > graph.svg
terraform graph -type=plan | dot -Tpng > plan-graph.png
terraform graph -type=apply | dot -Tpdf > apply-graph.pdf

# Install graphviz
sudo apt install graphviz
```

______________________________________________________________________

## 📌 7. Upgrading Provider Versions

```bash
# Check current provider versions
terraform version
cat .terraform.lock.hcl

# Check latest available
terraform providers
# Upgrade a specific provider
terraform init -upgrade
# This updates .terraform.lock.hcl to newer versions allowed by constraints

# After upgrade: always review and test
terraform validate
terraform plan
# Check for deprecated attributes in plan output
# e.g.: "azurerm_storage_account.https_traffic_only is deprecated, use https_traffic_only_enabled"

# Fix deprecated attributes
# OLD:
# https_traffic_only = true
# NEW:
# https_traffic_only_enabled = true
```

______________________________________________________________________

## 📌 8. Quick Diagnostic Checklist

```
Terraform apply failing?

□ terraform validate — is the HCL valid?
□ terraform fmt -check — is it formatted?
□ terraform init — are providers initialized?
□ Check TF_LOG=DEBUG for detailed error
□ Check ARM_* env vars are set correctly
□ Check SP has correct Azure RBAC permissions
□ Check if resource name is globally unique (KV, Storage, ACR)
□ Check if state lock is stuck
□ Check if resource was manually deleted (refresh state)
□ Check if provider version changed (breaking change)
□ Check if Azure region supports the resource SKU/feature
□ Check Azure subscription has the required resource provider registered

Resource provider not registered?
□ az provider register --namespace Microsoft.ContainerService
□ az provider register --namespace Microsoft.KeyVault
□ az provider register --namespace Microsoft.Sql
□ az provider list --query "[?registrationState=='NotRegistered'].namespace" -o table
```

______________________________________________________________________

## 📌 9. Emergency Commands

```bash
# "State is broken" toolkit:
terraform state pull > backup-$(date +%Y%m%d).tfstate  # ALWAYS backup first
terraform state list                      # see what's tracked
terraform state show <resource>           # inspect a resource
terraform state rm <resource>             # remove without destroying
terraform state mv old new                # rename in state
terraform import <resource> <azure-id>    # add existing resource
terraform force-unlock <lock-id>          # break stuck lock
terraform state push backup.tfstate       # restore state from backup
terraform apply -replace=<resource>       # force recreate one resource
terraform apply -target=<resource>        # apply only one resource
terraform plan -destroy -target=<resource>  # preview destroying one resource
```

______________________________________________________________________

## 📌 Summary Table

| Problem | Command |
|---------|---------|
| Enable debug logs | `export TF_LOG=DEBUG` |
| State lock stuck | `terraform force-unlock <id>` |
| Import existing resource | `terraform import <resource> <azure-id>` |
| Rename resource no destroy | `terraform state mv old new` |
| Remove from state (keep in Azure) | `terraform state rm <resource>` |
| Force recreate one resource | `terraform apply -replace=<resource>` |
| Apply only one resource | `terraform apply -target=<resource>` |
| Backup state | `terraform state pull > backup.tfstate` |
| Restore state | `terraform state push backup.tfstate` |
| Test expressions | `terraform console` |
| Reinitialize after backend change | `terraform init -reconfigure` |
| Upgrade providers | `terraform init -upgrade` |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
