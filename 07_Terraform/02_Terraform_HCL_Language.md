# 02 — Terraform HCL Language (Beginner to Advanced)

> **Who is this for?**
> If you have never written code before — this file is for you.
> We start from the very beginning: what is a variable, what is a string,
> what is a boolean — with plain English explanations and real Azure examples.

______________________________________________________________________

## PART 1 — Understanding the Building Blocks

______________________________________________________________________

## 1. What is HCL?

HCL stands for **HashiCorp Configuration Language**.
Think of it as a **structured instruction sheet** you write to tell Terraform:

- **What** to create in Azure (a Virtual Machine, a database, a network...)
- **How** to configure it (size, location, name...)
- **When** to create or skip things

You write HCL in files that end with `.tf`

```
You write .tf file  →  Terraform reads it  →  Azure gets created
```

A `.tf` file looks like this at the simplest level:

```hcl
# This is a comment — Terraform ignores lines starting with #
# A comment is a note you write for yourself, Terraform skips it

resource "azurerm_resource_group" "main" {
  name     = "rg-my-first-app"
  location = "East US"
}
```

**Reading it in plain English:**

> "Hey Terraform, create a Resource Group in Azure.
> Name it `rg-my-first-app` and put it in the `East US` region."

______________________________________________________________________

## 2. HCL Block Structure — The Skeleton

Every piece of Terraform code is built from **blocks**.
A block is like a paragraph — it groups related settings together.

```
┌─────────────────────────────────────────────────────┐
│  BLOCK TYPE   LABEL 1          LABEL 2              │
│      ↓           ↓                ↓                 │
│  resource  "azurerm_resource_group"  "main"  {      │
│    name     = "rg-my-app"   ← argument (key=value)  │
│    location = "East US"     ← argument (key=value)  │
│  }                          ← closing curly brace   │
└─────────────────────────────────────────────────────┘
```

### The main block types you will use:

| Block Type | What it does | Think of it as... |
|------------|-------------|------------------|
| `resource` | Creates something in Azure | An order form: "make me this" |
| `variable` | Declares an input that can change | A blank form field |
| `locals` | Stores a computed value | A sticky note with a formula |
| `output` | Prints a result after apply | A receipt shown at the end |
| `data` | Reads existing Azure resources | A lookup / query |
| `module` | Calls a reusable set of code | A template / blueprint |
| `provider` | Connects Terraform to Azure | Login credentials |
| `terraform` | Settings for Terraform itself | App preferences |

______________________________________________________________________

## PART 2 — Data Types Explained

______________________________________________________________________

## 3. What is a Data Type?

A **data type** tells Terraform what KIND of value something is.
Just like in real life:

- A **phone number** is digits only
- A **name** is text
- A **yes/no question** is true or false
- A **shopping list** is multiple items

Terraform has the same idea.

______________________________________________________________________

## 4. string — Text

A **string** is simply **text** — words, sentences, names, paths.

```
"Hello"          → string
"East US"        → string
"rg-my-app-dev"  → string
"true"           → this is STILL a string (it has quotes)
```

**Rule:** If it has **double quotes `" "`** around it → it is a string.

```hcl
# Declaring a string variable
variable "environment" {
  type        = string          # ← telling Terraform: this must be text
  description = "The environment name (dev, staging or prod)"
  default     = "dev"           # ← default value if nothing is provided
}

variable "location" {
  type        = string
  description = "Which Azure region to deploy to"
  default     = "East US"
}

variable "project_name" {
  type        = string
  description = "Short name for the project - used in all resource names"
  default     = "payment"
}
```

**Using a string variable inside a resource:**

```hcl
resource "azurerm_resource_group" "main" {
  name     = var.environment    # ← reads the variable value: "dev"
  location = var.location       # ← reads the variable value: "East US"
}
```

**String Interpolation — joining strings together:**

`${ }` means "insert the value of this variable here"

```hcl
# Without interpolation (just text):
name = "rg-payment-dev"

# With interpolation (dynamic — built from variables):
name = "rg-${var.project_name}-${var.environment}"
#          ↑ inserts "payment"   ↑ inserts "dev"
# Result: "rg-payment-dev"

# More examples:
vm_name    = "vm-${var.project_name}-${var.environment}-01"
# Result:     "vm-payment-dev-01"

dns_prefix = "${var.project_name}${var.environment}"
# Result:     "paymentdev"
```

______________________________________________________________________

## 5. number — A Numeric Value

A **number** is exactly what it sounds like — a whole number or decimal.

```
1        → number
42       → number
3.14     → number (decimal)
100      → number
"100"    → NOT a number — this is a STRING (has quotes)
```

**Rule:** No quotes = number. With quotes = string.

```hcl
# Declaring number variables
variable "vm_count" {
  type        = number
  description = "How many virtual machines to create"
  default     = 2             # ← no quotes → this is the number 2
}

variable "disk_size_gb" {
  type        = number
  description = "OS disk size in gigabytes"
  default     = 128
}

variable "node_count" {
  type        = number
  description = "Number of nodes in the AKS cluster"
  default     = 3
}

variable "max_pods_per_node" {
  type        = number
  description = "Maximum pods per AKS node"
  default     = 110
}
```

**Using number variables:**

