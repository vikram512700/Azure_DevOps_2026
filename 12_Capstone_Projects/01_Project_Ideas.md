# 🎓 Capstone Projects

### 🎯 Put your DevOps skills to the test!

Once you have learned the core tools (Linux, Git, Docker, Kubernetes, Cloud, IaC, CI/CD), the best way to prove your skills for a resume or interview is to build **end-to-end projects**.

Here are 3 progressive projects you can build using the folders in this curriculum.

______________________________________________________________________

## 🥉 Project 1: The Classic 3-Tier App (VMs & Automation)

**Goal**: Deploy a Web app, App server, and Database across 3 Linux VMs using automation.

**The Architecture**:

- 1 Nginx Web Server (Frontend)
- 1 Node.js API Server (Backend)
- 1 PostgreSQL Server (Database)

**Your Tasks**:

1. **Azure**: Create 3 Ubuntu VMs in a VNet. Configure NSGs so the Internet can only hit Nginx, Nginx can only hit Node, and Node can only hit Postgres.
1. **Ansible**: Write playbooks to install Nginx, Node.js, and Postgres on their respective VMs without SSHing in manually.
1. **Scripting**: Write a Bash script that backs up the Postgres database every night.

______________________________________________________________________

## 🥈 Project 2: Containerized CI/CD Pipeline

**Goal**: Take a simple web app, containerize it, and deploy it automatically every time code changes.

**The Architecture**:

- GitHub Repository
- GitHub Actions / Azure DevOps
- Azure Container Registry (ACR)
- Azure Web App for Containers

**Your Tasks**:

1. **Docker**: Write a `Dockerfile` for a simple Python Flask or Node.js app.
1. **Git**: Push the code to a GitHub repository.
1. **CI/CD**: Create a pipeline that:
   - Triggers when you push to the `main` branch.
   - Builds the Docker image.
   - Pushes the image to Azure Container Registry.
   - Restarts the Azure Web App to pull the new image.
1. **Testing**: Make a change to the app's HTML, commit it, and watch the live website update 2 minutes later without touching anything!

______________________________________________________________________

## 🥇 Project 3: The Ultimate Cloud-Native E-Commerce Platform

**Goal**: Deploy a microservices architecture using modern tools (Terraform, Kubernetes, DevSecOps).

**The Architecture**:

- Azure Kubernetes Service (AKS)
- Azure Key Vault
- Prometheus & Grafana

**Your Tasks**:

1. **Terraform**: Write IaC to provision the AKS cluster, VNet, and Key Vault.
1. **DevSecOps**: Integrate Checkov into your pipeline to scan the Terraform code before deployment.
1. **Kubernetes**: Write YAML manifests (`Deployment`, `Service`, `Ingress`) to deploy 3 microservices (Cart, Products, Orders) into the AKS cluster.
1. **Monitoring**: Deploy Prometheus and Grafana using Helm charts into the cluster, and create a dashboard showing CPU usage for your microservices.

______________________________________________________________________

> 💡 **Tip for Interviews**: Don't just build these — document them! Create a neat GitHub README with architecture diagrams (using draw.io) and instructions on how to run your code. This is what hiring managers want to see!
