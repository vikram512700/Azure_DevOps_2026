# ☁️ Azure CLI for DevOps - Part 3: Networking

## 📌 1. Virtual Networks (VNet)

```bash
# Scenario: Create network for microservices architecture
az network vnet create \
  -g rg-prod \
  -n vnet-prod \
  --address-prefix 10.0.0.0/16 \
  --subnet-name subnet-web \
  --subnet-prefix 10.0.1.0/24

# Add more subnets
az network vnet subnet create \
  -g rg-prod --vnet-name vnet-prod \
  -n subnet-app --address-prefix 10.0.2.0/24

az network vnet subnet create \
  -g rg-prod --vnet-name vnet-prod \
  -n subnet-db --address-prefix 10.0.3.0/24

# List VNets
az network vnet list -g rg-prod --output table

# List subnets
az network vnet subnet list -g rg-prod --vnet-name vnet-prod --output table
```

## 📌 2. Network Security Groups (NSG)

```bash
# Scenario: Secure web tier - allow only HTTP/HTTPS/SSH
az network nsg create -g rg-prod -n nsg-web-tier

az network nsg rule create -g rg-prod --nsg-name nsg-web-tier \
  -n AllowHTTP --priority 100 --direction Inbound \
  --access Allow --protocol Tcp --destination-port-ranges 80

az network nsg rule create -g rg-prod --nsg-name nsg-web-tier \
  -n AllowHTTPS --priority 110 --direction Inbound \
  --access Allow --protocol Tcp --destination-port-ranges 443

az network nsg rule create -g rg-prod --nsg-name nsg-web-tier \
  -n AllowSSH --priority 120 --direction Inbound \
  --access Allow --protocol Tcp --destination-port-ranges 22 \
  --source-address-prefixes 203.0.113.0/24  # office IP range only

# Scenario: Block all inbound by default for DB tier
az network nsg create -g rg-prod -n nsg-db-tier
az network nsg rule create -g rg-prod --nsg-name nsg-db-tier \
  -n AllowAppSubnet --priority 100 --direction Inbound \
  --access Allow --protocol Tcp --destination-port-ranges 5432 \
  --source-address-prefixes 10.0.2.0/24

# Associate NSG with subnet
az network vnet subnet update \
  -g rg-prod --vnet-name vnet-prod -n subnet-web \
  --network-security-group nsg-web-tier

# List NSG rules
az network nsg rule list -g rg-prod --nsg-name nsg-web-tier --output table
```

## 📌 3. Public IP & Load Balancer

```bash
# Create public IP
az network public-ip create \
  -g rg-prod -n pip-lb-prod \
  --sku Standard --allocation-method Static

# Scenario: Create load balancer for web tier
az network lb create \
  -g rg-prod -n lb-web-prod \
  --sku Standard \
  --public-ip-address pip-lb-prod \
  --frontend-ip-name frontend-web \
  --backend-pool-name pool-web

# Health probe
az network lb probe create \
  -g rg-prod --lb-name lb-web-prod \
  -n health-http --protocol Http \
  --port 80 --path /health

# Load balancing rule
az network lb rule create \
  -g rg-prod --lb-name lb-web-prod \
  -n rule-http \
  --frontend-ip-name frontend-web \
  --backend-pool-name pool-web \
  --protocol Tcp --frontend-port 80 --backend-port 80 \
  --probe-name health-http

# NAT rule for SSH to specific VM
az network lb inbound-nat-rule create \
  -g rg-prod --lb-name lb-web-prod \
  -n ssh-vm1 --protocol Tcp \
  --frontend-port 50001 --backend-port 22 \
  --frontend-ip-name frontend-web
```

## 📌 4. Application Gateway (Layer 7 LB)

```bash
# Scenario: Path-based routing for microservices
az network application-gateway create \
  -g rg-prod -n appgw-prod \
  --sku Standard_v2 --capacity 2 \
  --vnet-name vnet-prod --subnet subnet-appgw \
  --public-ip-address pip-appgw \
  --http-settings-port 80 \
  --http-settings-protocol Http \
  --frontend-port 80

# Add URL path map
# /api/* -> backend API pool, /web/* -> frontend pool
az network application-gateway url-path-map create \
  -g rg-prod --gateway-name appgw-prod \
  -n urlpathmap \
  --paths "/api/*" \
  --address-pool pool-api \
  --http-settings api-settings \
  --default-address-pool pool-web \
  --default-http-settings web-settings
```

## 📌 5. VNet Peering

```bash
# Scenario: Connect Dev and Prod VNets
# Get VNet IDs
VNET_DEV_ID=$(az network vnet show -g rg-dev -n vnet-dev --query id -o tsv)
VNET_PROD_ID=$(az network vnet show -g rg-prod -n vnet-prod --query id -o tsv)

# Create peering both ways
az network vnet peering create \
  -g rg-dev -n dev-to-prod \
  --vnet-name vnet-dev \
  --remote-vnet $VNET_PROD_ID \
  --allow-vnet-access

az network vnet peering create \
  -g rg-prod -n prod-to-dev \
  --vnet-name vnet-prod \
  --remote-vnet $VNET_DEV_ID \
  --allow-vnet-access

# Check peering status
az network vnet peering list -g rg-dev --vnet-name vnet-dev --output table
```

## 📌 6. DNS Zones

```bash
# Scenario: Manage DNS for your application
az network dns zone create -g rg-prod -n myapp.com

# Add A record
az network dns record-set a add-record \
  -g rg-prod -z myapp.com -n www -a 20.30.40.50

# Add CNAME
az network dns record-set cname set-record \
  -g rg-prod -z myapp.com -n api -c api.trafficmanager.net

# Private DNS Zone for internal resolution
az network private-dns zone create -g rg-prod -n internal.myapp.com

az network private-dns link vnet create \
  -g rg-prod -z internal.myapp.com \
  -n link-vnet-prod --virtual-network vnet-prod \
  --registration-enabled true
```

## 📌 7. Azure Firewall

```bash
# Scenario: Central firewall for hub-spoke network
az network firewall create \
  -g rg-hub -n fw-hub \
  --vnet-name vnet-hub

az network firewall ip-config create \
  -g rg-hub -f fw-hub -n fw-config \
  --public-ip-address pip-fw \
  --vnet-name vnet-hub

# Application rule - allow outbound to Docker Hub
az network firewall application-rule create \
  -g rg-hub -f fw-hub --collection-name AllowDocker \
  -n docker-rule --protocols Https=443 \
  --target-fqdns "*.docker.io" "*.docker.com" \
  --source-addresses 10.0.0.0/16 \
  --priority 100 --action Allow

# Network rule - allow DNS
az network firewall network-rule create \
  -g rg-hub -f fw-hub --collection-name AllowDNS \
  -n dns-rule --protocols UDP \
  --destination-addresses 168.63.129.16 \
  --destination-ports 53 \
  --source-addresses 10.0.0.0/16 \
  --priority 200 --action Allow
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