```hcl
resource "azurerm_kubernetes_cluster" "main" {
  name = "aks-payment-dev"

  default_node_pool {
    node_count = var.node_count          # ← uses the number 3
    max_pods   = var.max_pods_per_node   # ← uses the number 110
  }
}

# Arithmetic with numbers
locals {
  total_disk_size = var.disk_size_gb * 2    # 128 * 2 = 256
  half_nodes      = var.node_count / 2      # 3 / 2 = 1.5
  nodes_plus_one  = var.node_count + 1      # 3 + 1 = 4
}
```

______________________________________________________________________

## 6. bool — True or False (Yes or No)

A **bool** (short for boolean) can only ever be one of two values:

- `true` → yes, on, enabled
- `false` → no, off, disabled

**No quotes around true or false!**

```
true   → bool (enabled)
false  → bool (disabled)
"true" → this is a STRING, not a bool
```

**Real-world analogy:** A light switch — it's either ON (`true`) or OFF (`false`).

```hcl
# Declaring bool variables
variable "enable_monitoring" {
  type        = bool
  description = "Should Azure Monitor / Log Analytics be enabled?"
  default     = true          # ← monitoring is ON by default
}

variable "enable_auto_scaling" {
  type        = bool
  description = "Should the AKS cluster automatically scale up/down?"
  default     = false         # ← auto-scaling is OFF by default
}

variable "public_access_enabled" {
  type        = bool
  description = "Should the database be publicly accessible? (NEVER true in prod)"
  default     = false         # ← keep databases private
}

variable "https_only" {
  type        = bool
  description = "Force HTTPS-only traffic to the web app?"
  default     = true          # ← always enforce HTTPS
}
```

**Using bool variables:**

```hcl
resource "azurerm_linux_web_app" "main" {
  name     = "app-payment-dev"
  location = var.location

  https_only = var.https_only              # true → HTTPS enforced

  site_config {
    always_on = var.enable_monitoring      # true → app never sleeps
  }
}

resource "azurerm_mssql_server" "main" {
  name = "sql-payment-dev"

  public_network_access_enabled = var.public_access_enabled  # false → private only
}
```

**Bool with if-logic (ternary):**

```hcl
# Syntax: condition ? value_if_true : value_if_false
# Read as: "IF condition THEN this ELSE that"

locals {
  # IF environment is prod THEN 3 nodes ELSE 1 node
  node_count = var.environment == "prod" ? 3 : 1

  # IF https_only is true THEN "Enforce" ELSE "Allow"
  tls_policy = var.https_only == true ? "Enforce" : "Allow"

  # IF monitoring enabled THEN "PerGB2018" ELSE "Free"
  log_sku    = var.enable_monitoring ? "PerGB2018" : "Free"
  #                                 ↑ no == true needed for bool
}
```

______________________________________________________________________

## 7. list — An Ordered Collection of Items

A **list** is like a **shopping list** — multiple items, in order, with duplicates allowed.

```
["apple", "banana", "cherry"]    → list of strings
[1, 2, 3, 4, 5]                  → list of numbers
["East US", "West Europe"]       → list of Azure regions
["10.0.1.0/24", "10.0.2.0/24"]  → list of IP ranges
```

**Rules:**

- Items are inside square brackets `[ ]`
- Items are separated by commas `,`
- Order matters (item 0 is first, item 1 is second...)
- Can contain duplicates

```hcl
# list(string) — a list of text values
variable "allowed_ip_addresses" {
  type        = list(string)
  description = "IP addresses allowed to access the management port"
  default     = [
    "203.0.113.10",       # ← first item (index 0) — office IP
    "198.51.100.20",      # ← second item (index 1) — VPN IP
    "10.0.0.0/8",         # ← third item (index 2) — internal network
  ]
}

# list(string) — Azure availability zones
variable "availability_zones" {
  type        = list(string)
  description = "Azure availability zones for HA deployment"
  default     = ["1", "2", "3"]   # three zones for high availability
}

# list(number)
variable "allowed_ports" {
  type        = list(number)
  description = "Allowed inbound ports"
  default     = [80, 443, 8080]
}
```

**Accessing list items by index (position):**

```hcl
# Index starts at 0 (not 1!) — this is standard in programming
locals {
  first_zone  = var.availability_zones[0]   # "1"
  second_zone = var.availability_zones[1]   # "2"
  third_zone  = var.availability_zones[2]   # "3"

  first_ip    = var.allowed_ip_addresses[0] # "203.0.113.10"
}
```

**Using a list in a resource:**

```hcl
resource "azurerm_virtual_network" "main" {
  name          = "vnet-payment-dev"
  address_space = ["10.0.0.0/16"]   # ← list(string) with one item

  # Multiple DNS servers — a list
  dns_servers   = ["168.63.129.16", "8.8.8.8"]
}

resource "azurerm_subnet" "aks" {
  name             = "snet-aks"
  address_prefixes = var.allowed_ip_addresses   # pass whole list
}
```

______________________________________________________________________

## 8. map — A Key-Value Dictionary

A **map** is like a **dictionary** or a **lookup table** — every item has a name (key) and a value.

```
{
  "Environment" = "dev"      ← key = "Environment", value = "dev"
  "Project"     = "payment"  ← key = "Project",     value = "payment"
  "Owner"       = "devops"   ← key = "Owner",        value = "devops"
}
```

**Real-world analogy:** Like a contacts app — name is the key, phone number is the value.

```
"Vikram" → "555-1234"
"Alice"  → "555-5678"
```

