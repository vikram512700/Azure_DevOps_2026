# ☁️ Azure CLI for DevOps - Part 8: Advanced & Real-Time Scripts

## 📌 1. Infrastructure as Code with CLI Scripts

### 🔹 Full Environment Setup Script

```bash
#!/bin/bash
# Scenario: Automated environment provisioning for new microservice
# Usage: ./setup-environment.sh <env> <service-name>

ENV=$1          # dev, staging, prod
SERVICE=$2      # e.g., order-service
LOCATION="eastus"
RG="rg-${SERVICE}-${ENV}"

echo "=== Creating $ENV environment for $SERVICE ==="

# Resource Group
az group create -n $RG -l $LOCATION --tags Environment=$ENV Service=$SERVICE

# Virtual Network
az network vnet create -g $RG -n "vnet-${ENV}" \
  --address-prefix 10.0.0.0/16 \
  --subnet-name "subnet-app" --subnet-prefix 10.0.1.0/24

# Key Vault
az keyvault create -g $RG -n "kv-${SERVICE}-${ENV}" -l $LOCATION

# Storage Account
STORAGE_NAME=$(echo "st${SERVICE}${ENV}" | tr -d '-' | cut -c1-24)
az storage account create -g $RG -n $STORAGE_NAME --sku Standard_LRS

# App Service
az appservice plan create -g $RG -n "plan-${ENV}" --sku B1 --is-linux
az webapp create -g $RG -p "plan-${ENV}" -n "${SERVICE}-${ENV}" --runtime "NODE:18-lts"

# Wire up Key Vault to App Service
az webapp config appsettings set -g $RG -n "${SERVICE}-${ENV}" \
  --settings KEYVAULT_URI="https://kv-${SERVICE}-${ENV}.vault.azure.net/"

echo "=== Environment $ENV ready for $SERVICE ==="
```

### 🔹 Environment Teardown Script

```bash
#!/bin/bash
# Scenario: Destroy test environment after testing
ENV=$1
SERVICE=$2
RG="rg-${SERVICE}-${ENV}"

echo "WARNING: Deleting resource group $RG and ALL its resources"
read -p "Are you sure? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
  az group delete -n $RG --yes --no-wait
  echo "Deletion initiated for $RG"
fi
```

## 📌 2. Cost Management Scripts

```bash
# Scenario: Get cost breakdown by resource group
az consumption usage list \
  --start-date 2026-04-01 --end-date 2026-04-22 \
  --query "[].{Resource:instanceName, Cost:pretaxCost, Currency:currency}" -o table

# Find and deallocate unused VMs (no CPU activity)
az vm list -d --query "[?powerState=='VM running']" -o tsv | while read line; do
  VM_NAME=$(echo $line | awk '{print $1}')
  RG=$(echo $line | awk '{print $2}')
  CPU=$(az monitor metrics list --resource "/subscriptions/.../virtualMachines/$VM_NAME" \
    --metric "Percentage CPU" --interval PT1H --aggregation Average \
    --query "value[0].timeseries[0].data[-1].average" -o tsv)
  if (( $(echo "$CPU < 5" | bc -l) )); then
    echo "IDLE VM: $VM_NAME (CPU: $CPU%) - consider deallocating"
  fi
done

# List all unattached disks (wasting money)
az disk list --query "[?managedBy==null].{Name:name, Size:diskSizeGb, RG:resourceGroup}" -o table

# Delete unattached disks
az disk list --query "[?managedBy==null].[id]" -o tsv | xargs -I {} az disk delete --ids {} --yes
```

## 📌 3. Disaster Recovery Scripts

```bash
# Scenario: Backup all Key Vault secrets
VAULT="kv-prod-2026"
mkdir -p ./vault-backup
az keyvault secret list --vault-name $VAULT --query "[].name" -o tsv | while read secret; do
  az keyvault secret backup --vault-name $VAULT --name "$secret" --file "./vault-backup/${secret}.bak"
  echo "Backed up: $secret"
done

# Restore secrets to DR vault
ls ./vault-backup/*.bak | while read file; do
  az keyvault secret restore --vault-name kv-dr-2026 --file "$file"
  echo "Restored: $file"
done

# Scenario: Failover Azure SQL to secondary region
az sql db replica create \
  -g rg-prod -s sqlsrv-prod \
  -n db-ecommerce \
  --partner-server sqlsrv-dr --partner-resource-group rg-dr

# Initiate failover
az sql db replica set-primary \
  -g rg-dr -s sqlsrv-dr -n db-ecommerce
```

## 📌 4. Multi-Subscription Management

```bash
# Scenario: Apply security baseline across all subscriptions
for SUB_ID in $(az account list --query "[].id" -o tsv); do
  echo "Processing subscription: $SUB_ID"
  az account set -s $SUB_ID

  # Enable Microsoft Defender for Cloud
  az security pricing create -n VirtualMachines --tier Standard
  az security pricing create -n SqlServers --tier Standard
  az security pricing create -n AppServices --tier Standard

  # Apply mandatory tags policy
  az policy assignment create \
    --name "require-tags" \
    --policy "require-tag-and-value" \
    --scope "/subscriptions/$SUB_ID"
done
```

