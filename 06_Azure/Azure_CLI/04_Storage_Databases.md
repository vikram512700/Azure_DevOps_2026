# Azure CLI for DevOps - Part 4: Storage & Databases

## 1. Storage Accounts

```bash
# Scenario: Create storage for application artifacts and logs
az storage account create \
  -g rg-prod -n stprodartifacts2026 \
  --sku Standard_LRS --kind StorageV2 \
  --location eastus \
  --https-only true \
  --min-tls-version TLS1_2

# Get storage account keys
az storage account keys list -g rg-prod -n stprodartifacts2026 --output table

# Get connection string (for app config)
az storage account show-connection-string -g rg-prod -n stprodartifacts2026 -o tsv
```

## 2. Blob Storage

```bash
# Create container
az storage container create -n build-artifacts \
  --account-name stprodartifacts2026

# Scenario: Upload build artifact to blob storage
az storage blob upload \
  --account-name stprodartifacts2026 \
  --container-name build-artifacts \
  --file ./app-v2.1.tar.gz \
  --name releases/v2.1/app-v2.1.tar.gz

# Upload entire directory
az storage blob upload-batch \
  --account-name stprodartifacts2026 \
  --destination build-artifacts \
  --source ./dist/ --pattern "*.js"

# Download blob
az storage blob download \
  --account-name stprodartifacts2026 \
  --container-name build-artifacts \
  --name releases/v2.1/app-v2.1.tar.gz \
  --file ./downloaded-app.tar.gz

# List blobs
az storage blob list \
  --account-name stprodartifacts2026 \
  --container-name build-artifacts --output table

# Generate SAS token (time-limited access)
# Scenario: Give contractor temporary download access
az storage blob generate-sas \
  --account-name stprodartifacts2026 \
  --container-name build-artifacts \
  --name releases/v2.1/app-v2.1.tar.gz \
  --permissions r --expiry 2026-04-30T00:00:00Z \
  --https-only -o tsv

# Enable static website hosting
az storage blob service-properties update \
  --account-name stprodartifacts2026 \
  --static-website --index-document index.html \
  --404-document 404.html
```

## 3. File Shares

```bash
# Scenario: Shared config/log storage for VMs
az storage share-rm create \
  -g rg-prod --storage-account stprodartifacts2026 \
  -n shared-configs --quota 50

# Upload file
az storage file upload \
  --account-name stprodartifacts2026 \
  --share-name shared-configs \
  --source ./nginx.conf --path configs/nginx.conf
```

## 4. Azure SQL Database

```bash
# Create SQL Server
az sql server create \
  -g rg-prod -n sqlsrv-prod-2026 \
  --admin-user sqladmin \
  --admin-password 'Str0ngP@ss!' \
  --location eastus

# Create Database
# Scenario: Production database for e-commerce app
az sql db create \
  -g rg-prod -s sqlsrv-prod-2026 \
  -n db-ecommerce \
  --service-objective S2 \
  --zone-redundant false

# Configure firewall rules
# Allow Azure services
az sql server firewall-rule create \
  -g rg-prod -s sqlsrv-prod-2026 \
  -n AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

# Allow office IP
az sql server firewall-rule create \
  -g rg-prod -s sqlsrv-prod-2026 \
  -n AllowOffice \
  --start-ip-address 203.0.113.10 --end-ip-address 203.0.113.10

# List databases
az sql db list -g rg-prod -s sqlsrv-prod-2026 --output table

# Scale database
az sql db update -g rg-prod -s sqlsrv-prod-2026 -n db-ecommerce \
  --service-objective S3

# Create a copy for testing
az sql db copy -g rg-prod -s sqlsrv-prod-2026 -n db-ecommerce \
  --dest-name db-ecommerce-test --dest-resource-group rg-dev
```

## 5. Azure Database for PostgreSQL

```bash
# Scenario: PostgreSQL for microservices backend
az postgres flexible-server create \
  -g rg-prod -n pgsrv-prod-2026 \
  --admin-user pgadmin --admin-password 'Str0ngP@ss!' \
  --sku-name Standard_D2s_v3 --tier GeneralPurpose \
  --storage-size 128 --version 15 \
  --location eastus

# Create database
az postgres flexible-server db create \
  -g rg-prod -s pgsrv-prod-2026 -d app_production

# Configure firewall
az postgres flexible-server firewall-rule create \
  -g rg-prod -n pgsrv-prod-2026 \
  --rule-name AllowDevMachine \
  --start-ip-address 203.0.113.10 --end-ip-address 203.0.113.10

# Show connection info
az postgres flexible-server show -g rg-prod -n pgsrv-prod-2026 \
  --query "{Host:fullyQualifiedDomainName, Admin:administratorLogin}" -o table
```

## 6. Azure Cosmos DB

```bash
# Scenario: NoSQL database for high-throughput user sessions
az cosmosdb create \
  -g rg-prod -n cosmos-prod-2026 \
  --kind GlobalDocumentDB \
  --default-consistency-level Session \
  --locations regionName=eastus failoverPriority=0 \
  --locations regionName=westus failoverPriority=1

# Create database and container
az cosmosdb sql database create \
  -a cosmos-prod-2026 -g rg-prod -n SessionDB

az cosmosdb sql container create \
  -a cosmos-prod-2026 -g rg-prod -d SessionDB \
  -n Sessions -p /userId --throughput 400

# Get connection keys
az cosmosdb keys list -g rg-prod -n cosmos-prod-2026 --output table
```

## 7. Azure Cache for Redis

```bash
# Scenario: Caching layer for API responses
az redis create \
  -g rg-prod -n redis-prod-2026 \
  --sku Standard --vm-size C1 \
  --location eastus --enable-non-ssl-port false

# Get connection keys
az redis list-keys -g rg-prod -n redis-prod-2026

# Show Redis info
az redis show -g rg-prod -n redis-prod-2026 \
  --query "{Host:hostName, Port:sslPort, Status:provisioningState}" -o table
```