```hcl
# map(string) — all values are text
variable "resource_tags" {
  type        = map(string)
  description = "Tags to attach to every Azure resource for cost tracking"
  default = {
    Environment = "dev"             # key = Environment, value = "dev"
    Project     = "payment-service" # key = Project,     value = "payment-service"
    ManagedBy   = "terraform"       # key = ManagedBy,   value = "terraform"
    Owner       = "devops-team"     # key = Owner,       value = "devops-team"
    CostCenter  = "engineering"     # key = CostCenter,  value = "engineering"
  }
}

# map(number) — all values are numbers
variable "vm_sizes_per_env" {
  type = map(number)
  description = "Number of VMs to create per environment"
  default = {
    dev     = 1
    staging = 2
    prod    = 5
  }
}

# map(string) — region short codes
variable "region_short_codes" {
  type = map(string)
  description = "Short code for each Azure region (used in naming)"
  default = {
    "East US"       = "eus"
    "East US 2"     = "eus2"
    "West US"       = "wus"
    "West Europe"   = "weu"
    "UK South"      = "uks"
    "North Europe"  = "neu"
  }
}
```

**Accessing map values:**

```hcl
locals {
  # Get a value by its key using dot notation or bracket notation
  vm_count_for_env = var.vm_sizes_per_env[var.environment]
  # if var.environment = "prod" → returns 5

  region_code = var.region_short_codes[var.location]
  # if var.location = "East US" → returns "eus"

  # lookup() — get value with a fallback default
  region_code_safe = lookup(var.region_short_codes, var.location, "unknown")
  # if var.location not found → returns "unknown" instead of erroring
}
```

**Using a map for tags (very common pattern):**

```hcl
resource "azurerm_resource_group" "main" {
  name     = "rg-payment-dev-eus"
  location = "East US"
  tags     = var.resource_tags   # ← pass the whole map
  # Azure applies all the key=value pairs as tags
}
```

______________________________________________________________________

## 9. object — A Group of Named Properties

An **object** is like a **form with labelled fields** — each field has a name and a type.

**Real-world analogy:** An employee record form:

```
Name:          (text)
Age:           (number)
IsManager:     (yes/no)
PhoneNumbers:  (list)
```

In Terraform, you define what the shape of the form looks like:

```hcl
# object — define the exact structure of config in one variable
variable "virtual_machine_config" {
  type = object({
    size           = string   # ← VM size: "Standard_B2ms"
    admin_username = string   # ← login name: "azureuser"
    disk_size_gb   = number   # ← disk in GB: 128
    enable_ssh     = bool     # ← allow SSH: true
    open_ports     = list(string)  # ← ports: ["22", "80"]
  })

  description = "All configuration for the virtual machine in one block"

  default = {
    size           = "Standard_B2ms"
    admin_username = "azureuser"
    disk_size_gb   = 128
    enable_ssh     = true
    open_ports     = ["22", "80", "443"]
  }
}
```

**Accessing object properties:**

```hcl
resource "azurerm_linux_virtual_machine" "app" {
  name  = "vm-payment-dev"
  size  = var.virtual_machine_config.size           # "Standard_B2ms"

  admin_username = var.virtual_machine_config.admin_username  # "azureuser"

  os_disk {
    disk_size_gb = var.virtual_machine_config.disk_size_gb  # 128
  }
}
```

**list(object) — a list of structured items:**

```hcl
# Think of this as: a table with columns
variable "subnets" {
  type = list(object({
    name             = string        # subnet name
    address_prefix   = string        # IP range
    is_private       = bool          # is it private?
    service_endpoints = list(string) # Azure service endpoints
  }))

  default = [
    # Row 1
    {
      name              = "snet-aks"
      address_prefix    = "10.0.1.0/24"
      is_private        = true
      service_endpoints = ["Microsoft.ContainerRegistry", "Microsoft.KeyVault"]
    },
    # Row 2
    {
      name              = "snet-app"
      address_prefix    = "10.0.2.0/24"
      is_private        = true
      service_endpoints = ["Microsoft.Sql"]
    },
    # Row 3
    {
      name              = "snet-mgmt"
      address_prefix    = "10.0.3.0/24"
      is_private        = false
      service_endpoints = []
    },
  ]
}
```

______________________________________________________________________

## 10. set — A List with No Duplicates, No Order

A **set** is like a **bag of unique items** — no duplicates allowed, no guaranteed order.

```
set(string)  →  {"apple", "banana", "cherry"}   ← no duplicates, unordered
list(string) →  ["apple", "banana", "apple"]    ← duplicates ok, ordered
```

**When to use set vs list:**

- Use `list` when **order matters** or **duplicates are ok**
- Use `set` when you just want **unique values** and order doesn't matter
- Terraform's `for_each` requires a `set` or `map` (not a `list`)

```hcl
# set(string) — unique availability zones
variable "availability_zones" {
  type        = set(string)
  description = "Unique availability zones — no duplicates allowed"
  default     = ["1", "2", "3"]
}

# Converting a list to a set (removes duplicates)
locals {
  # toset() converts a list to a set — also used to enable for_each on lists
  zone_set = toset(["1", "2", "3", "2"])   # becomes {"1", "2", "3"} — "2" deduplicated
}
```

______________________________________________________________________

## PART 3 — Variables In Depth

______________________________________________________________________

## 11. What is a Variable?

A **variable** is a **placeholder** that holds a value which can change.

**Real-world analogy:** Think of a variable like a **label on a box**.

- The label says "ENVIRONMENT"
- Sometimes the box contains "dev"
- Sometimes the box contains "staging"
- Sometimes the box contains "prod"
- The label (variable name) stays the same — only the contents change

