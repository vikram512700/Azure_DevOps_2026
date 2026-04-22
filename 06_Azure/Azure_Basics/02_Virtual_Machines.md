# 🖥️ Azure Virtual Machines
### 🎯 For DevOps Beginners — Simple Notes with Real Examples

---

## 1️⃣ Virtualization Recap

> 💡 **Think of it like this:**  
> Imagine one powerful physical server in a data center.  
> Instead of running just ONE computer on it, we run **many virtual computers** on it.  
> Each virtual computer behaves like a real, separate computer.  
> This is called **Virtualization**.

```
One Physical Server (Real Hardware)
├── 🖥️  VM 1 → Your Web App (Linux)
├── 🖥️  VM 2 → Your Database (Windows)
└── 🖥️  VM 3 → Your CI/CD Build Agent (Ubuntu)
```

### Before vs After Virtualization:

| Before (Old Way) | After (Virtualization) |
|------------------|----------------------|
| 1 server = 1 app | 1 server = many apps |
| Lots of idle hardware | Full hardware utilization |
| Weeks to provision | Minutes to provision |
| Expensive | Cost-efficient |

### Key Terms:
- **Hypervisor** = Software that creates and manages VMs (Azure uses **Hyper-V**)
- **Host** = Physical machine running the hypervisor
- **Guest** = The Virtual Machine running on top

---

## 2️⃣ Create a Virtual Machine in Azure

### What You Choose When Creating a VM:

| Setting | What it means | Example |
|---------|--------------|---------|
| **Resource Group** | Which folder to put it in | `rg-webapp-dev` |
| **Name** | VM's name | `web-server-01` |
| **Region** | Which datacenter | East US |
| **Image** | Which OS | Ubuntu 22.04 / Windows Server 2022 |
| **Size** | CPU + RAM | `Standard_B2s` = 2 CPU, 4GB RAM |
| **Authentication** | How to login | SSH Key (Linux) / Password (Windows) |
| **Public IP** | Accessible from internet? | Yes for web servers |
| **Disk** | Storage type | Premium SSD (fast), Standard HDD (cheap) |

### VM Size Guide for Beginners:

| Size | CPU | RAM | Use For | Cost |
|------|-----|-----|---------|------|
| `Standard_B1s` | 1 | 1GB | Learning/Dev | 💲 Cheapest |
| `Standard_B2s` | 2 | 4GB | Dev/Test server | 💲💲 |
| `Standard_D2s_v3` | 2 | 8GB | Small production | 💲💲💲 |
| `Standard_D4s_v3` | 4 | 16GB | Production web | 💲💲💲💲 |

### ⚡ CLI — Create a Linux VM:
```bash
# Create an Ubuntu VM for a web server
az vm create \
  --resource-group rg-webapp-dev \
  --name web-server-01 \
  --image Ubuntu2204 \
  --size Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard

# ✅ Output will show: publicIpAddress → use this to connect
```

### ⚡ CLI — Create a Windows VM:
```bash
az vm create \
  --resource-group rg-webapp-dev \
  --name win-server-01 \
  --image Win2022Datacenter \
  --size Standard_D2s_v3 \
  --admin-username winadmin \
  --admin-password 'MyP@ss123!'
```

### VM Management Commands:
```bash
# See all your VMs with status
az vm list -d --output table

# Start a VM
az vm start -g rg-webapp-dev -n web-server-01

# Stop a VM (still charged!)
az vm stop -g rg-webapp-dev -n web-server-01

# Deallocate = Stop + FREE the hardware (NOT charged for compute)
az vm deallocate -g rg-webapp-dev -n web-server-01

# Restart
az vm restart -g rg-webapp-dev -n web-server-01

# Delete VM
az vm delete -g rg-webapp-dev -n web-server-01 --yes
```

> 💡 **DevOps Tip**: Always **deallocate** (not just stop) dev VMs at night.  
> "Stop" still charges you for the VM. "Deallocate" = free!

---

## 3️⃣ Connect to the Virtual Machine

### Linux VM — Connect via SSH:

```bash
# Step 1: Get the public IP of your VM
az vm list-ip-addresses \
  -g rg-webapp-dev \
  -n web-server-01 \
  --output table

# Step 2: SSH into the VM
ssh azureuser@<PUBLIC_IP>
# Example:
ssh azureuser@40.112.72.205

# Shortcut: Azure CLI handles SSH for you
az ssh vm -g rg-webapp-dev -n web-server-01
```

### Windows VM — Connect via RDP:
```bash
# Get the IP
az vm show -g rg-webapp-dev -n win-server-01 \
  --show-details --query publicIps -o tsv

# Then open Remote Desktop on your PC:
# Windows: Start → Remote Desktop Connection → paste IP
# Mac: Download "Microsoft Remote Desktop" from App Store
```

### Run Commands on VM WITHOUT logging in:
```bash
# Scenario: Quick check if the app is running
az vm run-command invoke \
  -g rg-webapp-dev \
  -n web-server-01 \
  --command-id RunShellScript \
  --scripts "systemctl status nginx"

# Check disk space on VM
az vm run-command invoke \
  -g rg-webapp-dev \
  -n web-server-01 \
  --command-id RunShellScript \
  --scripts "df -h"
```

> 💡 **Why use run-command?** Useful in pipelines/automation when you can't SSH.

---

## 4️⃣ Deploy Your First App on an Azure VM

### 🛒 Real Scenario: Deploy a Node.js Web App

