# ☁️ 06 — Azure Identity and Access Management (IAM)

Identity is the **new perimeter**. In the cloud, there are no physical walls — your security boundary is defined entirely by *who* can access *what* and *when*. This guide covers everything you need to know about Azure's identity and access management ecosystem, from foundational authentication services to battle-tested RBAC best practices used by enterprise security teams worldwide.

---

## 📌 1. The Identity-First Security Model

Before cloud computing, organizations protected resources by guarding the physical network (firewalls, VPNs). Today, employees work from home, applications live in the cloud, and partners need access — there is no single network perimeter to guard anymore.

Azure's answer is the **Identity-First Security Model**:

```
TRADITIONAL SECURITY          │    MODERN IDENTITY-FIRST SECURITY
──────────────────────────────│────────────────────────────────────
"Trust everything inside       │    "Trust NOTHING by default.
 the network"                  │     Verify EVERY request,
                               │     regardless of where it
 [Firewall] ─── Network ───►  │     comes from."
  [Protected Resources]        │
                               │    👤 Identity = New Perimeter
                               │    🔑 Authentication + Authorization
                               │       on EVERY request
```

> [!NOTE]
> This paradigm shift is called **Zero Trust Architecture**. Azure's entire IAM ecosystem is built on this foundation. The motto is: **"Never trust, always verify."**

---

## 📌 2. Azure Active Directory — Microsoft Entra ID

**Microsoft Entra ID** (formerly known as Azure Active Directory / Azure AD) is the backbone of Azure's identity platform. It is a cloud-native **Identity Provider (IdP)** that manages users, groups, applications, and devices across your entire Azure ecosystem.

### 🔹 What Does Entra ID Do?

| Capability | Description | Real-World Example |
| :--- | :--- | :--- |
| **User Management** | Create, delete, and manage employee accounts | Onboarding a new developer |
| **Group Management** | Organize users into groups for bulk permissions | The "DevOps-Team" group gets access to all pipelines |
| **Application Registration** | Register apps to use Entra ID for sign-in | Your web app uses "Sign in with Microsoft" |
| **Device Management** | Register and manage corporate laptops/phones | Enforce Conditional Access on unmanaged devices |
| **B2B Collaboration** | Invite external partners as guest users | A vendor can access one specific Storage Account |
| **B2C (Consumer Identity)** | Allow customers to sign in with Google/Facebook | Your public-facing e-commerce app |

### 🔹 Entra ID vs. Traditional On-Premises Active Directory

| Feature | On-Premises AD (AD DS) | Microsoft Entra ID |
| :--- | :--- | :--- |
| **Protocol** | Kerberos / NTLM | OAuth 2.0 / OIDC / SAML |
| **Scope** | Local network only | Entire Internet (cloud-native) |
| **Querying** | LDAP | REST APIs / Microsoft Graph |
| **Structure** | Organizational Units (OUs) | Flat — managed through groups |
| **Primary Use** | Windows domain joined PCs | Cloud apps, SaaS, Azure Resources |

> [!IMPORTANT]
> Entra ID is **NOT** a replacement for on-premises Active Directory. They are complementary. For hybrid environments, you use **Entra Connect Sync** to synchronize on-premises AD users into Entra ID, giving users a single identity for both worlds.

---

## 📌 3. Authentication Services in Azure

Authentication is the process of proving **who you are**. Azure supports several modern authentication protocols and mechanisms.

### 🔹 Core Authentication Protocols

**OAuth 2.0 — Authorization Framework**

OAuth 2.0 is the industry-standard protocol for *delegated authorization*. It allows an application to access resources on behalf of a user, without the user sharing their password with the application.

```
User ──► App ──► "I need access to your calendar"
                    │
                    ▼
             Microsoft Entra ID
                    │
                    ▼  (User consents)
             Access Token (short-lived)
                    │
                    ▼
         App presents token to Microsoft Graph API
                    │
                    ▼
             User's Calendar Data
```

**OpenID Connect (OIDC) — Authentication Layer**

