# 🔐 Azure Entra ID, Subscriptions, Access & Billing

### 🎯 For DevOps Beginners — Who Are You? What Can You Do? Who Pays?

______________________________________________________________________

## 🗺️ The Big Picture First

> 💡 **Before anything else — understand this hierarchy:**

```
🏢 Azure AD / Entra ID (Tenant)
   = Your company's identity system
   = WHO you are
        │
        ▼
📋 Management Groups
   = Group multiple subscriptions
        │
        ▼
💳 Subscriptions
   = WHERE you create resources
   = HOW you pay
        │
        ▼
📁 Resource Groups
   = Logical folders for resources
        │
        ▼
⚙️  Resources (VMs, DBs, Storage...)
   = Actual services
```

> Think of it like a **company org chart**:
>
> - Entra ID = **HR department** (knows all employees)
> - Subscription = **Department budget** (who pays for what)
> - Resource Group = **Project folder** (what's in this project)
> - RBAC = **Job roles** (what each person is allowed to do)

______________________________________________________________________

## 📌 1️⃣ Azure Entra ID (formerly Azure Active Directory)

### 🔹 What is Azure Entra ID?

> 💡 **Think of it like your company's badge/ID system:**\
> When you enter an office building — you swipe your badge.\
> The system checks: "Is this person an employee? What floors can they access?"
>
> **Entra ID = Azure's badge system.**\
> It manages WHO can log into Azure and what they can access.

### 🔹 What Entra ID Manages:

| Object | What it is | Real Example |
|--------|-----------|--------------|
| **User** | A person | `vikram@company.com` |
| **Group** | A collection of users | `DevOps-Team`, `Dev-Readonly` |
| **Service Principal** | App/script identity | GitHub Actions deploying to Azure |
| **Managed Identity** | Azure resource identity | VM reading Key Vault secrets |
| **App Registration** | Your app in Entra | Your internal web app using SSO |

### 🔹 Key Terms:

| Term | Meaning |
|------|---------|
| **Tenant** | Your company's Entra ID instance |
| **Tenant ID** | Unique ID of your company in Azure |
| **Directory** | Another name for Tenant |
| **AAD / Entra ID** | Same thing — Microsoft renamed it in 2023 |

### 🔹 Create and Manage Users:

```bash
# Create a new user
az ad user create \
  --display-name "Vikram Dev" \
  --user-principal-name vikram@company.onmicrosoft.com \
  --password "TempP@ss2026!" \
  --force-change-password-next-sign-in true

# List all users
az ad user list --output table

# Get a specific user
az ad user show --id vikram@company.onmicrosoft.com

# Delete user
az ad user delete --id vikram@company.onmicrosoft.com
```

### 🔹 Create and Manage Groups:

```bash
# Create a group for DevOps team
az ad group create \
  --display-name "DevOps-Engineers" \
  --mail-nickname "devops-engineers"

# Add user to group
az ad group member add \
  --group "DevOps-Engineers" \
  --member-id $(az ad user show --id vikram@company.onmicrosoft.com --query id -o tsv)

# List group members
az ad group member list --group "DevOps-Engineers" --output table

# Check if user is in group
az ad group member check \
  --group "DevOps-Engineers" \
  --member-id $(az ad user show --id vikram@company.onmicrosoft.com --query id -o tsv)
```

______________________________________________________________________

## 📌 2️⃣ Service Principals & Managed Identities

### 🔹 What is a Service Principal?

> 💡 **A Service Principal = an identity for an app/script (not a human).**
>
> Real scenario:\
> Your **GitHub Actions** pipeline needs to deploy to Azure.\
> You can't give it YOUR login — that's insecure.\
> You create a **Service Principal** = a non-human account with limited access.

```
GitHub Actions
    ↓ uses
Service Principal (sp-github-deploy)
    ↓ has role
Contributor on rg-webapp-prod
    ↓ can
Deploy resources to that resource group
```

### 🔹 Create Service Principal for CI/CD:

```bash
# Create SP and give it Contributor role on a resource group
az ad sp create-for-rbac \
  --name "sp-github-actions" \
  --role Contributor \
  --scopes /subscriptions/<SUB_ID>/resourceGroups/rg-webapp-prod \
  --json-auth

# Output (save this in GitHub Secrets!):
# {
#   "clientId": "xxxx",
#   "clientSecret": "xxxx",
#   "subscriptionId": "xxxx",
#   "tenantId": "xxxx"
# }

# List service principals
az ad sp list --show-mine --output table

# Reset SP credentials (if secret expired)
az ad sp credential reset --id <app-id>

# Delete SP
az ad sp delete --id <app-id>
```

### 🔹 What is a Managed Identity?

> 💡 **Managed Identity = Service Principal, but Azure manages the password for you!**
>
> Problem with Service Principal:\
> ❌ You manage the secret/password\
> ❌ Secret can expire\
> ❌ Secret can leak in code
>
> Managed Identity:\
> ✅ Azure manages the secret automatically\
> ✅ Never expires\
> ✅ No secret in your code ever

### 🔹 Types of Managed Identity:

| Type | What it is | Example |
|------|-----------|---------|
| **System-assigned** | Tied to one resource, deleted with resource | VM's own identity |
| **User-assigned** | Standalone, reuse across resources | Shared identity for multiple VMs |

```bash
# Enable system-assigned identity on a VM
az vm identity assign \
  -g rg-webapp-prod \
  -n web-server-01

# Create user-assigned managed identity
az identity create \
  -g rg-webapp-prod \
  -n mi-app-identity

# Assign user-assigned identity to VM
az vm identity assign \
  -g rg-webapp-prod \
  -n web-server-01 \
  --identities mi-app-identity

# Give the identity permission to read Key Vault secrets
az keyvault set-policy \
  --name kv-prod-secrets \
  --object-id $(az identity show -g rg-webapp-prod -n mi-app-identity --query principalId -o tsv) \
  --secret-permissions get list
```

> 💡 **Real DevOps Use Case**:\
> Your app running on a VM needs to read database passwords from Key Vault.\
> ✅ Assign Managed Identity to VM → give it Key Vault access → app reads secrets automatically\
> ❌ NO hardcoded passwords in code or config files!

______________________________________________________________________

## 📌 3️⃣ Azure Subscriptions

### 🔹 What is a Subscription?

> 💡 **A Subscription = Your Azure account + billing account.**
>
> Think of it like a **prepaid SIM card**:
>
> - You have one SIM per phone plan
> - You create Azure resources under the subscription
> - Azure charges you based on what you use in that subscription

### 🔹 Why Have Multiple Subscriptions?

| Strategy | Subscriptions | Reason |
|----------|--------------|--------|
| **By environment** | Dev, Staging, Production | Isolate prod from test |
| **By team/project** | Payments-Team, HR-App, Marketing | Separate billing per team |
| **By region** | US-Sub, EU-Sub | Data residency requirements |
| **For limits** | When nearing subscription limits | Azure has per-sub limits |

### 🔹 Real Company Setup:

```
Contoso Ltd.
├── 💳 Sub: contoso-dev          → Dev/Test workloads
├── 💳 Sub: contoso-staging      → QA/UAT workloads  
├── 💳 Sub: contoso-prod         → Production workloads
├── 💳 Sub: contoso-shared-svcs  → DNS, Monitoring, Firewall
└── 💳 Sub: contoso-sandbox      → Developers free to experiment
```

### 🔹 Subscription CLI Commands:

```bash
# List all subscriptions you have access to
az account list --output table

# Switch to a specific subscription
az account set --subscription "contoso-prod"

# Show current active subscription
az account show --output table

# Get subscription ID
az account show --query id -o tsv

# List locations available
az account list-locations --output table
```

______________________________________________________________________

## 📌 4️⃣ Management Groups

### 🔹 What are Management Groups?

> 💡 **Management Groups = folders for subscriptions.**
>
> You have 20 subscriptions. You want to apply one policy across ALL of them.\
> Without Management Groups → apply policy 20 times\
> With Management Groups → apply policy ONCE at the top level, it flows down!

```
🌳 Root Management Group (Tenant Root)
├── 📁 MG: Production
│   ├── 💳 Sub: prod-webapp
│   └── 💳 Sub: prod-payments
├── 📁 MG: Non-Production
│   ├── 💳 Sub: dev-webapp
│   └── 💳 Sub: staging-webapp
└── 📁 MG: Sandbox
    └── 💳 Sub: sandbox-devs
```

### 🔹 CLI Commands:

```bash
# Create management group
az account management-group create \
  --name "mg-production" \
  --display-name "Production Workloads"

# Add subscription to management group
az account management-group subscription add \
  --name "mg-production" \
  --subscription <subscription-id>

# List management groups
az account management-group list --output table

# Show hierarchy
az account management-group show \
  --name "mg-production" \
  --expand --recurse
```

______________________________________________________________________

## 📌 5️⃣ RBAC — Role-Based Access Control (Who Can Do What?)

### 🔹 What is RBAC?

> 💡 **RBAC = Job roles for Azure.**
>
> In a company:
>
> - Junior Dev → can only READ code
> - Senior Dev → can read and WRITE code
> - DevOps Engineer → can deploy to prod
> - Manager → can approve and manage team
>
> **RBAC gives different Azure permissions based on job role.**

### 🔹 RBAC Formula:

```
WHO        +  WHAT ROLE      +  WHERE (scope)
(User/SP)     (permissions)     (Sub/RG/Resource)

Example:
vikram@company.com  +  Contributor  +  rg-webapp-prod
→ Vikram can create/edit/delete resources IN rg-webapp-prod ONLY
```

### 🔹 Most Important Built-in Roles:

| Role | What they CAN do | What they CANNOT do |
|------|-----------------|---------------------|
| **Owner** | Everything + manage access | - |
| **Contributor** | Create/edit/delete resources | ❌ Manage access |
| **Reader** | View everything | ❌ Create/edit/delete |
| **User Access Admin** | Manage who has access | ❌ Create resources |

### 🔹 Role Assignment Examples:

```bash
# Give a developer READ access to production (safe!)
az role assignment create \
  --assignee vikram@company.com \
  --role "Reader" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-webapp-prod

# Give DevOps team FULL access to dev RG
az role assignment create \
  --assignee "DevOps-Engineers" \
  --role "Contributor" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-webapp-dev

# Give CI/CD pipeline (Service Principal) access to deploy
az role assignment create \
  --assignee <service-principal-app-id> \
  --role "Contributor" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-webapp-prod

# Give someone access to a specific VM only (not entire RG)
az role assignment create \
  --assignee support@company.com \
  --role "Virtual Machine Contributor" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/web-server-01

# List who has access to a resource group
az role assignment list \
  --resource-group rg-webapp-prod \
  --output table

# Remove access
az role assignment delete \
  --assignee vikram@company.com \
  --role "Reader" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-webapp-prod
```

### 🔹 RBAC Scopes (Where you assign the role):

```
🌍 Management Group    ← applies to all subscriptions inside
   ↓ inherits down
💳 Subscription       ← applies to all RGs inside
   ↓ inherits down
📁 Resource Group     ← applies to all resources inside
   ↓ inherits down
⚙️  Resource          ← applies to just that resource
```

### 🔹 Create a Custom Role:

```bash
# Real Scenario: L1 Support — can only RESTART VMs, nothing else

az role definition create --role-definition '{
  "Name": "VM Restart Only",
  "Description": "Can restart virtual machines only. For L1 support team.",
  "Actions": [
    "Microsoft.Compute/virtualMachines/restart/action",
    "Microsoft.Compute/virtualMachines/read",
    "Microsoft.Resources/subscriptions/resourceGroups/read"
  ],
  "NotActions": [],
  "AssignableScopes": [
    "/subscriptions/<SUB_ID>"
  ]
}'

# Assign custom role
az role assignment create \
  --assignee l1-support@company.com \
  --role "VM Restart Only" \
  --scope /subscriptions/<SUB_ID>/resourceGroups/rg-webapp-prod
```

______________________________________________________________________

## 📌 6️⃣ Azure Policy — Enforce Rules Across Your Azure

> 💡 **Azure Policy = Rules that Azure enforces automatically.**
>
> Example:\
> "No one is allowed to create VMs without a `CostCenter` tag"\
> Even if someone has Contributor access — if they forget the tag, Azure BLOCKS it!

### 🔹 Real Policies Used by DevOps Teams:

| Policy | What it does |
|--------|-------------|
| Require tags | All resources must have `Environment` and `Team` tags |
| Allowed locations | Resources can only be created in East US |
| Allowed VM sizes | Only use B2s and D2s (block expensive ones) |
| Require HTTPS | Storage accounts must use HTTPS only |
| Audit public IPs | Alert if a resource gets a public IP |

### 🔹 Apply Policies:

```bash
# Scenario: Enforce "CostCenter" tag on all resources
az policy assignment create \
  --name "require-costcenter-tag" \
  --display-name "Require CostCenter Tag" \
  --policy "1e30110a-5ceb-460c-a204-c1c3969c6d62" \
  --scope /subscriptions/<SUB_ID> \
  --params '{"tagName": {"value": "CostCenter"}}'

# Scenario: Only allow East US and West US regions
az policy assignment create \
  --name "allowed-locations" \
  --policy "e56962a6-4747-49cd-b67b-bf8b01975c4f" \
  --scope /subscriptions/<SUB_ID> \
  --params '{"listOfAllowedLocations": {"value": ["eastus","westus"]}}'

# Check compliance
az policy state list \
  --resource-group rg-webapp-prod \
  --query "[?complianceState=='NonCompliant'].{Resource:resourceId, Policy:policyDefinitionName}" \
  --output table
```

______________________________________________________________________

## 📌 7️⃣ Azure Cost Management & Billing

### 🔹 How Azure Billing Works:

```
You create resources
       ↓
Azure measures usage (per hour / per GB / per request)
       ↓
At end of month → Azure generates INVOICE
       ↓
Invoice goes to your Subscription's billing account
       ↓
Payment via Credit Card / EA / Pay-as-you-go
```

### 🔹 What You Get Charged For:

| Resource | How You're Charged |
|----------|--------------------|
| VM (running) | Per hour (based on size) |
| VM (deallocated) | Only for disk storage |
| Storage | Per GB per month |
| Outbound Data | Per GB transferred out |
| SQL Database | Per DTU/vCore per hour |
| Load Balancer | Per hour + per GB |
| App Gateway | Per hour + per CU |

> 💡 **Free things**: Inbound data, resource groups, VNets, NSGs, resource tags

### 🔹 Check and Control Costs:

```bash
# View current month's cost per resource group
az consumption usage list \
  --start-date 2026-04-01 \
  --end-date 2026-04-22 \
  --query "[].{Resource:instanceName, Cost:pretaxCost, Currency:currency}" \
  --output table

# Create a Budget with Alert
# Scenario: Alert when monthly spend reaches 80% of $5000 limit
az consumption budget create \
  --budget-name "monthly-budget-prod" \
  --amount 5000 \
  --category Cost \
  --time-grain Monthly \
  --start-date 2026-04-01 \
  --end-date 2027-04-01 \
  --contact-emails "devops-lead@company.com" "finance@company.com"

# Find idle/wasted resources
# Unattached disks (paying for storage with no VM!)
az disk list \
  --query "[?managedBy==null].{Name:name, Size:diskSizeGb, RG:resourceGroup}" \
  --output table

# VMs that are stopped but NOT deallocated (still charging!)
az vm list -d \
  --query "[?powerState=='VM stopped'].{Name:name, RG:resourceGroup}" \
  --output table
```

### 🔹 Cost-Saving Tips for DevOps:

| Action | Savings |
|--------|---------|
| Deallocate (not stop) dev VMs at night | ~65% VM cost saving |
| Delete unattached disks | Eliminate waste |
| Use B-series VMs for dev | 40% cheaper than D-series |
| Use Reserved Instances for prod | Up to 72% discount (1-3 year commit) |
| Use Spot VMs for CI/CD agents | Up to 90% cheaper |
| Set budget alerts | No surprise bills |
| Tag resources for showback | Know which team spends what |

### 🔹 Tag Strategy for Billing:

```bash
# Tag resources so you can track costs per team/project
az resource tag \
  --ids $(az vm show -g rg-webapp-prod -n web-server-01 --query id -o tsv) \
  --tags Environment=Production Team=Backend CostCenter=CC100 Project=ECommerce

# Apply tags to entire resource group (tags do NOT auto-apply to resources)
az group update \
  --name rg-webapp-prod \
  --tags Environment=Production Team=Backend CostCenter=CC100

# View cost breakdown by tag in portal:
# Cost Management → Cost Analysis → Group by: Tag → CostCenter
```

______________________________________________________________________

## 🧠 Full Picture — How It All Connects

```
🏢 Azure Entra ID (Tenant)
   WHO: vikram@company.com, DevOps-Group, sp-github-actions
         │
         │  RBAC: "Who can do what in which scope"
         ▼
💳 Subscription (contoso-prod)
   BILLING: All costs billed here
   LIMITS: Resource quotas per subscription
         │
         ▼
📁 Resource Groups
   rg-webapp-prod  (tagged: CostCenter=CC100)
   rg-payments-prod (tagged: CostCenter=CC200)
         │
         ▼
⚙️  Resources (VMs, DBs, VNets...)
   Tagged → used for cost allocation reports
   Policy → enforces rules automatically
   Locks  → protects from accidental delete
```

______________________________________________________________________

## ✅ Quick Quiz

1. Your CI/CD pipeline (GitHub Actions) needs to deploy to Azure. What identity do you create?

   > **Answer**: Service Principal with Contributor role on the resource group 🤖

1. A VM needs to read secrets from Key Vault — without any hardcoded passwords. What do you use?

   > **Answer**: Managed Identity assigned to the VM + Key Vault access policy ✅

1. A junior developer accidentally deleted a production database. How do you prevent this?

   > **Answer**: Give them `Reader` role (not Contributor) + add `CanNotDelete` lock on the DB 🔒

1. You have 10 subscriptions and want to enforce "all VMs must have a CostCenter tag" across ALL of them at once. What do you use?

   > **Answer**: Azure Policy assigned at the Management Group level 📋

1. Your Azure bill is unexpectedly high this month. What are the first 3 things you check?

   > **Answer**:
   >
   > 1. Unattached disks (`az disk list`)
   > 1. VMs stopped but NOT deallocated
   > 1. Cost Management → Cost by Resource Group 💰

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
