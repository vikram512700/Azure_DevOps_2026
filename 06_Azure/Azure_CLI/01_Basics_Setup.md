# ☁️ Azure CLI for DevOps Engineers - Part 1: Basics & Setup

## 📌 1. Installation

```bash
# Windows (PowerShell)
winget install -e --id Microsoft.AzureCLI

# Ubuntu/Debian
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# macOS
brew install azure-cli

# Docker
docker run -it mcr.microsoft.com/azure-cli

# Verify installation
az --version
```

______________________________________________________________________

## 📌 2. Authentication & Login

### 🔹 Interactive Login

```bash
az login
```

### 🔹 Service Principal Login (CI/CD Pipelines)

```bash
# Real-time Scenario: Your Jenkins/GitHub Actions pipeline needs to deploy to Azure
az login --service-principal \
  --username <app-id> \
  --password <client-secret> \
  --tenant <tenant-id>
```

### 🔹 Managed Identity Login (From Azure VM/AKS)

```bash
# Real-time Scenario: App running inside Azure VM accessing Key Vault
az login --identity
```

### 🔹 Login with Device Code (Remote/SSH sessions)

```bash
az login --use-device-code
```

______________________________________________________________________

## 📌 3. Account & Subscription Management

```bash
# List all subscriptions
az account list --output table

# Set active subscription
# Scenario: You manage DEV, STAGING, PROD subscriptions
az account set --subscription "Production-Subscription"

# Show current subscription
az account show --output table

# List available regions
az account list-locations --output table
```

______________________________________________________________________

## 📌 4. Resource Groups

```bash
# Create resource group
# Scenario: Setting up infrastructure for a new microservice
az group create --name rg-ecommerce-prod --location eastus

# List all resource groups
az group list --output table

# Show details of a resource group
az group show --name rg-ecommerce-prod

# Delete resource group (CAREFUL - deletes everything inside)
# Scenario: Tearing down a test environment
az group delete --name rg-ecommerce-test --yes --no-wait

# List all resources in a group
az resource list --resource-group rg-ecommerce-prod --output table

# Tag a resource group
az group update --name rg-ecommerce-prod \
  --tags Environment=Production Team=Backend CostCenter=CC100
```

______________________________________________________________________

## 📌 5. Output Formats & Queries

```bash
# Table format (human readable)
az vm list --output table

# JSON format (default, for scripting)
az vm list --output json

# TSV format (for bash scripting)
az vm list --output tsv

# YAML format
az vm list --output yaml

# JMESPath Queries
# Scenario: Get only VM names and their power states
az vm list -d --query "[].{Name:name, State:powerState, RG:resourceGroup}" -o table

# Filter running VMs only
az vm list -d --query "[?powerState=='VM running'].{Name:name, IP:publicIps}" -o table

# Get a single value
az vm show -g myRG -n myVM --query "hardwareProfile.vmSize" -o tsv
```

______________________________________________________________________

## 📌 6. Azure CLI Configuration

```bash
# Set default resource group (avoid typing --resource-group every time)
az configure --defaults group=rg-ecommerce-prod

# Set default location
az configure --defaults location=eastus

# Set default output format
az configure --defaults output=table

# Clear defaults
az configure --defaults group='' location=''

# Enable/disable telemetry
az configure --collect-telemetry true
```

______________________________________________________________________

## 📌 7. CLI Extensions

```bash
# List installed extensions
az extension list --output table

# Add an extension
# Scenario: Need AKS preview features
az extension add --name aks-preview

# Update extension
az extension update --name aks-preview

# Remove extension
az extension remove --name aks-preview

# List available extensions
az extension list-available --output table
```

______________________________________________________________________

## 📌 8. Finding Help

```bash
# General help
az --help

# Help for a specific command group
az vm --help

# Help for a specific command
az vm create --help

# Find commands related to a topic
az find "create virtual machine"
az find "deploy container"
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