**Why use variables instead of hardcoding values?**

```hcl
# WITHOUT variables — BAD practice
# You'd have to change "dev" in 50 places when deploying to prod
resource "azurerm_resource_group" "main" {
  name = "rg-payment-dev-eus"    # hardcoded "dev"
}

resource "azurerm_virtual_network" "main" {
  name = "vnet-payment-dev-eus"  # hardcoded "dev" again
}

# WITH variables — GOOD practice
# Change var.environment once → updates everywhere
resource "azurerm_resource_group" "main" {
  name = "rg-payment-${var.environment}-eus"
}

resource "azurerm_virtual_network" "main" {
  name = "vnet-payment-${var.environment}-eus"
}
```

______________________________________________________________________

## 12. Anatomy of a Variable Declaration

```hcl
variable "environment" {
#          ↑
#          This is the variable NAME — you choose this
#          You reference it later as: var.environment

  type        = string
  #             ↑
  #             DATA TYPE — string, number, bool, list, map, object, set

  description = "The deployment environment — dev, staging or prod"
  #              ↑
  #              HUMAN DESCRIPTION — shown in errors and documentation
  #              Not required but ALWAYS add it — helps teammates

  default     = "dev"
  #              ↑
  #              DEFAULT VALUE — used if no value is provided
  #              If you omit default, Terraform will ASK you when you run plan/apply

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod. You entered: ${var.environment}"
    #                ↑
    #                VALIDATION — checks the value is acceptable
    #                Terraform shows this error message if condition is false
  }
}
```

______________________________________________________________________

## 13. Complete variables.tf for a Real Azure Project

```hcl
# variables.tf — all variable declarations for the project

# ── Basic Config ──────────────────────────────────────────────────────

variable "project" {
  type        = string
  description = "Project name — short, lowercase, used in all resource names"
  default     = "payment"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}

variable "location" {
  type        = string
  description = "Azure region to deploy all resources"
  default     = "East US"
  validation {
    condition = contains([
      "East US", "East US 2", "West US",
      "West Europe", "UK South", "North Europe"
    ], var.location)
    error_message = "Please use a supported Azure region."
  }
}

# ── Network Config ────────────────────────────────────────────────────

variable "vnet_address_space" {
  type        = list(string)
  description = "IP address space for the virtual network (CIDR notation)"
  default     = ["10.0.0.0/16"]
  # 10.0.0.0/16 = 65,534 usable IP addresses
}

variable "subnets" {
  type = map(object({
    address_prefixes  = list(string)  # IP range for this subnet
    service_endpoints = list(string)  # Azure services to allow
  }))
  description = "Subnets to create inside the VNet"
  default = {
    "snet-aks" = {
      address_prefixes  = ["10.0.1.0/24"]   # 254 IPs for AKS nodes
      service_endpoints = ["Microsoft.ContainerRegistry"]
    }
    "snet-app" = {
      address_prefixes  = ["10.0.2.0/24"]   # 254 IPs for App Service
      service_endpoints = ["Microsoft.Sql"]
    }
    "snet-data" = {
      address_prefixes  = ["10.0.3.0/24"]   # 254 IPs for databases
      service_endpoints = ["Microsoft.Sql", "Microsoft.Storage"]
    }
  }
}

# ── Compute Config ────────────────────────────────────────────────────

variable "vm_size" {
  type        = string
  description = "Azure VM size (SKU)"
  default     = "Standard_B2ms"
  # Standard_B2ms = 2 vCPU, 8 GB RAM — good for dev
  # Standard_D4s_v3 = 4 vCPU, 16 GB RAM — good for prod
}

variable "vm_admin_username" {
  type        = string
  description = "Admin username for the virtual machine"
  default     = "azureuser"
}

# ── AKS Config ────────────────────────────────────────────────────────

variable "kubernetes_version" {
  type        = string
  description = "Kubernetes version to deploy on AKS"
  default     = "1.28.5"
}

variable "aks_node_count" {
  type        = number
  description = "Number of nodes in the default AKS node pool"
  default     = 2
}

variable "aks_node_vm_size" {
  type        = string
  description = "VM size for AKS nodes"
  default     = "Standard_D2s_v3"
}

variable "aks_enable_auto_scaling" {
  type        = bool
  description = "Enable automatic node count scaling based on workload"
  default     = false
}

variable "aks_node_min_count" {
  type        = number
  description = "Minimum node count (only used when auto-scaling is enabled)"
  default     = 1
}

variable "aks_node_max_count" {
  type        = number
  description = "Maximum node count (only used when auto-scaling is enabled)"
  default     = 5
}

# ── Database Config ───────────────────────────────────────────────────

variable "db_admin_username" {
  type        = string
  description = "SQL administrator username"
  default     = "sqladmin"
}

variable "db_sku" {
  type        = string
  description = "Azure SQL Database pricing tier"
  default     = "S0"
  # S0   = Basic   (dev/test, cheap)
  # S2   = Standard (staging)
  # P1   = Premium  (prod, high performance)
  # BusinessCritical_Gen5_4 = mission-critical prod
}

variable "db_public_access" {
  type        = bool
  description = "Allow connections from the public internet? (should be false in prod)"
  default     = false
}

# ── Tags ──────────────────────────────────────────────────────────────

variable "owner_email" {
  type        = string
  description = "Email of the team or person responsible for this deployment"
  default     = "devops-team@company.com"
}

variable "cost_center" {
  type        = string
  description = "Cost center code for billing and chargeback"
  default     = "engineering"
}

variable "additional_tags" {
  type        = map(string)
  description = "Any extra tags to add to all resources"
  default     = {}   # empty map by default
}
```