OIDC is built *on top of* OAuth 2.0. While OAuth 2.0 handles authorization ("what can you do?"), OIDC handles authentication ("who are you?"). It adds an **ID Token** (a JSON Web Token / JWT) that contains the user's identity information (name, email, etc.).

**SAML 2.0 — Enterprise SSO**

Security Assertion Markup Language (SAML) is an older XML-based protocol widely used for enterprise Single Sign-On (SSO). Azure Entra ID supports SAML 2.0 for integrating with legacy enterprise applications.

### 🔹 Modern Authentication Mechanisms

**Managed Identities — The Gold Standard for Azure Resources**

A **Managed Identity** is automatically created and managed by Azure for a service (like a VM, Function App, or AKS pod). It gives the resource its own identity in Entra ID, so it can authenticate to other Azure services (like Key Vault) without any credentials in the code.

```
❌ BAD PRACTICE:
   appsettings.json → connectionString: "...password=MySecret123!..."
   (Secret is hardcoded and will likely end up in Git!)

✅ BEST PRACTICE WITH MANAGED IDENTITY:
   Azure VM ──► "I am VM-Production-API" (Managed Identity)
            ──► Azure Key Vault: "Please give me the DB connection string"
            ──► Key Vault verifies VM's identity via Entra ID
            ──► Key Vault returns the secret at runtime
   (Zero passwords in code, ever!)
```

There are two types of Managed Identities:

| Type | Description | Best For |
| :--- | :--- | :--- |
| **System-Assigned** | Tied to one specific resource. Deleted when the resource is deleted. | Single-resource access scenarios |
| **User-Assigned** | Created independently. Can be assigned to multiple resources. | Shared identity across multiple services |

**Service Principals**

A Service Principal is an identity for an *application* or *automation tool* (like a CI/CD pipeline) to authenticate to Azure. It is like a "service account" for your apps. Unlike Managed Identities, Service Principals require managing a Client Secret or Certificate.

```bash
# Create a Service Principal for a CI/CD pipeline
az ad sp create-for-rbac \
  --name "sp-github-actions-deploy" \
  --role Contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/rg-production

# Output contains the credentials you store as GitHub Secrets:
# {
#   "appId": "...",        → AZURE_CLIENT_ID
#   "password": "...",     → AZURE_CLIENT_SECRET
#   "tenant": "..."        → AZURE_TENANT_ID
# }
```

**Multi-Factor Authentication (MFA)**

Entra ID enforces MFA via **Conditional Access Policies**. Even if a password is compromised, an attacker cannot log in without the second factor (Authenticator App, FIDO2 hardware key, SMS).

---

## 📌 4. Identity Access Management (IAM)

Azure IAM is the framework that answers: **"Who (Identity) can do What (Role/Permissions) on Which resource (Scope)?"**

The IAM model in Azure is built on three core concepts:

```
  IAM = IDENTITY + ROLE + SCOPE
  ─────────────────────────────
  │ WHO?      │ CAN DO WHAT?   │ WHERE?               │
  │ User      │ Owner          │ Management Group      │
  │ Group     │ Contributor    │ Subscription          │
  │ Service   │ Reader         │ Resource Group        │
  │ Principal │ Custom Role    │ Individual Resource   │
  └───────────┴────────────────┴──────────────────────┘
```

### 🔹 The Azure Resource Hierarchy

Understanding IAM requires first understanding how Azure organizes resources. Permissions flow *downward* through this hierarchy.

```
🏢 Entra ID Tenant
    │
    ├── 📋 Management Groups  (e.g., "Corp", "Non-Prod", "Prod")
    │       │
    │       ├── 💳 Subscriptions  (e.g., "Dev-Sub", "Prod-Sub")
    │               │
    │               ├── 📁 Resource Groups  (e.g., "rg-ecommerce-prod")
    │                       │
    │                       ├── ⚙️  VM: vm-web-01
    │                       ├── 🗄️  SQL: sql-ecommerce
    │                       └── 🪣  Storage: stgproddata01
```

> [!TIP]
> Assign permissions at the **highest appropriate level** to minimize repetition. If a team needs access to every resource in a subscription, assign the role at the Subscription level rather than one-by-one for each resource.

---

## 📌 5. Implementing RBAC (Role-Based Access Control)

