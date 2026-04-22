# 🔒 Advanced Azure Networking
### 🎯 For DevOps Beginners — App Gateway, WAF, Load Balancer, DNS, Firewall, Peering, VPN

---

## 1️⃣ Azure App Gateway & WAF

### What is Azure Application Gateway?

> 💡 **Think of it like a smart receptionist at the front door:**  
> - Regular Load Balancer = "Go to server 1, 2, or 3" (simple, dumb routing)  
> - App Gateway = "Oh you want /api? Go to API servers. Want /images? Go to image servers."  
> It understands **HTTP/HTTPS** (Layer 7 = smart routing).

### App Gateway Features:

| Feature | What it does | Benefit |
|---------|-------------|---------|
| **URL-based routing** | /api → API servers, /web → Web servers | Host multiple apps on one IP |
| **SSL termination** | Handles HTTPS, sends HTTP to backend | Reduces server load |
| **Session affinity** | Same user → same server | Good for stateful apps |
| **Autoscaling** | Handles traffic spikes | No manual scaling |
| **WAF** | Blocks attacks | Security |

### Real Scenario — Path-Based Routing:
```
User requests: myapp.com/api/orders  → routes to  API Server pool
User requests: myapp.com/images/...  → routes to  Image Server pool
User requests: myapp.com/            → routes to  Web Server pool
```

### What is WAF (Web Application Firewall)?

> 💡 **WAF = Bodyguard for your web app.**  
> It blocks common attacks BEFORE they reach your servers.

### Attacks WAF Blocks:

| Attack | What it is | Example |
|--------|-----------|---------|
| **SQL Injection** | Injecting SQL commands | `' OR 1=1 --` in login box |
| **XSS** | Injecting scripts | `<script>steal()</script>` in forms |
| **CSRF** | Fake requests on behalf of user | Fake bank transfer |
| **DDoS** | Flood server with traffic | 1M requests/second |
| **OWASP Top 10** | Top 10 web vulnerabilities | Industry standard |

### Create App Gateway with WAF:
```bash
# Create public IP for App Gateway
az network public-ip create \
  -g rg-webapp-prod \
  -n pip-appgw \
  --sku Standard \
  --allocation-method Static

# Create App Gateway with WAF
az network application-gateway create \
  -g rg-webapp-prod \
  -n appgw-webapp \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name vnet-webapp \
  --subnet subnet-appgw \
  --public-ip-address pip-appgw \
  --http-settings-port 80 \
  --http-settings-protocol Http \
  --frontend-port 80

# Enable WAF
az network application-gateway waf-config set \
  -g rg-webapp-prod \
  --gateway-name appgw-webapp \
  --enabled true \
  --firewall-mode Prevention \
  --rule-set-version 3.2
```

---

## 2️⃣ Azure Load Balancer

### What is Azure Load Balancer?

> 💡 **Think of it like a call center manager:**  
> 1000 calls come in. Manager assigns: Call 1 → Agent 1, Call 2 → Agent 2, Call 3 → Agent 3...  
> No single agent gets overwhelmed.  
> If Agent 2 is sick (down), manager skips Agent 2.

### App Gateway vs Load Balancer:

| | Load Balancer | App Gateway |
|-|--------------|-------------|
| Works at | Layer 4 (TCP/UDP) | Layer 7 (HTTP/HTTPS) |
| Routes by | IP + Port | URL path, host headers |
| Understands HTTP | ❌ No | ✅ Yes |
| WAF support | ❌ No | ✅ Yes |
| Cost | 💲 Cheaper | 💲💲 More expensive |
| Use for | Any TCP traffic, DB, VMs | Web apps, APIs |

### Real Scenario — Load Balancer for Web VMs:
```
Users from Internet
       ↓
  Load Balancer (Public IP)
       ↓
  ┌────────────────┐
  │  Health Probe  │  ← checks if VMs are alive every 15 sec
  └────────────────┘
       ↓ routes to healthy VMs only
  [VM1: web-01]  [VM2: web-02]  [VM3: web-03]
```