______________________________________________________________________

## PART 4 — Locals, Outputs, Data Sources

______________________________________________________________________

## 14. Locals — Your Private Computed Notes

A **local** is a value you compute once and reuse many times in the same file.

**Real-world analogy:** Imagine you work out a formula on a sticky note:

```
sticky note: full_name = first_name + " " + last_name
             full_name = "Vikram Akula"
```

You compute it once, then just refer to `full_name` everywhere else.

```hcl
# locals.tf

locals {

  # ── Simple computed string ────────────────────────────────
  # Build a naming prefix used in every resource name
  # Result for dev in East US: "payment-dev-eus"
  location_short = {
    "East US"      = "eus"
    "East US 2"    = "eus2"
    "West US"      = "wus"
    "West Europe"  = "weu"
    "UK South"     = "uks"
    "North Europe" = "neu"
  }[var.location]   # ← look up var.location in the map above

  prefix = "${var.project}-${var.environment}-${local.location_short}"
  # For project="payment", environment="dev", location="East US":
  # prefix = "payment-dev-eus"


  # ── Resource names built from prefix ─────────────────────
  rg_name       = "rg-${local.prefix}"         # "rg-payment-dev-eus"
  vnet_name     = "vnet-${local.prefix}"        # "vnet-payment-dev-eus"
  aks_name      = "aks-${local.prefix}"         # "aks-payment-dev-eus"
  acr_name      = "acr${replace(local.prefix, "-", "")}"
  # ACR names cannot have hyphens → "acrpaymentdeveus"
  kv_name       = "kv-${local.prefix}"          # "kv-payment-dev-eus"
  sql_name      = "sql-${local.prefix}"         # "sql-payment-dev-eus"
  log_name      = "log-${local.prefix}"         # "log-payment-dev-eus"


  # ── Conditional values based on environment ───────────────
  # IF environment is "prod" THEN use expensive SKU ELSE use cheap SKU
  app_service_sku = var.environment == "prod" ? "P3v3"     : "B1"
  db_replication  = var.environment == "prod" ? "GZRS"     : "LRS"
  aks_tier        = var.environment == "prod" ? "Standard" : "Free"
  acr_sku         = var.environment == "prod" ? "Premium"  : "Standard"

  # IF environment is "prod" THEN 3 nodes ELSE 1 node
  aks_nodes_actual = var.environment == "prod" ? 3 : (
    var.environment == "staging" ? 2 : 1
  )
  # prod → 3, staging → 2, dev → 1


  # ── Tags applied to EVERY resource ───────────────────────
  # merge() combines multiple maps into one
  common_tags = merge(
    # base tags
    {
      Environment = var.environment
      Project     = var.project
      Location    = var.location
      ManagedBy   = "terraform"
      Owner       = var.owner_email
      CostCenter  = var.cost_center
    },
    # any extra tags the user passed in
    var.additional_tags
  )
  # Result:
  # {
  #   Environment = "dev"
  #   Project     = "payment"
  #   Location    = "East US"
  #   ManagedBy   = "terraform"
  #   Owner       = "devops-team@company.com"
  #   CostCenter  = "engineering"
  # }
}
```

**Using locals in resources:**

```hcl
resource "azurerm_resource_group" "main" {
  name     = local.rg_name       # "rg-payment-dev-eus"
  location = var.location
  tags     = local.common_tags   # all tags applied automatically
}

resource "azurerm_virtual_network" "main" {
  name                = local.vnet_name     # "vnet-payment-dev-eus"
  address_space       = var.vnet_address_space
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}
```

______________________________________________________________________

## 15. Outputs — The Receipt After Apply

An **output** is a value Terraform prints on screen after it finishes building your infrastructure.
It's like a receipt that tells you what was created and how to connect to it.

```
terraform apply finishes
      ↓
Outputs:
  resource_group_name = "rg-payment-dev-eus"
  aks_cluster_name    = "aks-payment-dev-eus"
  acr_login_server    = "acrpaymentdeveus.azurecr.io"
  sql_server_fqdn     = "sql-payment-dev-eus.database.windows.net"
```

```hcl
# outputs.tf

# ── Basic outputs ─────────────────────────────────────────────
output "resource_group_name" {
  description = "Name of the deployed resource group"
  value       = azurerm_resource_group.main.name
  # .name ← the actual name Azure assigned
}

output "resource_group_id" {
  description = "Full Azure resource ID of the resource group"
  value       = azurerm_resource_group.main.id
  # .id ← the full ARM resource ID path
  # e.g. /subscriptions/xxx/resourceGroups/rg-payment-dev-eus
}

output "location" {
  description = "Azure region where all resources are deployed"
  value       = var.location
}

# ── Network outputs ───────────────────────────────────────────
output "vnet_id" {
  description = "Resource ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "subnet_ids" {
  description = "Map of subnet name → subnet ID (use to connect other resources)"
  value = {
    for name, subnet in azurerm_subnet.subnets :
    name => subnet.id
  }
  # Result:
  # {
  #   "snet-aks"  = "/subscriptions/.../subnets/snet-aks"
  #   "snet-app"  = "/subscriptions/.../subnets/snet-app"
  #   "snet-data" = "/subscriptions/.../subnets/snet-data"
  # }
}

# ── AKS outputs ───────────────────────────────────────────────
output "aks_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "aks_kube_config" {
  description = "Kubeconfig to connect kubectl to the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
  # sensitive = true → Terraform HIDES this in terminal output
  # (still saved in state, but not printed on screen)
  # Use: terraform output -raw aks_kube_config
}

# ── Database outputs ──────────────────────────────────────────
output "sql_server_fqdn" {
  description = "Fully qualified domain name for the SQL server"
  value       = azurerm_mssql_server.main.fully_qualified_domain_name
  # e.g. sql-payment-dev-eus.database.windows.net
}

# ── ACR output ────────────────────────────────────────────────
output "acr_login_server" {
  description = "ACR login server URL (used in docker push/pull)"
  value       = azurerm_container_registry.main.login_server
  # e.g. acrpaymentdeveus.azurecr.io
}

output "key_vault_uri" {
  description = "URI of the Key Vault (used by applications to fetch secrets)"
  value       = azurerm_key_vault.main.vault_uri
}
```

