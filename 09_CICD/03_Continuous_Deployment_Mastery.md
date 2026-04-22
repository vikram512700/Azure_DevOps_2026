# 🚀 03 — Continuous Deployment Mastery

While Continuous Integration (CI) is about validating that code is safe, **Continuous Deployment (CD)** is the automated process of pushing that validated code to production without human intervention. CD requires incredibly robust testing and deployment strategies to ensure zero-downtime and rapid rollbacks if something goes wrong.

______________________________________________________________________

## 📌 1. Advanced Deployment Strategies

Pushing new code to production is risky. "Best in the World" teams mitigate this risk by using advanced deployment strategies rather than simply overwriting the old application with the new one.

### 🔹 Blue-Green Deployment

In a Blue-Green deployment, you maintain two identical production environments: Blue (currently live) and Green (idle).

1. Deploy the new version of your application to the Green environment.
1. Run automated tests against Green to ensure everything works perfectly.
1. Switch the traffic router/load balancer to point to Green.
1. If a bug is discovered, instantly switch the router back to Blue (Rollback).

### 🔹 Canary Release

A Canary release gradually shifts traffic to the new version, rather than switching everyone over at once.

1. Deploy the new version to a small subset of servers.
1. Route a small percentage of user traffic (e.g., 5%) to the new version (the "Canary").
1. Monitor the Canary closely for errors, latency, or business metric drops.
1. If healthy, slowly increase the traffic to 25%, 50%, and eventually 100%. If unhealthy, automatically route traffic back to the old version.

### 🔹 Rolling Update

The deployment replaces instances of the old version with the new version one by one. This is the default deployment strategy in Kubernetes.

______________________________________________________________________

## 📌 2. Infrastructure as Code (IaC) in CD

You cannot achieve robust Continuous Deployment if your servers are configured manually. **Infrastructure as Code (IaC)** tools like Terraform or Ansible allow you to define your servers, networks, and databases as text files.

During the CD pipeline, the IaC tool runs to ensure the target environment exactly matches the required configuration before the application code is deployed.

______________________________________________________________________

## 📌 3. Real-World Example: GitOps with Kubernetes & ArgoCD

The absolute gold standard for modern Continuous Deployment is **GitOps**.

In GitOps, a Git repository acts as the single source of truth for both your application code AND your infrastructure/deployment configuration. Instead of your CI pipeline "pushing" code to the server, a software agent running *inside* your cluster (like **ArgoCD**) constantly monitors the Git repository and "pulls" changes in to keep the cluster synchronized.

### 🔹 The GitOps Workflow

1. **The Update**: A developer updates a Kubernetes Deployment manifest (e.g., changing the container image tag to `spring-boot-api:abcdef1`) and commits it to the `infrastructure` Git repository.
1. **The Sync**: ArgoCD, which lives inside your Azure Kubernetes Service (AKS) cluster, detects that the Git repository has changed.
1. **The Deployment**: ArgoCD automatically updates the Kubernetes cluster to match the exact state defined in Git.

### 🔹 ArgoCD Application Manifest (`argocd-app.yaml`)

This is the file that tells ArgoCD what to monitor and deploy.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ecommerce-api
  namespace: argocd
spec:
  # 1. Where the configuration lives (The Git Repo)
  source:
    repoURL: 'https://github.com/your-org/ecommerce-infra.git'
    targetRevision: HEAD
    path: k8s/production/api
  
  # 2. Where the application should be deployed (The Cluster)
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: ecommerce-prod
  
  # 3. How to sync (Automated)
  syncPolicy:
    automated:
      prune: true     # Delete resources in K8s that were removed from Git
      selfHeal: true  # If someone manually edits K8s, ArgoCD instantly reverts it back to match Git!
```

> [!IMPORTANT]
> Notice the `selfHeal: true` flag. This is the magic of GitOps. It completely eliminates "configuration drift." If a rogue administrator logs into the server and manually changes a configuration, ArgoCD will immediately overwrite their change because it does not match what is in the Git repository.

______________________________________________________________________

> [!TIP]
> **Pro Tip:** To practice Continuous Deployment safely, start by mastering **Continuous Delivery** first. Build a pipeline that automates everything *except* the final push to production, requiring a manual "Approve" button click. Once you have built 100% confidence in your test suite, automate the final click!
