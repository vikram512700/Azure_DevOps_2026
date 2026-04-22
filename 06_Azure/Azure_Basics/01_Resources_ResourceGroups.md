# 📦 Azure Resources, Resource Groups & Resource Manager

### 🎯 For DevOps Beginners — Simple Notes with Real Examples

______________________________________________________________________

## 📌 1️⃣ What is an Azure Resource?

> 💡 **Think of it like this:**\
> When you go to a store and buy a laptop, that laptop is your **resource**.\
> In Azure — anything you create (VM, database, storage) is called a **Resource**.

### 🔹 Common Azure Resources:

| What you need | Azure Resource |
|---------------|----------------|
| A computer/server | Virtual Machine (VM) |
| A database | Azure SQL / PostgreSQL |
| File storage | Storage Account |
| A private network | Virtual Network (VNet) |
| Secret/password storage | Key Vault |
| A web app host | App Service |

### 🏗️ Real Example:

You are a DevOps Engineer deploying an **online shopping app**.\
You need to create these resources:

```
🖥️  VM             → runs your app code
🗄️  SQL Database   → stores products, orders
🪣  Storage        → stores product images
🔒  Key Vault      → stores DB password safely
🌐  Virtual Network → connects everything privately
```

Each one of those = **an Azure Resource**

______________________________________________________________________

## 📌 2️⃣ What is a Resource Group?

> 💡 **Think of it like this:**\
> A Resource Group is like a **folder** on your desktop.\
> Instead of files, it holds your Azure resources.

```
📁 Resource Group: rg-shopping-app-prod
   ├── 🖥️  VM: web-server-01
   ├── 🗄️  SQL DB: shopping-db
   ├── 🪣  Storage: stshoppingimages
   ├── 🔒  Key Vault: kv-shopping-prod
   └── 🌐  VNet: vnet-shopping-prod
```

### 🔹 Why do we use Resource Groups?

| Reason | Real Scenario |
|--------|---------------|
| 📦 **Group related things** | All resources for one app in one group |
| 🗑️ **Delete all at once** | Delete test environment → delete the whole RG |
| 💰 **Track costs** | See how much the "shopping app" costs in total |
| 🔐 **Control access** | Give dev team access only to dev RG |
| 🏷️ **Tag for billing** | Tag RG with `CostCenter=CC100` |

### 🌍 Real-World Pattern — One RG per Environment:

```
📁 rg-shopping-dev      ← developers test here
📁 rg-shopping-staging  ← QA team tests here
📁 rg-shopping-prod     ← real users go here
```

### ⚡ CLI Commands (Practice These!):

```bash
# Create a Resource Group
az group create \
  --name rg-shopping-prod \
  --location eastus

# List all your Resource Groups
az group list --output table

# See everything inside a Resource Group
az resource list \
  --resource-group rg-shopping-prod \
  --output table

# Add tags to a Resource Group (for billing/tracking)
az group update \
  --name rg-shopping-prod \
  --tags Environment=Production Team=Backend CostCenter=CC100

# ⚠️ Delete entire Resource Group (deletes EVERYTHING inside!)
# Useful: tear down test environment completely
az group delete --name rg-shopping-dev --yes --no-wait
```

### ⚠️ Important Rules:

- A resource can only belong to **ONE** resource group
- Resources can be in **different regions** than the resource group
- You **cannot nest** resource groups

______________________________________________________________________

## 📌 3️⃣ Azure Resource Manager (ARM)

> 💡 **Think of it like this:**\
> ARM is like the **receptionist at Azure's front desk**.\
> Every request you make (from portal, CLI, Terraform) goes through ARM first.\
> ARM checks → "Who are you? Are you allowed? OK go ahead."

### 🔹 How ARM Works (Flow Diagram):

```
You
 │
 ├── Azure Portal (browser)
 ├── Azure CLI (az command)
 ├── Terraform / Bicep
 └── REST API / SDK
         │
         ↓
┌─────────────────────────┐
│   Azure Resource Manager│  ← ALL requests go here
│   - Authenticate user   │
│   - Check permissions   │
│   - Validate request    │
│   - Route to service    │
└─────────────────────────┘
         │
         ↓
   Azure Services
   (VM, DB, Storage...)
```

### 🔹 What ARM Gives You:

| Feature | What it means | Example |
|---------|--------------|---------|
| 🔐 **Auth** | Who are you? | Azure AD login |
| ✅ **RBAC** | What can you do? | Only read? Or also create? |
| 📝 **Templates** | Deploy infra as code | ARM Templates / Bicep |
| 🏷️ **Tagging** | Label resources | `Env=Prod`, `Team=Backend` |
| 🔒 **Locks** | Prevent accidents | Can't delete prod DB |
| 🔄 **Deployment History** | What was deployed when | See last 10 deployments |

### 📝 ARM Template — Simple Example:

> ARM template = JSON file that describes what to create

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2021-04-01",
      "name": "stshoppingimages",
      "location": "eastus",
      "sku": { "name": "Standard_LRS" },
      "kind": "StorageV2"
    }
  ]
}
```

```bash
# Deploy ARM template (create resources from JSON file)
az deployment group create \
  --resource-group rg-shopping-prod \
  --template-file azuredeploy.json

# Preview BEFORE deploying — dry run (safe!)
az deployment group what-if \
  --resource-group rg-shopping-prod \
  --template-file azuredeploy.json
```

### 🔒 Resource Locks — Protect Important Resources:

```bash
# Prevent production RG from being accidentally deleted
az lock create \
  --name "no-delete-prod" \
  --resource-group rg-shopping-prod \
  --lock-type CanNotDelete

# ReadOnly lock — nobody can change the DB (e.g. during audit)
az lock create \
  --name "freeze-db" \
  --resource-group rg-shopping-prod \
  --resource-name shopping-db \
  --resource-type Microsoft.Sql/servers \
  --lock-type ReadOnly

# List all locks
az lock list --resource-group rg-shopping-prod --output table

# Remove lock (when you need to do maintenance)
az lock delete \
  --name "freeze-db" \
  --resource-group rg-shopping-prod
```

______________________________________________________________________

## 🧠 Summary — Remember These 3 Things

```
Resource       = Individual service (VM, DB, Storage...)
                 Like a single item you bought

Resource Group = Container for related resources
                 Like a folder holding those items

ARM            = Azure's control plane
                 Like a reception desk — all requests go through it
```

## ✅ Quick Quiz (Answer in your head)

1. You built a test app and want to delete ALL its Azure resources at once. What do you delete?

   > **Answer**: Delete the Resource Group 🗑️

1. Your Terraform/CLI command creates a VM — what Azure component processes that request?

   > **Answer**: Azure Resource Manager (ARM) ✅

1. You want junior devs to see resources but not delete them. What do you use?

   > **Answer**: RBAC Role = `Reader` 🔐

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