```bash
# Reading outputs after apply
terraform output                               # show all outputs
terraform output resource_group_name          # show one output
terraform output -raw aks_kube_config         # raw (no quotes, good for scripts)
terraform output -json                         # all outputs as JSON
terraform output -json | jq '.sql_server_fqdn.value'  # parse with jq
```

______________________________________________________________________

## 16. Data Sources — Read Without Creating

A **data source** lets Terraform look up an existing Azure resource **without creating or managing it**.

**Real-world analogy:** You're building a house and you need to know the address of the nearest fire station. You don't build the fire station — you just look it up.

```hcl
# data.tf

# ── Read Azure subscription and login info ────────────────────
data "azurerm_subscription" "current" {}
# No arguments needed — reads the current subscription you're logged in with

data "azurerm_client_config" "current" {}
# Reads:
#   .tenant_id     — your Azure AD tenant
#   .object_id     — your service principal's object ID
#   .client_id     — your service principal's app ID

# Usage:
resource "azurerm_key_vault" "main" {
  tenant_id = data.azurerm_client_config.current.tenant_id  # auto-filled
}


# ── Read an existing Resource Group ──────────────────────────
# Scenario: The networking team created the VNet already.
# Your team deploys the app inside it.
data "azurerm_resource_group" "networking" {
  name = "rg-shared-networking-prod"
  # ← must match the EXACT name in Azure
}

# Now use it — don't hardcode the location
resource "azurerm_virtual_network" "app" {
  location            = data.azurerm_resource_group.networking.location
  resource_group_name = data.azurerm_resource_group.networking.name
}


# ── Read an existing VNet and Subnet ─────────────────────────
data "azurerm_virtual_network" "shared" {
  name                = "vnet-shared-prod-eus"
  resource_group_name = data.azurerm_resource_group.networking.name
}

data "azurerm_subnet" "aks" {
  name                 = "snet-aks"
  virtual_network_name = data.azurerm_virtual_network.shared.name
  resource_group_name  = data.azurerm_resource_group.networking.name
}

# Now your AKS cluster deploys into the existing subnet
resource "azurerm_kubernetes_cluster" "main" {
  default_node_pool {
    vnet_subnet_id = data.azurerm_subnet.aks.id  # ← pre-existing subnet
  }
}


# ── Read a Key Vault secret ───────────────────────────────────
# Scenario: A secret was already stored in Key Vault by a human.
# Terraform reads it to pass to the database.
data "azurerm_key_vault" "shared" {
  name                = "kv-shared-prod"
  resource_group_name = "rg-shared-secrets"
}

data "azurerm_key_vault_secret" "db_password" {
  name         = "sql-admin-password"         # ← exact secret name in Key Vault
  key_vault_id = data.azurerm_key_vault.shared.id
}

resource "azurerm_mssql_server" "main" {
  administrator_login_password = data.azurerm_key_vault_secret.db_password.value
  # ← secret value pulled at plan time, never stored in your .tf files!
}
```

______________________________________________________________________

## PART 5 — Expressions and Functions

______________________________________________________________________

## 17. Built-in Functions — Explained Simply

Terraform has many built-in helper functions. Think of them as tools in a toolbox.

### String Functions

```hcl
locals {
  # upper() — convert to UPPERCASE
  env_upper = upper("dev")        # → "DEV"
  env_upper2 = upper(var.environment)  # → "DEV" if var.environment = "dev"

  # lower() — convert to lowercase
  env_lower = lower("PROD")       # → "prod"
  env_lower2 = lower(var.location)   # → "east us" if var.location = "East US"

  # replace() — swap text
  # replace(original_string, what_to_find, replacement)
  no_spaces  = replace("East US", " ", "")      # → "EastUS"
  no_hyphens = replace("payment-dev-eus", "-", "")   # → "paymentdeveus"
  underscores = replace("hello world", " ", "_")     # → "hello_world"

  # trim / trimspace() — remove whitespace from edges
  cleaned = trimspace("   East US   ")   # → "East US"

  # format() — build a string with placeholders
  # %s = string placeholder, %d = number placeholder
  rg_name = format("rg-%s-%s", var.project, var.environment)
  # → "rg-payment-dev"

  # join() — connect list items into one string
  # join(separator, list)
  all_zones = join(",", ["1", "2", "3"])   # → "1,2,3"
  hyphenated = join("-", ["rg", "payment", "dev"])  # → "rg-payment-dev"

  # split() — break a string into a list
  # split(separator, string)
  parts = split("/", "10.0.0.0/24")   # → ["10.0.0.0", "24"]
  words = split("-", "rg-payment-dev")  # → ["rg", "payment", "dev"]

  # length() — count characters in a string (or items in a list)
  name_length = length("payment")    # → 7
  list_length = length(["a","b","c"]) # → 3

  # substr() — take a portion of a string
  # substr(string, offset, length)
  first3 = substr("payment", 0, 3)   # → "pay"
  first4 = substr("production", 0, 4) # → "prod"

  # contains() — check if a list contains a value (returns bool)
  valid_env = contains(["dev","staging","prod"], var.environment)
  # → true if var.environment is one of those values

  # startswith() — check if string starts with a prefix
  is_rg    = startswith("rg-payment-dev", "rg-")   # → true
  not_rg   = startswith("vnet-payment-dev", "rg-") # → false
}
```