### Create a Load Balancer:
```bash
# Create public IP
az network public-ip create \
  -g rg-webapp-prod -n pip-lb \
  --sku Standard --allocation-method Static

# Create load balancer
az network lb create \
  -g rg-webapp-prod -n lb-web \
  --sku Standard \
  --public-ip-address pip-lb \
  --frontend-ip-name frontend-config \
  --backend-pool-name pool-web-vms

# Add health probe (checks port 80 every 15s)
az network lb probe create \
  -g rg-webapp-prod --lb-name lb-web \
  -n health-probe-http \
  --protocol Http \
  --port 80 \
  --path /health

# Add load balancing rule (port 80 → port 80)
az network lb rule create \
  -g rg-webapp-prod --lb-name lb-web \
  -n lb-rule-http \
  --frontend-ip-name frontend-config \
  --backend-pool-name pool-web-vms \
  --protocol Tcp \
  --frontend-port 80 --backend-port 80 \
  --probe-name health-probe-http
```

---

## 3️⃣ Azure DNS

### What is DNS?

> 💡 **DNS = Phone book of the internet.**  
> You type `myapp.com` → DNS tells your browser → "That's IP 40.112.72.205"  
> Without DNS, you'd have to type the IP address everywhere.

### Azure DNS Features:
- Host your domain's DNS in Azure
- Works with all Azure services
- Very fast and globally distributed
- Supports **private DNS** (for internal resolution only)

### Real Scenario: Your domain `myshop.com`

```
www.myshop.com     → Load Balancer IP (40.x.x.x)
api.myshop.com     → API server IP (40.x.x.y)
mail.myshop.com    → Email server (CNAME to mail provider)
```

### Create DNS Zone and Records:
```bash
# Create DNS Zone (for myshop.com)
az network dns zone create \
  -g rg-webapp-prod \
  -n myshop.com

# Add A record: www → load balancer IP
az network dns record-set a add-record \
  -g rg-webapp-prod \
  --zone-name myshop.com \
  --record-set-name www \
  --ipv4-address 40.112.72.205

# Add CNAME: api → traffic manager URL
az network dns record-set cname set-record \
  -g rg-webapp-prod \
  --zone-name myshop.com \
  --record-set-name api \
  --cname myshop.trafficmanager.net

# Add MX record for email
az network dns record-set mx add-record \
  -g rg-webapp-prod \
  --zone-name myshop.com \
  --record-set-name "@" \
  --exchange mail.myshop.com \
  --preference 10

# List all DNS records
az network dns record-set list \
  -g rg-webapp-prod --zone-name myshop.com \
  --output table
```

### Private DNS (Internal resolution in VNet):
```bash
# Scenario: DB server is known internally as "db.internal.myshop.com"
# VMs inside the VNet can use this name, Internet cannot

# Create private DNS zone
az network private-dns zone create \
  -g rg-webapp-prod \
  -n internal.myshop.com

# Link it to VNet
az network private-dns link vnet create \
  -g rg-webapp-prod \
  --zone-name internal.myshop.com \
  --name link-vnet-webapp \
  --virtual-network vnet-webapp \
  --registration-enabled true    # VMs auto-register their names

# Add manual record for DB server
az network private-dns record-set a add-record \
  -g rg-webapp-prod \
  --zone-name internal.myshop.com \
  --record-set-name db \
  --ipv4-address 10.0.3.10
```

---

## 4️⃣ Azure Firewall

### What is Azure Firewall?

> 💡 **Think of it like the building's main security checkpoint:**  
> - NSG = security guard on each floor  
> - Azure Firewall = main security gate at the building entrance  
>  
> Azure Firewall sits at the center and **all traffic flows through it**.  
> It can **inspect, log, and filter** everything centrally.

### NSG vs Azure Firewall:

| | NSG | Azure Firewall |
|-|-----|----------------|
| Works at | Subnet / NIC | VNet level (centralized) |
| Layer | L3/L4 | L3/L4/L7 |
| Threat intelligence | ❌ | ✅ Blocks known bad IPs |
| FQDN filtering | ❌ | ✅ (allow only `*.github.com`) |
| Centralized logging | ❌ | ✅ All in one place |
| Cost | Free | 💲 Expensive |
| Best for | Every subnet | Hub-spoke enterprise networks |

### Real Scenario — Hub-Spoke with Firewall:
```
spoke-vnet (your app) → ALL traffic → hub-vnet firewall → Internet
                                              ↓
                                  Logs EVERYTHING
                                  Blocks malicious domains
                                  Allows only approved URLs
```

### Create Azure Firewall:
```bash
# Create dedicated firewall subnet (must be named AzureFirewallSubnet!)
az network vnet subnet create \
  -g rg-hub -n AzureFirewallSubnet \
  --vnet-name vnet-hub \
  --address-prefix 10.0.4.0/26

# Create public IP for firewall
az network public-ip create \
  -g rg-hub -n pip-firewall --sku Standard

# Create firewall
az network firewall create \
  -g rg-hub -n fw-hub --location eastus

# Configure firewall IP
az network firewall ip-config create \
  -g rg-hub -f fw-hub -n fw-ip-config \
  --public-ip-address pip-firewall \
  --vnet-name vnet-hub

# Allow outbound to GitHub only (application rule)
az network firewall application-rule create \
  -g rg-hub -f fw-hub \
  --collection-name allow-dev-tools \
  -n allow-github \
  --protocols Https=443 \
  --target-fqdns "*.github.com" "*.githubusercontent.com" \
  --source-addresses 10.0.0.0/16 \
  --priority 100 --action Allow

# Block everything else (default deny is built-in)
```

---

## 5️⃣ Virtual Network Peering

### What is VNet Peering?

> 💡 **Think of two separate buildings wanting to share a private corridor:**  
> By default, VNet-A and VNet-B are **completely isolated**.  
> VNet Peering = add a **private tunnel** between them.  
> Traffic stays on Microsoft's backbone network (**fast, private, no internet**).

### Real Scenario — Dev and Prod sharing a service:
```
vnet-dev (10.0.0.0/16)   ←→  vnet-prod (10.1.0.0/16)
  dev VMs                    prod VMs

After peering:
dev-vm (10.0.1.10) can reach prod-db (10.1.3.10) directly!
```

### Create VNet Peering (Must do BOTH directions!):
```bash
# Get VNet IDs
DEV_VNET_ID=$(az network vnet show -g rg-dev -n vnet-dev --query id -o tsv)
PROD_VNET_ID=$(az network vnet show -g rg-prod -n vnet-prod --query id -o tsv)

# Peering: dev → prod
az network vnet peering create \
  -g rg-dev \
  --name peer-dev-to-prod \
  --vnet-name vnet-dev \
  --remote-vnet $PROD_VNET_ID \
  --allow-vnet-access \
  --allow-forwarded-traffic

# Peering: prod → dev (must do both sides!)
az network vnet peering create \
  -g rg-prod \
  --name peer-prod-to-dev \
  --vnet-name vnet-prod \
  --remote-vnet $DEV_VNET_ID \
  --allow-vnet-access \
  --allow-forwarded-traffic

# Check peering status
az network vnet peering list -g rg-dev --vnet-name vnet-dev --output table
# Status should show: "Connected"
```

> ⚠️ **VNet Peering Rule**: The two VNets must have **non-overlapping IP ranges**!  
> ✅ `10.0.0.0/16` and `10.1.0.0/16` → OK  
> ❌ `10.0.0.0/16` and `10.0.0.0/16` → CONFLICT

---

## 6️⃣ VPN Gateway

### What is a VPN Gateway?

> 💡 **Think of it like a secure tunnel under the ocean:**  
> Your office is in India. Your Azure VNet is in East US.  
> VPN Gateway creates an **encrypted tunnel** over the internet between them.  
> Everything inside the tunnel is private and secure.

### VPN Types:

| Type | Use For | Example |
|------|---------|---------|
| **Site-to-Site (S2S)** | Connect whole office network to Azure | HQ ↔ Azure VNet |
| **Point-to-Site (P2S)** | Connect one laptop to Azure | Remote dev ↔ Azure VNet |
| **VNet-to-VNet** | Connect two Azure VNets in different regions | EastUS ↔ WestEurope |

### Site-to-Site VPN (Office ↔ Azure):
```
🏢 Office Network (192.168.0.0/24)
        ↕  Encrypted VPN Tunnel (over internet)
☁️  Azure VNet (10.0.0.0/16)

Office employees can access Azure VMs like they're on the same network!
```

### Create VPN Gateway (Site-to-Site):
```bash
# Step 1: Create Gateway Subnet (required, must be named GatewaySubnet)
az network vnet subnet create \
  -g rg-prod --vnet-name vnet-prod \
  -n GatewaySubnet \
  --address-prefix 10.0.255.0/27

# Step 2: Create Public IP for VPN Gateway
az network public-ip create \
  -g rg-prod -n pip-vpn-gw \
  --sku Basic --allocation-method Dynamic

# Step 3: Create VPN Gateway (takes ~30-45 minutes!)
az network vnet-gateway create \
  -g rg-prod -n vpn-gw-prod \
  --vnet vnet-prod \
  --public-ip-address pip-vpn-gw \
  --gateway-type Vpn \
  --vpn-type RouteBased \
  --sku VpnGw1 \
  --no-wait   # run in background

# Step 4: Create Local Network Gateway (represents your office network)
az network local-gateway create \
  -g rg-prod -n local-gw-office \
  --gateway-ip-address 203.0.113.10 \  # your office router's public IP
  --local-address-prefixes 192.168.0.0/24  # your office IP range

# Step 5: Create the VPN Connection
az network vpn-connection create \
  -g rg-prod -n vpn-conn-office \
  --vnet-gateway1 vpn-gw-prod \
  --local-gateway2 local-gw-office \
  --shared-key "MySecretVPN123!"  # shared between Azure and your router

# Check connection status
az network vpn-connection show \
  -g rg-prod -n vpn-conn-office \
  --query connectionStatus -o tsv
```

### VNet Peering vs VPN Gateway:

| | VNet Peering | VPN Gateway |
|-|--------------|-------------|
| Connects | Azure VNet ↔ Azure VNet | Azure VNet ↔ On-premises |
| Speed | Very fast (Azure backbone) | Slower (over internet) |
| Setup time | Minutes | 30-45 minutes |
| Cost | Based on data transfer | Gateway + data transfer |
| Encryption | Not encrypted (trusted network) | ✅ Encrypted tunnel |
| Best for | Azure to Azure | Office to Azure |

---

## 🧠 Summary — All Advanced Networking

```
App Gateway   = Smart HTTP router + SSL termination (Layer 7)
WAF           = Blocks web attacks (SQL injection, XSS, etc.)
Load Balancer = Distribute traffic across VMs (Layer 4, TCP/UDP)
Azure DNS     = Host your domain DNS in Azure
Azure Firewall= Central security inspection for all traffic
VNet Peering  = Private connection between two Azure VNets
VPN Gateway   = Encrypted tunnel: Office ↔ Azure (over internet)
```

## ✅ Quick Quiz

1. You want to route `/api` to API servers and `/web` to web servers. What do you use?
   > **Answer**: Azure Application Gateway (URL-based routing) 🛤️

2. You want to protect your web app from SQL injection attacks. What feature helps?
   > **Answer**: WAF (Web Application Firewall) on App Gateway 🛡️

3. Your company's office network needs to access Azure VMs privately. What do you set up?
   > **Answer**: VPN Gateway with Site-to-Site VPN connection 🔐

4. You have two Azure VNets and want them to communicate privately without internet. What do you use?
   > **Answer**: VNet Peering 🤝

5. 5 developers work remotely. They need access to Azure VMs. What type of VPN?
   > **Answer**: Point-to-Site (P2S) VPN Gateway 💻