## 📌 5. Terraform Backend Setup

```bash
# Scenario: Set up Azure backend for Terraform state
RG="rg-terraform-state"
STORAGE="stterraformstate2026"
CONTAINER="tfstate"

az group create -n $RG -l eastus
az storage account create -g $RG -n $STORAGE \
  --sku Standard_GRS --kind StorageV2 \
  --allow-blob-public-access false

az storage container create -n $CONTAINER --account-name $STORAGE

# Enable versioning for state file protection
az storage account blob-service-properties update \
  --account-name $STORAGE \
  --enable-versioning true

# Lock the resource group
az lock create -n "protect-tfstate" -g $RG --lock-type CanNotDelete

echo "Terraform backend config:"
echo "  resource_group_name  = \"$RG\""
echo "  storage_account_name = \"$STORAGE\""
echo "  container_name       = \"$CONTAINER\""
echo "  key                  = \"terraform.tfstate\""
```

## 📌 6. Health Check Script

```bash
#!/bin/bash
# Scenario: Daily infrastructure health check
echo "=== Azure Infrastructure Health Check ==="
echo "Date: $(date)"
echo ""

echo "--- VM Status ---"
az vm list -d --query "[].{Name:name, RG:resourceGroup, Status:powerState, Size:hardwareProfile.vmSize}" -o table

echo ""
echo "--- AKS Clusters ---"
az aks list --query "[].{Name:name, Status:provisioningState, K8sVersion:kubernetesVersion, Nodes:agentPoolProfiles[0].count}" -o table

echo ""
echo "--- App Services ---"
az webapp list --query "[].{Name:name, Status:state, URL:defaultHostName}" -o table

echo ""
echo "--- SQL Databases ---"
az sql db list --query "[].{Name:name, Status:status, Tier:currentServiceObjectiveName}" -o table 2>/dev/null

echo ""
echo "--- Expiring Secrets (next 30 days) ---"
VAULT="kv-prod-2026"
EXPIRY=$(date -d '+30 days' +%Y-%m-%dT%H:%M:%SZ)
az keyvault secret list --vault-name $VAULT \
  --query "[?attributes.expires < '$EXPIRY'].{Name:name, Expires:attributes.expires}" -o table

echo ""
echo "--- Resource Locks ---"
az lock list --query "[].{Name:name, Level:level, RG:resourceGroup}" -o table

echo "=== Health Check Complete ==="
```

## 📌 7. Quick Reference - Common DevOps Tasks

```bash
# SSH into Azure VM
az ssh vm -g rg-prod -n web-01

# Get public IP of a VM
az vm list-ip-addresses -g rg-prod -n web-01 --output table

# Download AKS kubeconfig for all clusters
for cluster in $(az aks list --query "[].name" -o tsv); do
  RG=$(az aks list --query "[?name=='$cluster'].resourceGroup" -o tsv)
  az aks get-credentials -g $RG -n $cluster --file ~/.kube/config-$cluster
done

# Export ARM template from existing resources
az group export -g rg-prod > arm-template-prod.json

# What-if deployment (dry run)
az deployment group what-if \
  -g rg-prod \
  --template-file main.bicep \
  --parameters @params.json

# Create budget alert
az consumption budget create \
  --amount 5000 --budget-name "monthly-limit" \
  --category Cost --time-grain Monthly \
  --start-date 2026-04-01 --end-date 2027-04-01

# Check resource provider registration
az provider list --query "[?registrationState=='Registered'].namespace" -o table

# Register a resource provider
az provider register --namespace Microsoft.ContainerService --wait
```

## 📌 8. Azure Bicep (IaC) with CLI

```bash
# Build Bicep to ARM
az bicep build --file main.bicep

# Deploy Bicep template
az deployment group create \
  -g rg-prod \
  --template-file main.bicep \
  --parameters environment=prod location=eastus

# Preview changes (what-if)
az deployment group what-if \
  -g rg-prod \
  --template-file main.bicep \
  --parameters environment=prod

# Subscription-level deployment
az deployment sub create \
  --location eastus \
  --template-file main.bicep

# Decompile ARM to Bicep
az bicep decompile --file template.json
```

______________________________________________________________________

## 📌 Quick Cheat Sheet

| Task | Command |
|------|---------|
| Login | `az login` |
| Set subscription | `az account set -s <name>` |
| Create resource group | `az group create -n <name> -l <location>` |
| Create VM | `az vm create -g <rg> -n <name> --image Ubuntu2204` |
| Create AKS | `az aks create -g <rg> -n <name> --node-count 3` |
| Deploy webapp | `az webapp deploy -g <rg> -n <name> --src-path app.zip` |
| Get secret | `az keyvault secret show --vault-name <kv> --name <secret>` |
| Assign role | `az role assignment create --assignee <user> --role <role>` |
| Stream logs | `az webapp log tail -g <rg> -n <name>` |
| Run on VM | `az vm run-command invoke -g <rg> -n <vm> --command-id RunShellScript --scripts "..."` |

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