**RBAC** is the mechanism that enforces IAM in Azure. Instead of granting permissions directly to individual users, you assign **Roles** (bundles of permissions) to **Identities** at specific **Scopes**.

### 🔹 Built-In Roles (The "Big Four")

| Role | Permissions | Typical User |
| :--- | :--- | :--- |
| **Owner** | Full access + can manage access (assign roles) | Subscription administrators |
| **Contributor** | Full access to create/manage resources, but CANNOT manage access | Senior DevOps Engineers |
| **Reader** | View-only access to all resources | Auditors, Stakeholders |
| **User Access Administrator** | Can ONLY manage user access; cannot touch resources | IAM administrators |

### 🔹 How RBAC Assignment Works

An RBAC assignment is a **three-part record** in Azure:

```
┌─────────────────────────────────────────────────────────────┐
│                   ROLE ASSIGNMENT                           │
│                                                             │
│  Security Principal:  dev-team@contoso.com (Entra Group)   │
│  Role Definition:     Contributor                           │
│  Scope:               /subscriptions/abc.../rg-ecommerce    │
│                                                             │
│  EFFECT: Everyone in the "dev-team" group can              │
│  create, modify, and delete all resources inside           │
│  "rg-ecommerce", but CANNOT assign roles to others.        │
└─────────────────────────────────────────────────────────────┘
```

### 🔹 Azure CLI: Assigning Roles

```bash
# 1. Get the Object ID of the user/group/service principal
az ad group show --group "DevOps-Team" --query id -o tsv

# 2. Assign the "Contributor" role to the group on a Resource Group
az role assignment create \
  --assignee "<object-id-of-group>" \
  --role "Contributor" \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-ecommerce-prod"

# 3. Verify the assignment
az role assignment list \
  --resource-group "rg-ecommerce-prod" \
  --output table

# 4. Assign "Reader" role at the Subscription level
az role assignment create \
  --assignee "<object-id>" \
  --role "Reader" \
  --scope "/subscriptions/<sub-id>"

# 5. Remove a role assignment
az role assignment delete \
  --assignee "<object-id>" \
  --role "Contributor" \
  --resource-group "rg-ecommerce-prod"
```

### 🔹 Creating Custom Roles

When the built-in roles are too broad (Contributor) or too narrow (Reader), create a **Custom Role** with exactly the permissions you need.

**Real-World Scenario:** A junior developer only needs to restart VMs in production for maintenance. You don't want to give them full Contributor access.

```json
{
  "Name": "VM Restart Operator",
  "IsCustom": true,
  "Description": "Can view VMs and restart them. Cannot create, delete, or modify them.",
  "Actions": [
    "Microsoft.Compute/virtualMachines/read",
    "Microsoft.Compute/virtualMachines/restart/action",
    "Microsoft.Compute/virtualMachines/powerOff/action"
  ],
  "NotActions": [],
  "DataActions": [],
  "NotDataActions": [],
  "AssignableScopes": [
    "/subscriptions/<sub-id>"
  ]
}
```

```bash
# Create the custom role from the JSON file
az role definition create --role-definition custom-vm-restart-role.json

# Assign the custom role to the junior developer
az role assignment create \
  --assignee "junior-dev@contoso.com" \
  --role "VM Restart Operator" \
  --scope "/subscriptions/<sub-id>/resourceGroups/rg-production"
```

---

## 📌 6. Best Practices for RBAC

These are the principles followed by world-class security and DevOps teams at enterprises like Microsoft, Google, and Amazon.

### 🔹 1. Apply the Principle of Least Privilege (PoLP)

**Never grant more access than is absolutely necessary to complete a task.** This is the single most important security principle in IAM.

```
❌ BAD:
   Grant a developer "Owner" on the entire Subscription
   because they asked for access to "a few VMs."

✅ GOOD:
   Grant the developer "Contributor" access only on the
   specific Resource Group containing those VMs.
```

### 🔹 2. Assign Roles to Groups, Not Individual Users

Managing permissions user-by-user is a nightmare at scale. Assign roles to **Entra ID Groups** and then add/remove users from the group.

