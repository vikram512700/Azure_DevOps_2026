# ☁️ Azure CLI for DevOps - Part 6: CI/CD, DevOps & App Services

## 📌 1. Azure DevOps CLI

```bash
# Install DevOps extension
az extension add --name azure-devops

# Login & configure defaults
az devops configure --defaults organization=https://dev.azure.com/myorg project=MyProject

# Create a new project
az devops project create --name "ECommerce-Platform" --visibility private

# List projects
az devops project list --output table

# Create a repository
az repos create --name "backend-api"

# List repos
az repos list --output table

# Create a pipeline
az pipelines create \
  --name "Build-Deploy-API" \
  --repository backend-api \
  --branch main \
  --yml-path azure-pipelines.yml

# Run a pipeline
az pipelines run --name "Build-Deploy-API" --branch main

# List pipeline runs
az pipelines runs list --output table

# Create variable group
# Scenario: Store shared config across pipelines
az pipelines variable-group create \
  --name "Production-Config" \
  --variables API_URL=https://api.myapp.com DB_HOST=dbserver.database.azure.com

# Create service connection
az devops service-endpoint azurerm create \
  --azure-rm-service-principal-id <sp-id> \
  --azure-rm-subscription-id <sub-id> \
  --azure-rm-tenant-id <tenant-id> \
  --name "Azure-Production"
```

## 📌 2. Azure App Service

```bash
# Create App Service Plan
az appservice plan create \
  -g rg-prod -n plan-prod \
  --sku P1v3 --is-linux

# Create Web App
# Scenario: Deploy Node.js API
az webapp create \
  -g rg-prod -p plan-prod \
  -n myapp-api-prod \
  --runtime "NODE:18-lts"

# Deploy from GitHub
az webapp deployment source config \
  -g rg-prod -n myapp-api-prod \
  --repo-url https://github.com/myorg/backend-api \
  --branch main --manual-integration

# Deploy from local zip
az webapp deploy \
  -g rg-prod -n myapp-api-prod \
  --src-path ./dist.zip --type zip

# Deploy from ACR container
az webapp create \
  -g rg-prod -p plan-prod \
  -n myapp-api-prod \
  --deployment-container-image-name acrprod2026.azurecr.io/api:latest

# Configure app settings (environment variables)
az webapp config appsettings set \
  -g rg-prod -n myapp-api-prod \
  --settings NODE_ENV=production DB_HOST=dbserver.database.azure.com \
  API_KEY=@Microsoft.KeyVault(SecretUri=https://kv-prod.vault.azure.net/secrets/api-key)

# Configure connection strings
az webapp config connection-string set \
  -g rg-prod -n myapp-api-prod \
  --connection-string-type SQLAzure \
  --settings DefaultConnection="Server=tcp:sqlsrv.database.windows.net;Database=mydb;"

# Show app settings
az webapp config appsettings list -g rg-prod -n myapp-api-prod --output table

# Scale up (change SKU)
az appservice plan update -g rg-prod -n plan-prod --sku P2v3

# Scale out (add instances)
az webapp scale -g rg-prod -n myapp-api-prod --instance-count 3

# Enable logging
az webapp log config \
  -g rg-prod -n myapp-api-prod \
  --application-logging filesystem --level information \
  --web-server-logging filesystem

# Stream live logs
az webapp log tail -g rg-prod -n myapp-api-prod
```

## 📌 3. Deployment Slots (Blue-Green Deployment)

```bash
# Scenario: Zero-downtime deployment using slots
# Create staging slot
az webapp deployment slot create \
  -g rg-prod -n myapp-api-prod -s staging

# Deploy to staging
az webapp deploy \
  -g rg-prod -n myapp-api-prod -s staging \
  --src-path ./dist.zip --type zip

# Test staging slot
# https://myapp-api-prod-staging.azurewebsites.net

# Swap staging to production
az webapp deployment slot swap \
  -g rg-prod -n myapp-api-prod \
  --slot staging --target-slot production

# Rollback - swap back
az webapp deployment slot swap \
  -g rg-prod -n myapp-api-prod \
  --slot production --target-slot staging

# Configure slot-specific settings (sticky settings)
az webapp config appsettings set \
  -g rg-prod -n myapp-api-prod -s staging \
  --slot-settings SLOT_NAME=staging
```

## 📌 4. Azure Functions

```bash
# Create Function App
az functionapp create \
  -g rg-prod -n func-order-processor \
  --storage-account stprodartifacts2026 \
  --consumption-plan-location eastus \
  --runtime node --runtime-version 18 \
  --functions-version 4

# Deploy function code
az functionapp deployment source config-zip \
  -g rg-prod -n func-order-processor \
  --src ./function-app.zip

# Configure app settings
az functionapp config appsettings set \
  -g rg-prod -n func-order-processor \
  --settings QUEUE_CONNECTION="..." MAX_RETRIES=3

# Show function app details
az functionapp show -g rg-prod -n func-order-processor --output table

# List functions
az functionapp function list -g rg-prod -n func-order-processor --output table
```

## 📌 5. Azure Key Vault

```bash
# Create Key Vault
az keyvault create \
  -g rg-prod -n kv-prod-2026 \
  --location eastus --sku standard \
  --enable-rbac-authorization

# Store secrets
# Scenario: Store database password, API keys
az keyvault secret set \
  --vault-name kv-prod-2026 \
  --name "db-password" \
  --value "SuperS3cret!"

az keyvault secret set \
  --vault-name kv-prod-2026 \
  --name "api-key" \
  --value "sk-abc123xyz"

# Get secret value
az keyvault secret show \
  --vault-name kv-prod-2026 --name "db-password" \
  --query value -o tsv

# List secrets
az keyvault secret list --vault-name kv-prod-2026 --output table

# Create certificate
az keyvault certificate create \
  --vault-name kv-prod-2026 \
  --name ssl-cert \
  --policy "$(az keyvault certificate get-default-policy)"

# Import PFX certificate
az keyvault certificate import \
  --vault-name kv-prod-2026 \
  --name imported-cert \
  --file ./cert.pfx --password "certpass"

# Set access policy
az keyvault set-policy \
  --name kv-prod-2026 \
  --object-id <app-object-id> \
  --secret-permissions get list

# Soft-delete and purge
az keyvault secret delete --vault-name kv-prod-2026 --name old-secret
az keyvault secret purge --vault-name kv-prod-2026 --name old-secret
```

## 📌 6. Azure Container Apps

```bash
# Scenario: Serverless container hosting for microservices
az containerapp env create \
  -g rg-prod -n cae-prod \
  --location eastus

az containerapp create \
  -g rg-prod -n ca-api \
  --environment cae-prod \
  --image acrprod2026.azurecr.io/api:latest \
  --registry-server acrprod2026.azurecr.io \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 --max-replicas 10 \
  --cpu 0.5 --memory 1.0Gi \
  --env-vars "NODE_ENV=production"

# Update container app with new image
az containerapp update \
  -g rg-prod -n ca-api \
  --image acrprod2026.azurecr.io/api:v2.0

# Create revision (traffic splitting)
az containerapp revision copy \
  -g rg-prod -n ca-api \
  --image acrprod2026.azurecr.io/api:v3.0

# Split traffic (canary deployment)
az containerapp ingress traffic set \
  -g rg-prod -n ca-api \
  --revision-weight ca-api--v2=80 ca-api--v3=20

# Scale rules (KEDA-based)
az containerapp update \
  -g rg-prod -n ca-api \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
