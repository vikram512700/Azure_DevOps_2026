# ☁️ Azure CLI for DevOps - Part 5: Containers & Kubernetes (AKS)

## 📌 1. Azure Container Registry (ACR)

```bash
# Create container registry
az acr create -g rg-prod -n acrprod2026 --sku Standard

# Login to ACR
az acr login -n acrprod2026

# Build image directly in ACR (no local Docker needed!)
# Scenario: CI pipeline builds image in cloud
az acr build -r acrprod2026 \
  --image myapp:v1.0 \
  --file Dockerfile .

# List repositories and tags
az acr repository list -n acrprod2026 --output table
az acr repository show-tags -n acrprod2026 --repository myapp --output table

# Delete old images
# Scenario: Cleanup images older than 30 days
az acr repository delete -n acrprod2026 --image myapp:v0.1 --yes

# Enable admin user (for quick testing only)
az acr update -n acrprod2026 --admin-enabled true
az acr credential show -n acrprod2026

# ACR Purge - automated cleanup
az acr task create -r acrprod2026 -n purge-old-images \
  --cmd "acr purge --filter 'myapp:.*' --ago 30d --untagged" \
  --schedule "0 0 * * *" --context /dev/null
```

## 📌 2. Azure Container Instances (ACI)

```bash
# Scenario: Run a quick one-off container (CI runner, batch job)
az container create \
  -g rg-dev -n ci-runner-01 \
  --image acrprod2026.azurecr.io/ci-runner:latest \
  --cpu 2 --memory 4 \
  --registry-login-server acrprod2026.azurecr.io \
  --registry-username $(az acr credential show -n acrprod2026 --query username -o tsv) \
  --registry-password $(az acr credential show -n acrprod2026 --query "passwords[0].value" -o tsv) \
  --restart-policy Never \
  --environment-variables BUILD_ID=123 BRANCH=main

# Check container logs
az container logs -g rg-dev -n ci-runner-01

# Show container status
az container show -g rg-dev -n ci-runner-01 \
  --query "{Status:instanceView.state, IP:ipAddress.ip}" -o table

# Attach to running container
az container attach -g rg-dev -n ci-runner-01

# Delete container
az container delete -g rg-dev -n ci-runner-01 --yes

# Scenario: Run multi-container group with sidecar
az container create -g rg-dev -n web-with-sidecar \
  --file container-group.yaml
```

## 📌 3. Azure Kubernetes Service (AKS) - Cluster Management

```bash
# Scenario: Create production AKS cluster
az aks create \
  -g rg-prod -n aks-prod \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-managed-identity \
  --attach-acr acrprod2026 \
  --network-plugin azure \
  --vnet-subnet-id /subscriptions/.../subnets/subnet-aks \
  --service-cidr 10.1.0.0/16 \
  --dns-service-ip 10.1.0.10 \
  --zones 1 2 3 \
  --enable-cluster-autoscaler \
  --min-count 2 --max-count 10 \
  --tags Environment=Production

# Get credentials (configure kubectl)
az aks get-credentials -g rg-prod -n aks-prod

# Show cluster info
az aks show -g rg-prod -n aks-prod --output table

# List clusters
az aks list --output table

# Browse Kubernetes dashboard
az aks browse -g rg-prod -n aks-prod
```

## 📌 4. AKS Node Pool Management

```bash
# Add a node pool for GPU workloads
# Scenario: ML model serving needs GPU nodes
az aks nodepool add \
  -g rg-prod --cluster-name aks-prod \
  -n gpupool --node-count 2 \
  --node-vm-size Standard_NC6s_v3 \
  --labels workload=gpu \
  --node-taints nvidia.com/gpu=true:NoSchedule

# Add spot node pool (cost saving for batch jobs)
az aks nodepool add \
  -g rg-prod --cluster-name aks-prod \
  -n spotpool --node-count 3 \
  --priority Spot --eviction-policy Delete \
  --spot-max-price -1 \
  --labels workload=batch

# Scale node pool
az aks nodepool scale \
  -g rg-prod --cluster-name aks-prod \
  -n gpupool --node-count 5

# Upgrade node pool
az aks nodepool upgrade \
  -g rg-prod --cluster-name aks-prod \
  -n default --kubernetes-version 1.29.0

# List node pools
az aks nodepool list -g rg-prod --cluster-name aks-prod --output table

# Delete node pool
az aks nodepool delete -g rg-prod --cluster-name aks-prod -n gpupool
```

## 📌 5. AKS Cluster Operations

```bash
# Upgrade cluster
az aks get-upgrades -g rg-prod -n aks-prod --output table
az aks upgrade -g rg-prod -n aks-prod --kubernetes-version 1.29.0

# Start/Stop cluster (save costs in dev/test)
az aks stop -g rg-dev -n aks-dev
az aks start -g rg-dev -n aks-dev

# Enable monitoring
az aks enable-addons -g rg-prod -n aks-prod \
  --addons monitoring \
  --workspace-resource-id /subscriptions/.../workspaces/law-prod

# Enable Azure Policy for AKS
az aks enable-addons -g rg-prod -n aks-prod --addons azure-policy

# Rotate certificates
az aks rotate-certs -g rg-prod -n aks-prod

# Get AKS diagnostics
az aks kollect -g rg-prod -n aks-prod \
  --storage-account stproddiag

# Scenario: Attach ACR to existing cluster
az aks update -g rg-prod -n aks-prod --attach-acr acrprod2026
```

## 📌 6. AKS + Helm Integration

```bash
# Scenario: Deploy NGINX Ingress Controller via Helm
az aks get-credentials -g rg-prod -n aks-prod

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress --create-namespace \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz

# Scenario: Deploy cert-manager for TLS
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
