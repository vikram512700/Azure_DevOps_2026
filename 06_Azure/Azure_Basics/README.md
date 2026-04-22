# ☁️ Azure Basics — DevOps Notes

### 🔹 Simple, short notes with real-world examples for DevOps Engineers

______________________________________________________________________

## 📁 Files in This Folder

| # | File | Topics Covered |
|---|------|----------------|
| 1 | [01_Resources_ResourceGroups.md](01_Resources_ResourceGroups.md) | Azure Resources, Resource Groups, Azure Resource Manager (ARM) |
| 2 | [02_Virtual_Machines.md](02_Virtual_Machines.md) | Virtualization, Create VM, Connect VM, Deploy App, VMSS Autoscaling |
| 3 | [03_Networking_Basics.md](03_Networking_Basics.md) | VNet, Subnets, CIDR, Route Tables, NSG, ASG |
| 4 | [04_Advanced_Networking.md](04_Advanced_Networking.md) | App Gateway, WAF, Load Balancer, DNS, Azure Firewall, VNet Peering, VPN Gateway |
| 5 | [05_Entra_Subscriptions_RBAC_Billing.md](05_Entra_Subscriptions_RBAC_Billing.md) | Entra ID, Subscriptions, Management Groups, RBAC, Policy, Cost Management |

______________________________________________________________________

## 🗺️ Azure Learning Path

```
Step 1️⃣  → Understand Resources & Resource Groups (how Azure is organized)
Step 2️⃣  → Learn Virtual Machines (your first cloud server)
Step 3️⃣  → Learn Networking Basics (connect your resources privately)
Step 4️⃣  → Learn Advanced Networking (expose apps safely to internet)
Step 5️⃣  → Learn Entra ID & RBAC (who has access, billing, governance)
```

______________________________________________________________________

## 🔑 Key Concepts Cheat Sheet

| Concept | One-line Summary |
|---------|-----------------|
| **Resource** | Any Azure service you create (VM, DB, Storage...) |
| **Resource Group** | A folder that holds related resources |
| **ARM** | Azure's control plane — all requests go through it |
| **VM** | A cloud computer — start in minutes, pay per hour |
| **VMSS** | Auto add/remove VMs based on CPU/load |
| **VNet** | Your private network in Azure |
| **Subnet** | A section inside a VNet |
| **NSG** | Firewall rules for a subnet or VM |
| **ASG** | Group VMs by role for cleaner NSG rules |
| **App Gateway** | Smart HTTP router + WAF (Layer 7) |
| **Load Balancer** | Distribute TCP traffic across VMs (Layer 4) |
| **VNet Peering** | Private connection between two Azure VNets |
| **VPN Gateway** | Encrypted tunnel: Office ↔ Azure |
| **Entra ID** | Azure's identity system (users, groups, apps) |
| **Subscription** | Billing account — where resources are created |
| **Management Group** | Folder for multiple subscriptions |
| **RBAC** | Role-based access control — who can do what |
| **Service Principal** | Non-human identity for apps/CI-CD pipelines |
| **Managed Identity** | Azure-managed SP — no secrets to manage |
| **Azure Policy** | Rules that enforce compliance automatically |
| **Cost Management** | Monitor and control Azure spending |

______________________________________________________________________

> 💡 **Tip**: Each file ends with a **Quick Quiz** — test yourself before moving on!
