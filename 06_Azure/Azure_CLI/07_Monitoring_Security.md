# ☁️ Azure CLI for DevOps - Part 7: Monitoring, Security & IAM

## 📌 1. Azure Monitor & Log Analytics

```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  -g rg-prod -n law-prod --location eastus --sku PerGB2018

# Scenario: Query logs to find errors in last 24 hours
az monitor log-analytics query \
  --workspace <workspace-id> \
  --analytics-query "AppExceptions | where TimeGenerated > ago(24h) | summarize count() by type | order by count_ desc" \
  --output table

# Create alert rule
# Scenario: Alert when CPU > 90% for 5 minutes
az monitor metrics alert create \
  -g rg-prod -n alert-high-cpu \
  --scopes /subscriptions/.../resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/web-01 \
  --condition "avg Percentage CPU > 90" \
  --window-size 5m --evaluation-frequency 1m \
  --action /subscriptions/.../actionGroups/ops-team \
  --description "High CPU on web-01" --severity 2

# Create action group (email + webhook)
az monitor action-group create \
  -g rg-prod -n ops-team \
  --short-name OpsTeam \
  --email-receiver name=oncall email=oncall@company.com \
  --webhook-receiver name=slack uri=https://hooks.slack.com/services/xxx

# Application Insights
az monitor app-insights component create \
  -g rg-prod -a appi-prod --location eastus \
  --workspace /subscriptions/.../workspaces/law-prod

# Get instrumentation key
az monitor app-insights component show \
  -g rg-prod -a appi-prod \
  --query instrumentationKey -o tsv

# Query App Insights
az monitor app-insights query \
  --app appi-prod -g rg-prod \
  --analytics-query "requests | where resultCode >= 500 | summarize count() by name"
```

## 📌 2. Diagnostic Settings

```bash
# Scenario: Send VM metrics and logs to Log Analytics
az monitor diagnostic-settings create \
  --name diag-web-01 \
  --resource /subscriptions/.../virtualMachines/web-01 \
  --workspace /subscriptions/.../workspaces/law-prod \
  --metrics '[{"category":"AllMetrics","enabled":true}]' \
  --logs '[{"category":"Administrative","enabled":true}]'

# List diagnostic settings
az monitor diagnostic-settings list \
  --resource /subscriptions/.../virtualMachines/web-01 --output table
```

## 📌 3. Azure RBAC (Role-Based Access Control)

```bash
# List built-in roles
az role definition list --output table
az role definition list --query "[?contains(roleName,'Contributor')]" -o table

# Assign role
# Scenario: Give developer read-only access to production
az role assignment create \
  --assignee user@company.com \
  --role "Reader" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-prod

# Scenario: Give CI/CD service principal deployment access
az role assignment create \
  --assignee <service-principal-id> \
  --role "Contributor" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-prod

# AKS-specific role
az role assignment create \
  --assignee <sp-id> \
  --role "Azure Kubernetes Service Cluster User Role" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-prod/providers/Microsoft.ContainerService/managedClusters/aks-prod

# List role assignments
az role assignment list --resource-group rg-prod --output table

# Create custom role
# Scenario: Allow only VM restart (for L1 support team)
az role definition create --role-definition '{
  "Name": "VM Restarter",
  "Description": "Can restart virtual machines only",
  "Actions": [
    "Microsoft.Compute/virtualMachines/restart/action",
    "Microsoft.Compute/virtualMachines/read"
  ],
  "AssignableScopes": ["/subscriptions/<sub-id>"]
}'

# Remove role assignment
az role assignment delete \
  --assignee user@company.com \
  --role "Reader" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-prod
```

## 📌 4. Service Principals & Managed Identities

```bash
# Create service principal for CI/CD
# Scenario: GitHub Actions needs to deploy to Azure
az ad sp create-for-rbac \
  --name "sp-github-actions" \
  --role Contributor \
  --scopes /subscriptions/<sub-id>/resourceGroups/rg-prod \
  --json-auth
# Output: JSON with clientId, clientSecret, tenantId (use in GitHub secrets)

# Reset credentials
az ad sp credential reset --id <app-id>

# List service principals
az ad sp list --show-mine --output table

# Create user-assigned managed identity
az identity create -g rg-prod -n mi-webapp-prod

# Assign managed identity to a VM
az vm identity assign \
  -g rg-prod -n web-01 \
  --identities mi-webapp-prod

# Give managed identity access to Key Vault
az keyvault set-policy \
  --name kv-prod-2026 \
  --object-id $(az identity show -g rg-prod -n mi-webapp-prod --query principalId -o tsv) \
  --secret-permissions get list
```

## 📌 5. Azure Policy

```bash
# List policy definitions
az policy definition list --query "[?policyType=='BuiltIn']" --output table

# Scenario: Enforce tagging on all resources
az policy assignment create \
  --name "require-cost-center-tag" \
  --policy "/providers/Microsoft.Authorization/policyDefinitions/1e30110a-5ceb-460c-a204-c1c3969c6d62" \
  --scope /subscriptions/<sub-id> \
  --params '{"tagName":{"value":"CostCenter"}}'

# Scenario: Deny creation of VMs larger than D4
az policy assignment create \
  --name "restrict-vm-sizes" \
  --policy "/providers/Microsoft.Authorization/policyDefinitions/cccc23c7-8427-4f53-ad12-b6a63eb452b3" \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-dev \
  --params '{"listOfAllowedSKUs":{"value":["Standard_B1s","Standard_B2s","Standard_D2s_v3","Standard_D4s_v3"]}}'

# Check compliance
az policy state list \
  --policy-assignment "require-cost-center-tag" \
  --query "[?complianceState=='NonCompliant'].{Resource:resourceId}" -o table
```

## 📌 6. Azure Locks

```bash
# Scenario: Prevent accidental deletion of production resources
az lock create \
  --name "protect-prod-rg" \
  --resource-group rg-prod \
  --lock-type CanNotDelete \
  --notes "Production resource group - do not delete"

# Read-only lock (prevent any changes)
az lock create \
  --name "readonly-prod-db" \
  --resource-group rg-prod \
  --resource-name sqlsrv-prod --resource-type Microsoft.Sql/servers \
  --lock-type ReadOnly

# List locks
az lock list --resource-group rg-prod --output table

# Delete lock (when maintenance needed)
az lock delete --name "readonly-prod-db" --resource-group rg-prod
```

## 📌 7. Activity Log & Audit

```bash
# Scenario: Who deleted the VM last week?
az monitor activity-log list \
  --resource-group rg-prod \
  --start-time 2026-04-15 --end-time 2026-04-22 \
  --query "[?operationName.value=='Microsoft.Compute/virtualMachines/delete'].{Caller:caller, Time:eventTimestamp, Status:status.value}" \
  --output table

# All write operations in last 24h
az monitor activity-log list \
  --start-time $(date -d '-1 day' +%Y-%m-%dT%H:%M:%SZ) \
  --query "[?category.value=='Administrative' && level=='Warning'].{Op:operationName.localizedValue, Who:caller, When:eventTimestamp}" \
  --output table
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