### Collection Functions

```hcl
locals {
  # merge() — combine two or more maps into one
  base_tags  = { Environment = "dev", Project = "payment" }
  extra_tags = { Owner = "vikram", CostCenter = "eng" }
  all_tags   = merge(local.base_tags, local.extra_tags)
  # → { Environment = "dev", Project = "payment", Owner = "vikram", CostCenter = "eng" }

  # keys() — get all the keys of a map as a list
  tag_keys = keys(local.all_tags)    # → ["CostCenter", "Environment", "Owner", "Project"]

  # values() — get all the values of a map as a list
  tag_values = values(local.all_tags) # → ["eng", "dev", "vikram", "payment"]

  # lookup() — safely get a map value with a default
  # lookup(map, key, default_if_not_found)
  region_code = lookup({
    "East US"   = "eus",
    "UK South"  = "uks",
    "West US"   = "wus"
  }, var.location, "unknown")
  # If var.location = "East US" → "eus"
  # If var.location = "South Africa" → "unknown" (not in map)

  # flatten() — turn a list of lists into a flat list
  nested = [["a","b"], ["c","d"]]
  flat   = flatten(local.nested)   # → ["a", "b", "c", "d"]

  # distinct() — remove duplicate items from a list
  with_dupes    = ["east","west","east","north"]
  no_dupes      = distinct(local.with_dupes)  # → ["east", "west", "north"]

  # sort() — alphabetically sort a list
  unsorted = ["west", "east", "north", "south"]
  sorted   = sort(local.unsorted)   # → ["east", "north", "south", "west"]

  # toset() — convert list to set (removes duplicates, needed for for_each)
  subnet_list = ["snet-app", "snet-data", "snet-app"]  # has duplicate
  subnet_set  = toset(local.subnet_list)               # → {"snet-app", "snet-data"}

  # element() — get item at an index (wraps around if index too big)
  zones       = ["1", "2", "3"]
  first_zone  = element(local.zones, 0)   # → "1"
  second_zone = element(local.zones, 1)   # → "2"
}
```

### Numeric Functions

```hcl
locals {
  # max() and min()
  biggest  = max(1, 100, 42, 7)   # → 100
  smallest = min(1, 100, 42, 7)   # → 1

  # abs() — absolute value (remove negative sign)
  positive = abs(-15)              # → 15

  # ceil() — round UP to next whole number
  rounded_up   = ceil(2.1)         # → 3
  rounded_up2  = ceil(2.9)         # → 3

  # floor() — round DOWN to next whole number
  rounded_down  = floor(2.9)       # → 2
  rounded_down2 = floor(2.1)       # → 2
}
```

______________________________________________________________________

## 18. Conditional Expression (The Ternary)

```
condition ? value_if_true : value_if_false

Read as: "IF condition IS TRUE then use first value, ELSE use second value"
```

```hcl
locals {
  # Simple examples — read these out loud to understand:

  # "IF environment equals prod THEN Standard_D4s_v3 ELSE Standard_B2ms"
  vm_size = var.environment == "prod" ? "Standard_D4s_v3" : "Standard_B2ms"
  # prod  → "Standard_D4s_v3"  (powerful, expensive)
  # dev   → "Standard_B2ms"    (basic, cheap)

  # "IF environment equals prod THEN 3 nodes ELSE 1 node"
  node_count = var.environment == "prod" ? 3 : 1

  # "IF monitoring is enabled THEN PerGB2018 ELSE Free"
  log_sku = var.enable_monitoring ? "PerGB2018" : "Free"
  # var.enable_monitoring is bool — no need for == true

  # "IF environment is prod THEN prevent destroy ELSE allow it"
  prevent_destroy = var.environment == "prod" ? true : false

  # Nested ternary (chained IF-ELSE IF-ELSE)
  # "IF prod → 3, IF staging → 2, OTHERWISE → 1"
  nodes = (
    var.environment == "prod"    ? 3 :
    var.environment == "staging" ? 2 :
    1
  )
  # prod    → 3
  # staging → 2
  # dev     → 1
}
```

______________________________________________________________________

## 19. for Expressions — Loop Over a List or Map

A `for` expression builds a **new list or map** by looping over an existing one.

```hcl
# Syntax for creating a list:
# [for ITEM in COLLECTION : EXPRESSION]

# Syntax for creating a map:
# {for ITEM in COLLECTION : KEY => VALUE}
```

