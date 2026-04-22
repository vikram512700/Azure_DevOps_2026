# 🛡️ DevSecOps Basics

### 🎯 For Beginners — Building Security IN, not bolting it ON.

______________________________________________________________________

## 📌 1️⃣ What is DevSecOps?

> 💡 **Think of it like airport security:**\
> **Old Security (Gatekeeper)**: Let people do everything, but check them right before they board the plane (slow, delays flights).\
> **DevSecOps (Shift-Left)**: Check passports at ticketing, check bags at drop-off, check people at screening. Security happens at **every step**.

**Shift-Left**: Moving security testing as early as possible in the software development lifecycle (to the "left" on a timeline).

______________________________________________________________________

## 📌 2️⃣ The Tools of DevSecOps

Different tools scan different things in your CI/CD pipeline.

### 🔹 1. SAST (Static Application Security Testing)

*Reads the source code looking for bad practices.*

- **Tool**: SonarQube
- **Example**: A developer writes code susceptible to SQL Injection. SonarQube flags it before it even compiles.

### 🔹 2. SCA (Software Composition Analysis)

*Checks third-party libraries for known vulnerabilities.*

- **Tool**: Snyk, OWASP Dependency-Check
- **Example**: Your app uses `log4j v2.14` (which has a critical vulnerability). SCA fails the build and says "Upgrade to v2.17!".

### 🔹 3. Container Scanning

*Checks Docker images for outdated/vulnerable OS packages.*

- **Tool**: Trivy, Clair
- **Example**: You build an image from `ubuntu:18.04`. Trivy scans it and finds 50 high-severity CVEs (vulnerabilities). Pipeline blocked!

### 🔹 4. IaC Scanning (Infrastructure as Code)

*Checks Terraform/Bicep for cloud misconfigurations.*

- **Tool**: Checkov, tfsec
- **Example**: You write Terraform to create an AWS S3 bucket or Azure Storage account, but you accidentally leave it "Public". Checkov blocks the deployment.

______________________________________________________________________

## 📌 3️⃣ Secret Management (No Passwords in Code!)

> ❌ **The Cardinal Sin**: Putting `password = "MySuperSecret123!"` in a Github repository.

### 🔹 How to handle secrets correctly:

1. Store secrets in a secure vault (**Azure Key Vault**, **HashiCorp Vault**).
1. The code fetches the secret at runtime using a Managed Identity.
1. If a secret is accidentally committed to Git, use tools like **TruffleHog** or **GitLeaks** in your pipeline to detect it and fail the build immediately.

______________________________________________________________________

## 📌 4️⃣ Real-World DevSecOps Pipeline

```text
Developer commits code to GitHub
       ↓
[Pipeline Starts]
       ↓
1. TruffleHog  → Checks for hardcoded passwords
2. SonarQube   → Scans code for bad practices (SAST)
3. Snyk        → Checks NPM/Maven packages for vulnerabilities (SCA)
       ↓
Code Compiles & Docker Image is Built
       ↓
4. Trivy       → Scans the Docker image for Linux vulnerabilities
       ↓
Terraform Plan runs
       ↓
5. Checkov     → Scans the Terraform plan (Ensures no public databases!)
       ↓
[Deploy to Production]
```

*If ANY of steps 1-5 find a "High" or "Critical" issue, the pipeline automatically FAILS and stops the deployment.*

______________________________________________________________________

## 🧠 Summary

1. **Shift-Left**: Do security testing early and automatically in the pipeline.
1. **SAST**: Scans your code.
1. **SCA**: Scans your dependencies/libraries.
1. **Secret Scanning**: Ensures no passwords leak into Git.

## ✅ Quick Quiz

1. A developer hardcodes a database password in `config.js` and pushes to GitHub. What type of tool should catch this?
   > **Answer**: A Secret Scanner (like TruffleHog or GitLeaks). 🕵️‍♂️
1. You write Terraform code to create an open firewall rule (Port 22 to the world). What tool will catch this before deployment?
   > **Answer**: IaC Scanner (like Checkov). 🧱

______________________________________________________________________

> [!TIP]
> **Pro Tip:** Practice these commands in a lab environment to build muscle memory!