```
❌ BAD:
   alice@contoso.com → Contributor → rg-ecommerce
   bob@contoso.com   → Contributor → rg-ecommerce
   carol@contoso.com → Contributor → rg-ecommerce
   (You must manually update 3 assignments when Alice leaves!)

✅ GOOD:
   Entra Group: "Backend-Dev-Team" → Contributor → rg-ecommerce
   Members: Alice, Bob, Carol
   (When Alice leaves, just remove her from the group.)
```

### 🔹 3. Use Managed Identities for Applications (Never Store Credentials)

For any Azure service that needs to communicate with another Azure service, always use a **Managed Identity**. Rotating secrets manually and accidentally committing them to Git are massive security risks.

### 🔹 4. Enforce Multi-Factor Authentication (MFA) for All Users

Use **Conditional Access Policies** in Entra ID to require MFA for all users, especially:
- All administrative roles (Global Administrator, Owner).
- Any access from outside the corporate network.
- Any access from unrecognized/unmanaged devices.

### 🔹 5. Use Just-In-Time (JIT) Access for Privileged Roles

No one should have permanent Owner or Global Administrator access. Use **Privileged Identity Management (PIM)** to require administrators to "activate" their privileged role when needed, for a limited time (e.g., 1 hour), with a business justification and optional MFA challenge.

```
WITHOUT PIM:
   Admin → Has "Owner" 24/7/365
   If account is compromised → Attacker has Owner access immediately.

WITH PIM:
   Admin → Has "Eligible for Owner" role
   When needed → Admin requests activation (justification + MFA)
   PIM grants → "Owner" access for 1 hour ONLY
   After 1 hour → Access is automatically revoked
```

### 🔹 6. Regularly Audit Role Assignments

Access that was valid 6 months ago may no longer be appropriate. Establish a regular cadence (monthly or quarterly) to review all role assignments.

```bash
# List all role assignments in a subscription for audit
az role assignment list \
  --all \
  --query "[].{Principal:principalName, Role:roleDefinitionName, Scope:scope}" \
  --output table

# Find all Owners in a subscription (critical to audit!)
az role assignment list \
  --all \
  --query "[?roleDefinitionName=='Owner'].{Principal:principalName, Scope:scope}" \
  --output table
```

### 🔹 7. Never Use the Root Management Group for Broad Assignments

Assigning a role at the root Management Group level gives access across your *entire Azure estate*, including all management groups, subscriptions, and resources. Reserve root-level assignments exclusively for emergency "Break Glass" accounts with the strictest auditing.

---

## 📌 7. Putting It All Together: A Real-World Scenario

**Scenario:** A mid-size company called Contoso is deploying an e-commerce platform on Azure. Let's design their IAM structure using all the concepts above.

```
🏢 Contoso Entra ID Tenant
│
├── 👥 Groups:
│   ├── "Infra-Admins"    (Senior SREs)
│   ├── "Backend-Devs"    (Application developers)
│   ├── "Security-Team"   (Auditors and security analysts)
│   └── "Finance-Team"    (For billing visibility only)
│
├── 📋 Management Group: Contoso-Root
│   ├── Role: "Reader" → Security-Team
│   │   (Security can see ALL resources across the company)
│   │
│   └── 💳 Subscription: Ecommerce-Production
│       ├── Role: "Contributor" → Infra-Admins
│       ├── Role: "Reader"      → Finance-Team
│       │
│       ├── 📁 rg-ecommerce-api
│       │   └── Role: "Contributor" → Backend-Devs
│       │       (Devs can deploy to the API resource group)
│       │
│       └── 📁 rg-ecommerce-data
│           └── (NO assignment for Backend-Devs)
│               (Devs CANNOT touch the production database!)
│
└── 🤖 Managed Identity: mi-ecommerce-api
    └── Role: "Key Vault Secrets User" → Azure Key Vault
        (The API app can fetch secrets, nothing else)
```

> [!TIP]
> **Pro Tip:** When building out your IAM structure, document it as code using Terraform's `azurerm_role_assignment` resource. This ensures your access control policies are version-controlled, peer-reviewed, and reproducible, just like your infrastructure!