```hcl
# Example 1: Transform a list
variable "environments" {
  default = ["dev", "staging", "prod"]
}

locals {
  # Make every environment name UPPERCASE
  upper_envs = [for env in var.environments : upper(env)]
  # → ["DEV", "STAGING", "PROD"]

  # Add "env-" prefix to each
  prefixed_envs = [for env in var.environments : "env-${env}"]
  # → ["env-dev", "env-staging", "env-prod"]
}

# Example 2: Filter a list (keep only matching items)
locals {
  all_tags = ["dev", "staging", "prod", "test", "demo"]

  # Keep only items that start with a certain string
  real_envs = [for e in local.all_tags : e if e != "test" && e != "demo"]
  # → ["dev", "staging", "prod"]
}

# Example 3: Build a map from a list
variable "subnet_list" {
  default = [
    { name = "snet-aks",  cidr = "10.0.1.0/24" },
    { name = "snet-app",  cidr = "10.0.2.0/24" },
    { name = "snet-data", cidr = "10.0.3.0/24" },
  ]
}

locals {
  # Build a map: subnet name → CIDR
  subnet_map = { for s in var.subnet_list : s.name => s.cidr }
  # → {
  #     "snet-aks"  = "10.0.1.0/24"
  #     "snet-app"  = "10.0.2.0/24"
  #     "snet-data" = "10.0.3.0/24"
  #   }
}
```

______________________________________________________________________

## 20. Dynamic Blocks — Generate Repeated Nested Blocks

Some Azure resources have **repeating nested blocks** (like firewall rules).
Instead of copy-pasting, use `dynamic` to generate them from a list.

```hcl
# Without dynamic — lots of copy-paste:
resource "azurerm_network_security_group" "app" {
  name = "nsg-app"

  security_rule {
    name                   = "allow-http"
    priority               = 100
    access                 = "Allow"
    protocol               = "Tcp"
    destination_port_range = "80"
    # ...
  }

  security_rule {
    name                   = "allow-https"
    priority               = 110
    access                 = "Allow"
    protocol               = "Tcp"
    destination_port_range = "443"
    # ... lots of repeated code
  }

  # What if you need 20 rules? This gets messy fast.
}

# ─────────────────────────────────────────────────────────
# WITH dynamic — clean and reusable:

variable "nsg_rules" {
  description = "List of NSG rules to create"
  type = list(object({
    name     = string   # rule name
    priority = number   # 100-4096, lower = higher priority
    port     = string   # port number or range
    access   = string   # "Allow" or "Deny"
    source   = string   # source IP range or tag
  }))
  default = [
    { name = "allow-http",  priority = 100, port = "80",  access = "Allow", source = "Internet" },
    { name = "allow-https", priority = 110, port = "443", access = "Allow", source = "Internet" },
    { name = "allow-ssh",   priority = 120, port = "22",  access = "Allow", source = "10.0.0.0/8" },
    { name = "deny-all",    priority = 4000, port = "*",  access = "Deny",  source = "*" },
  ]
}

resource "azurerm_network_security_group" "app" {
  name                = "nsg-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  # dynamic block: for each item in var.nsg_rules, create a security_rule block
  dynamic "security_rule" {
    for_each = var.nsg_rules   # ← loops over the list
    # security_rule.value = current item in the loop
    # security_rule.key   = index (0, 1, 2...)

    content {
      name                       = security_rule.value.name
      priority                   = security_rule.value.priority
      direction                  = "Inbound"
      access                     = security_rule.value.access
      protocol                   = "Tcp"
      source_port_range          = "*"
      destination_port_range     = security_rule.value.port
      source_address_prefix      = security_rule.value.source
      destination_address_prefix = "*"
    }
  }

  tags = local.common_tags
}
# Terraform generates 4 security_rule blocks from the list — no copy-paste!
```

______________________________________________________________________

## Summary — Full Type Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│  TYPE          EXAMPLE VALUE              WHEN TO USE               │
├─────────────────────────────────────────────────────────────────────┤
│  string        "East US"                  Text, names, paths        │
│  number        3  /  128  /  3.14         Counts, sizes, ports      │
│  bool          true  /  false             Feature flags, on/off     │
│  list(string)  ["a", "b", "c"]            Ordered items             │
│  list(number)  [80, 443, 8080]            Ordered numbers           │
│  map(string)   { key = "value" }          Key-value lookup          │
│  set(string)   toset(["a","b"])            Unique items, for_each   │
│  object({})    { name="x", count=3 }      Structured config         │
│  list(object)  [{name="a"},{name="b"}]    Table-like data           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  FUNCTION       WHAT IT DOES              EXAMPLE                   │
├─────────────────────────────────────────────────────────────────────┤
│  upper()        Uppercase text            upper("dev") → "DEV"      │
│  lower()        Lowercase text            lower("PROD") → "prod"    │
│  replace()      Swap text                 replace("a-b","-","_")    │
│  join()         List → string             join("-",["a","b"])→"a-b" │
│  split()        String → list             split("/","a/b")→["a","b"]│
│  length()       Count items               length(["a","b"]) → 2     │
│  contains()     Is value in list?         contains(list, "dev")     │
│  merge()        Combine maps              merge(map1, map2)         │
│  lookup()       Safe map lookup           lookup(map, key, default) │
│  toset()        List → Set                toset(["a","b","a"])      │
│  flatten()      Nested list → flat        flatten([[1],[2]]) → [1,2]│
│  max/min()      Biggest/smallest          max(1,5,3) → 5            │
│  format()       Build string              format("rg-%s",var.env)   │
└─────────────────────────────────────────────────────────────────────┘
```