**Step 1 — Create VM and open HTTP port:**
```bash
# Create VM
az vm create \
  -g rg-webapp-dev -n web-server-01 \
  --image Ubuntu2204 --size Standard_B1s \
  --admin-username azureuser \
  --generate-ssh-keys

# Open port 80 (HTTP) so users can access it
az vm open-port --port 80 -g rg-webapp-dev -n web-server-01
```

**Step 2 — SSH in and install Node.js:**
```bash
ssh azureuser@<PUBLIC_IP>

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # should show v18.x
```

**Step 3 — Create and run the app:**
```bash
# Create app folder
mkdir ~/myapp && cd ~/myapp

# Create app.js
cat > app.js << 'EOF'
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello from Azure VM! Deployed by DevOps 🚀\n');
}).listen(80, () => {
  console.log('Server running on port 80');
});
EOF

# Run it
sudo node app.js
```

**Step 4 — Access in browser:**
```
Open: http://<PUBLIC_IP>
You see: "Hello from Azure VM! Deployed by DevOps 🚀"
```

**Step 5 — Keep app running after logout (PM2):**
```bash
sudo npm install -g pm2
sudo pm2 start app.js
sudo pm2 startup     # auto-start on system reboot
sudo pm2 save
```

### 🤖 Automate App Install using VM Extension (No SSH needed!):
```bash
# Install Nginx automatically during/after VM creation
az vm extension set \
  --resource-group rg-webapp-dev \
  --vm-name web-server-01 \
  --name customScript \
  --publisher Microsoft.Azure.Extensions \
  --settings '{
    "commandToExecute": "apt-get update && apt-get install -y nginx && echo Hello-from-Nginx > /var/www/html/index.html && systemctl restart nginx"
  }'
```

> 💡 **DevOps Use Case**: In CI/CD pipelines, you can deploy new app versions to VMs using `az vm run-command` or extensions — no manual SSH needed!

---

## 5️⃣ VM Scale Sets (VMSS) for Autoscaling

> 💡 **Think of it like this:**  
> You own a pizza shop.  
> On normal days, 2 chefs handle all orders.  
> On Saturday night, 100 orders come in — you hire 5 more chefs.  
> After peak, you let extra chefs go.  
>  
> **VMSS does this automatically for VMs!**

```
Normal traffic (2 VMs):
  [VM1] [VM2]

Peak traffic — CPU > 70% (VMSS auto-adds VMs):
  [VM1] [VM2] [VM3] [VM4] [VM5]

After peak — CPU < 30% (VMSS removes VMs):
  [VM1] [VM2]
```

### Create a VM ScaleSet:
```bash
az vmss create \
  --resource-group rg-webapp-prod \
  --name vmss-web \
  --image Ubuntu2204 \
  --instance-count 2 \
  --vm-sku Standard_B2s \
  --admin-username azureuser \
  --generate-ssh-keys \
  --load-balancer vmss-lb \
  --upgrade-policy-mode Automatic
```

### Set Up Auto Scaling Rules:
```bash
# Create autoscale setting
az monitor autoscale create \
  -g rg-webapp-prod \
  --resource vmss-web \
  --resource-type Microsoft.Compute/virtualMachineScaleSets \
  --min-count 2 \
  --max-count 10 \
  --count 2 \
  --name autoscale-vmss-web

# Rule 1: Scale OUT — CPU > 70% → add 2 VMs
az monitor autoscale rule create \
  -g rg-webapp-prod \
  --autoscale-name autoscale-vmss-web \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 2

# Rule 2: Scale IN — CPU < 30% → remove 1 VM
az monitor autoscale rule create \
  -g rg-webapp-prod \
  --autoscale-name autoscale-vmss-web \
  --condition "Percentage CPU < 30 avg 5m" \
  --scale in 1
```

### VMSS Management:
```bash
# See all VM instances in the scale set
az vmss list-instances -g rg-webapp-prod -n vmss-web --output table

# Manually scale (before a planned event like Black Friday)
az vmss scale -g rg-webapp-prod -n vmss-web --new-capacity 8

# Update all instances with new image/config
az vmss update-instances -g rg-webapp-prod -n vmss-web --instance-ids "*"
```

### Single VM vs VMSS:

| | Single VM | VM ScaleSet (VMSS) |
|-|-----------|---------------------|
| Auto-scaling | ❌ Manual | ✅ Automatic |
| High availability | ❌ 1 point of failure | ✅ Many VMs |
| Load balancing | ❌ Setup manually | ✅ Built-in |
| Cost efficiency | ❌ Fixed cost | ✅ Pay for what you use |
| Use for | Dev/Test | Production web tiers |

---

## 🧠 Summary

```
Virtualization  = Many VMs on one physical server
Azure VM        = Your cloud computer (starts in minutes)
SSH             = How you log into Linux VMs
RDP             = How you log into Windows VMs
VM Extension    = Run scripts on VM without SSH
VMSS            = Auto add/remove VMs based on demand
Deallocate      = Stop VM and stop paying for it
```

## ✅ Quick Quiz
1. You have a dev VM you don't use on weekends. What should you do to save money?
   > **Answer**: `az vm deallocate` (not just stop!) 💡

2. Your app gets 10x traffic on Diwali sale. What Azure feature handles this automatically?
   > **Answer**: VM ScaleSet (VMSS) with autoscale rules 📈

3. You want to install Docker on 50 VMs without SSHing into each one. What do you use?
   > **Answer**: VM Extension or `az vm run-command` 🤖
