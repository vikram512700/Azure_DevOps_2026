# 🌐 Azure Networking Basics

### 🎯 For DevOps Beginners — VNet, Subnets, CIDR, Routes, NSG, ASG

______________________________________________________________________

## 1️⃣ Overview of Azure Networking (Real-World Example)

> 💡 **Think of Azure Networking like an Office Building:**
>
> - The **building** = Virtual Network (VNet)
> - **Floors** = Subnets
> - **Floors for different teams** = Web Floor, DB Floor, HR Floor
> - **Security guard at each floor** = NSG (Network Security Group)
> - **Elevator routes between floors** = Route Tables

```
🏢 VNet: vnet-company (10.0.0.0/16)
│
├── 🏢 Floor 1 → Subnet: subnet-web  (10.0.1.0/24)  → Web Servers
├── 🏢 Floor 2 → Subnet: subnet-app  (10.0.2.0/24)  → App Servers
└── 🏢 Floor 3 → Subnet: subnet-db   (10.0.3.0/24)  → Databases
```

### Real Scenario: E-Commerce App Network:

```
User (Internet)
      ↓
  Load Balancer
      ↓
  subnet-web  (10.0.1.0/24)  →  [web-server-01] [web-server-02]
      ↓ (only web can talk to app)
  subnet-app  (10.0.2.0/24)  →  [api-server-01]
      ↓ (only app can talk to db)
  subnet-db   (10.0.3.0/24)  →  [sql-database]
```

______________________________________________________________________

## 2️⃣ Virtual Network (VNet)

> 💡 **What is a VNet?**\
> A VNet is your **private network** in Azure.\
> It's like your office Wi-Fi — resources inside can talk to each other privately.\
> Nothing from outside can enter unless you allow it.

### Key Points:

- VNet is **region-specific** (East US VNet can't directly mix with West US VNet)
- Resources in the SAME VNet talk to each other **privately** (no internet needed)
- You define the **IP address range** for the VNet

### Create a VNet:

```bash
# Create a Virtual Network for your app
az network vnet create \
  --resource-group rg-webapp-prod \
  --name vnet-webapp \
  --address-prefix 10.0.0.0/16 \
  --location eastus

# List VNets
az network vnet list -g rg-webapp-prod --output table

# Show VNet details
az network vnet show -g rg-webapp-prod -n vnet-webapp
```

______________________________________________________________________

## 3️⃣ Subnets & CIDR

### What is a Subnet?

> 💡 **Subnets are like departments in an office building.**\
> Engineering team is on Floor 1, HR is on Floor 2.\
> Each floor has its own IP range and its own security rules.

### What is CIDR Notation?

> CIDR = **How many IP addresses are in this range**

| CIDR | Total IPs | Usable IPs | Use for |
|------|-----------|------------|---------|
| /16 | 65,536 | 65,531 | Entire VNet |
| /24 | 256 | 251 | A subnet |
| /28 | 16 | 11 | Small subnet (e.g., Gateway) |

> 💡 **Easy Rule**: Lower the number after `/`, more IPs you get.\
> `/16` = big (whole building), `/24` = medium (one floor), `/28` = tiny (one room)

### IP Range Examples:

```
VNet:        10.0.0.0/16     → 10.0.0.0 to 10.0.255.255  (65536 IPs)
subnet-web:  10.0.1.0/24     → 10.0.1.0 to 10.0.1.255    (256 IPs)
subnet-app:  10.0.2.0/24     → 10.0.2.0 to 10.0.2.255    (256 IPs)
subnet-db:   10.0.3.0/24     → 10.0.3.0 to 10.0.3.255    (256 IPs)
```

### Create Subnets:

```bash
# Create VNet first
az network vnet create \
  -g rg-webapp-prod -n vnet-webapp \
  --address-prefix 10.0.0.0/16

# Add web subnet
az network vnet subnet create \
  -g rg-webapp-prod \
  --vnet-name vnet-webapp \
  --name subnet-web \
  --address-prefix 10.0.1.0/24

# Add app subnet
az network vnet subnet create \
  -g rg-webapp-prod \
  --vnet-name vnet-webapp \
  --name subnet-app \
  --address-prefix 10.0.2.0/24

# Add DB subnet
az network vnet subnet create \
  -g rg-webapp-prod \
  --vnet-name vnet-webapp \
  --name subnet-db \
  --address-prefix 10.0.3.0/24

# List all subnets
az network vnet subnet list \
  -g rg-webapp-prod \
  --vnet-name vnet-webapp \
  --output table
```

______________________________________________________________________

## 4️⃣ Routes and Route Tables

> 💡 **Think of Route Tables like GPS directions:**\
> When a packet (data) needs to travel, the route table tells it **where to go**.

### Default Azure Routing:

By default, Azure automatically routes traffic:

- Within the VNet → local routing (auto)
- To the Internet → via Internet Gateway (auto)
- To on-premises → via VPN (if configured)

### Custom Route Table (User-Defined Routes):

**Real Scenario**: Force ALL internet traffic to go through a **Firewall VM** first for inspection.

```
VM in subnet-web
      ↓ (wants to reach internet)
  Route Table says: → send to Firewall VM (10.0.4.4)
      ↓
  Firewall VM (inspect/log traffic)
      ↓
  Internet
```

```bash
# Create a route table
az network route-table create \
  -g rg-webapp-prod \
  -n rt-force-internet

# Add a route: all internet traffic (0.0.0.0/0) → go to Firewall VM
az network route-table route create \
  -g rg-webapp-prod \
  --route-table-name rt-force-internet \
  --name force-through-firewall \
  --address-prefix 0.0.0.0/0 \
  --next-hop-type VirtualAppliance \
  --next-hop-ip-address 10.0.4.4

# Associate route table with a subnet
az network vnet subnet update \
  -g rg-webapp-prod \
  --vnet-name vnet-webapp \
  --name subnet-web \
  --route-table rt-force-internet
```

______________________________________________________________________

## 5️⃣ Network Security Groups (NSGs)

> 💡 **NSG = Security Guard / Firewall for your subnet or VM**\
> NSG has rules: allow or deny traffic based on port, IP, direction.

### NSG Rules have:

| Field | What it means | Example |
|-------|--------------|---------|
| **Priority** | Lower = checked first | 100, 200, 300... |
| **Direction** | Incoming or Outgoing | Inbound / Outbound |
| **Protocol** | TCP, UDP, Any | TCP |
| **Port** | Which port | 80 (HTTP), 443 (HTTPS), 22 (SSH) |
| **Source** | Where traffic comes from | Any, specific IP, subnet |
| **Action** | Allow or Deny | Allow / Deny |

### Real Scenario: Secure 3-Tier App

```
Internet → Port 80/443  → Allowed into subnet-web  ✅
Internet → Port 22      → Allowed (only from office IP) ✅
subnet-web → Port 3000  → Allowed into subnet-app  ✅
Internet → Port 3000    → DENIED to subnet-app      ❌
subnet-app → Port 5432  → Allowed into subnet-db   ✅
Internet → Port 5432    → DENIED to subnet-db       ❌
```

### Create NSG and Rules:

```bash
# Create NSG for web tier
az network nsg create \
  -g rg-webapp-prod \
  -n nsg-web-tier

# Rule 1: Allow HTTP (port 80) from anywhere
az network nsg rule create \
  -g rg-webapp-prod \
  --nsg-name nsg-web-tier \
  --name Allow-HTTP \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 80

# Rule 2: Allow HTTPS (port 443) from anywhere
az network nsg rule create \
  -g rg-webapp-prod \
  --nsg-name nsg-web-tier \
  --name Allow-HTTPS \
  --priority 110 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 443

# Rule 3: Allow SSH only from YOUR office IP
az network nsg rule create \
  -g rg-webapp-prod \
  --nsg-name nsg-web-tier \
  --name Allow-SSH-Office \
  --priority 120 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 22 \
  --source-address-prefixes 203.0.113.10/32

# Apply NSG to subnet-web
az network vnet subnet update \
  -g rg-webapp-prod \
  --vnet-name vnet-webapp \
  --name subnet-web \
  --network-security-group nsg-web-tier

# List NSG rules
az network nsg rule list \
  -g rg-webapp-prod \
  --nsg-name nsg-web-tier \
  --output table
```

______________________________________________________________________

## 6️⃣ Application Security Groups (ASGs)

> 💡 **Problem with NSGs alone:**\
> You have 20 web servers. You want to allow traffic from ONLY the web servers to the app servers.\
> With NSG you'd have to list all 20 IPs individually. That's messy!
>
> **ASG solution**: Group VMs by role, write rules using the group name.

### How ASG Works:

```
Step 1: Create ASG called "asg-web-servers"
Step 2: Assign all web VMs to that ASG
Step 3: In NSG rule, say:
        "Allow port 3000 FROM asg-web-servers TO asg-app-servers"
Step 4: Now — ALL web VMs can talk to app servers automatically!
```

### Create ASGs:

```bash
# Create ASGs for each tier
az network asg create -g rg-webapp-prod -n asg-web-servers
az network asg create -g rg-webapp-prod -n asg-app-servers
az network asg create -g rg-webapp-prod -n asg-db-servers

# Assign web server VM's NIC to the ASG
az network nic ip-config update \
  -g rg-webapp-prod \
  --nic-name web-server-01-nic \
  --name ipconfig1 \
  --application-security-groups asg-web-servers

# Create NSG rule using ASG names (clean!)
az network nsg rule create \
  -g rg-webapp-prod \
  --nsg-name nsg-app-tier \
  --name Allow-Web-to-App \
  --priority 100 \
  --direction Inbound \
  --access Allow \
  --protocol Tcp \
  --destination-port-ranges 3000 \
  --source-asgs asg-web-servers \
  --destination-asgs asg-app-servers
```

### NSG vs ASG — Simple Comparison:

| | NSG | ASG |
|-|-----|-----|
| What it is | Security rules | Logical grouping of VMs |
| Rules based on | IP addresses, ports | VM group names |
| When IPs change | Update all rules manually ❌ | No change needed ✅ |
| Best for | Simple setups | Large apps with many VMs |

______________________________________________________________________

## 🧠 Summary

```
VNet           = Your private cloud network (like office building)
Subnet         = Sections inside VNet (like floors in building)
CIDR           = How many IPs in a range (/24 = 256 IPs)
Route Table    = GPS/directions for network traffic
NSG            = Security guard — allow/deny traffic by port/IP
ASG            = Group VMs by role — use in NSG rules
```

## ✅ Quick Quiz

1. You have a database VM and you want ONLY app servers to talk to it on port 5432. What do you create?

   > **Answer**: NSG rule on db subnet — allow port 5432 only from app subnet IP range (or ASG) ✅

1. You want to force all internet traffic from VMs to go through a firewall first. What do you use?

   > **Answer**: Custom Route Table with a route pointing to the firewall VM 🛤️

1. You have 30 VMs and want to write one NSG rule covering all of them. What helps?

   > **Answer**: Application Security Group (ASG) — group all 30 VMs into one ASG 🏷️
