# 05 — Terraform Modules

## 1. What is a Module?

A module is a **container for multiple resources** that are used together. Every Terraform configuration is technically a module (the root module). Child modules are reusable building blocks.

```
Root Module (your working directory)
  └── module "networking"   → ./modules/networking/
  └── module "aks"          → ./modules/aks/
  └── module "key_vault"    → ./modules/key-vault/
  └── module "aks_pool"     → git::https://github.com/org/tf-modules//aks-pool
```

**Why use modules?**
- DRY — don't repeat VNet config for dev/staging/prod
- Encapsulate complexity — callers don't need to know internals
- Enforce standards — every team uses the same approved module
- Versioning — pin modules to tested versions

---

## 2. Module Directory Structure

```
modules/
└── networking/
    ├── main.tf          # resources (VNet, subnets, NSG, route tables)
    ├── variables.tf     # input variables
    ├── outputs.tf       # output values exposed to caller
    ├── versions.tf      # provider requirements
    └── README.md        # documentation

└── aks/
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    └── versions.tf

Root:
├── main.tf              # calls modules
├── variables.tf
├── outputs.tf
├── providers.tf
├── versions.tf
└── terraform.tfvars
```

---

## 3. Writing a Reusable Module — Networking Example

### modules/networking/variables.tf

```hcl
variable "resource_group_name" {
  description = "Name of the resource group to deploy into"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
}

variable "project" {
  description = "Project name for resource naming"
  type        = string
}

variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "subnets" {
  description = "Map of subnets to create"
  type = map(object({
    address_prefixes  = list(string)
    service_endpoints = optional(list(string), [])
    nsg_rules         = optional(list(object({
      name      = string
      priority  = number
      direction = string
      access    = string
      protocol  = string
      port      = string
      source    = string
    })), [])
  }))
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

### modules/networking/main.tf

```hcl
locals {
  env_short = substr(var.environment, 0, 4)   # dev, stag, prod
  prefix    = "${var.project}-${var.environment}"
}

resource "azurerm_virtual_network" "main" {
  name                = "vnet-${local.prefix}"
  address_space       = var.vnet_address_space
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_subnet" "subnets" {
  for_each             = var.subnets
  name                 = each.key
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = each.value.address_prefixes
  service_endpoints    = each.value.service_endpoints
}

resource "azurerm_network_security_group" "subnets" {
  for_each            = var.subnets
  name                = "nsg-${each.key}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags

  dynamic "security_rule" {
    for_each = each.value.nsg_rules
    content {
      name                       = security_rule.value.name
      priority                   = security_rule.value.priority
      direction                  = security_rule.value.direction
      access                     = security_rule.value.access
      protocol                   = security_rule.value.protocol
      source_port_range          = "*"
      destination_port_range     = security_rule.value.port
      source_address_prefix      = security_rule.value.source
      destination_address_prefix = "*"
    }
  }
}

resource "azurerm_subnet_network_security_group_association" "main" {
  for_each                  = var.subnets
  subnet_id                 = azurerm_subnet.subnets[each.key].id
  network_security_group_id = azurerm_network_security_group.subnets[each.key].id
}
```

### modules/networking/outputs.tf

```hcl
output "vnet_id" {
  description = "Resource ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "subnet_ids" {
  description = "Map of subnet name to subnet resource ID"
  value       = { for k, v in azurerm_subnet.subnets : k => v.id }
}

output "subnet_address_prefixes" {
  description = "Map of subnet name to address prefix"
  value       = { for k, v in azurerm_subnet.subnets : k => v.address_prefixes[0] }
}

output "nsg_ids" {
  description = "Map of subnet name to NSG resource ID"
  value       = { for k, v in azurerm_network_security_group.subnets : k => v.id }
}
```

---

## 4. Calling a Module from Root

```hcl
# main.tf (root)

resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project}-${var.environment}-eus"
  location = var.location
  tags     = local.common_tags
}

module "networking" {
  source = "./modules/networking"

  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  environment         = var.environment
  project             = var.project

  vnet_address_space  = ["10.0.0.0/16"]

  subnets = {
    "snet-aks" = {
      address_prefixes  = ["10.0.1.0/24"]
      service_endpoints = ["Microsoft.ContainerRegistry", "Microsoft.KeyVault"]
      nsg_rules = [
        { name="allow-lb", priority=100, direction="Inbound", access="Allow", protocol="*", port="*", source="AzureLoadBalancer" }
      ]
    }
    "snet-app" = {
      address_prefixes  = ["10.0.2.0/24"]
      service_endpoints = ["Microsoft.Sql"]
    }
    "snet-data" = {
      address_prefixes  = ["10.0.3.0/24"]
      service_endpoints = ["Microsoft.Sql", "Microsoft.Storage"]
    }
  }

  tags = local.common_tags
}

# Use module outputs
module "aks" {
  source = "./modules/aks"

  subnet_id           = module.networking.subnet_ids["snet-aks"]
  resource_group_name = azurerm_resource_group.main.name
  # ...
}

output "vnet_id" {
  value = module.networking.vnet_id
}
```

---

## 5. Module Versioning — Git Source

```hcl
# Pin to a specific git tag (production best practice)
module "networking" {
  source = "git::https://github.com/myorg/tf-azure-modules.git//networking?ref=v1.4.2"
  # ...
}

# Pin to a specific commit SHA (most stable)
module "aks" {
  source = "git::https://github.com/myorg/tf-azure-modules.git//aks?ref=a3f1c9b"
  # ...
}

# Use SSH (for private repos)
module "key_vault" {
  source = "git::git@github.com:myorg/tf-azure-modules.git//key-vault?ref=v2.0.0"
  # ...
}
```

---

## 6. Terraform Registry Modules (Public)

```hcl
# Official Azure modules from registry.terraform.io
module "aks" {
  source  = "Azure/aks/azurerm"
  version = "~> 7.5"

  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  cluster_name        = "aks-${var.project}-${var.environment}"
  prefix              = var.project
  kubernetes_version  = "1.28"

  agents_size    = "Standard_D2s_v3"
  agents_count   = 3
  agents_min_count = 2
  agents_max_count = 10
  enable_auto_scaling = true

  network_plugin     = "azure"
  vnet_subnet_id     = module.networking.subnet_ids["snet-aks"]
  net_profile_dns_service_ip = "10.100.0.10"
  net_profile_service_cidr   = "10.100.0.0/16"
}
```

---

## 7. Module Composition — Complete Project Layout

```
infrastructure/
│
├── modules/                     # Reusable modules (internal library)
│   ├── resource-group/
│   ├── networking/
│   ├── key-vault/
│   ├── acr/
│   ├── aks/
│   ├── app-service/
│   ├── sql-server/
│   └── redis/
│
├── environments/
│   ├── dev/
│   │   ├── main.tf              # calls modules with dev config
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── providers.tf
│   │   ├── backend.tf           # key = "dev/main.tfstate"
│   │   └── terraform.tfvars    # dev-specific values
│   │
│   ├── staging/
│   │   ├── main.tf
│   │   ├── backend.tf           # key = "staging/main.tfstate"
│   │   └── terraform.tfvars
│   │
│   └── prod/
│       ├── main.tf
│       ├── backend.tf           # key = "prod/main.tfstate"
│       └── terraform.tfvars
```

---

## 8. Terragrunt — DRY Wrapper for Terraform

Terragrunt eliminates backend config duplication and enables hierarchical configurations.

### Directory Structure with Terragrunt

```
infrastructure/
├── terragrunt.hcl             # root config (backend, provider settings)
│
├── dev/
│   ├── terragrunt.hcl         # env-level config
│   ├── networking/
│   │   └── terragrunt.hcl     # module-level config
│   ├── aks/
│   │   └── terragrunt.hcl
│   └── apps/
│       └── terragrunt.hcl
│
├── staging/
│   └── ...
└── prod/
    └── ...
```

### Root terragrunt.hcl

```hcl
# infrastructure/terragrunt.hcl
locals {
  subscription_id = get_env("ARM_SUBSCRIPTION_ID")
  location        = "East US"
  sa_name         = "sttfstatemycompany"
  rg_name         = "rg-terraform-state"
}

generate "providers" {
  path      = "providers.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = "${local.subscription_id}"
}
EOF
}

remote_state {
  backend = "azurerm"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    resource_group_name  = local.rg_name
    storage_account_name = local.sa_name
    container_name       = "tfstate"
    key                  = "${path_relative_to_include()}/terraform.tfstate"
  }
}
```

### Environment terragrunt.hcl

```hcl
# infrastructure/dev/terragrunt.hcl
locals {
  environment = "dev"
  location    = "East US"
  project     = "payment"
}

inputs = {
  environment = local.environment
  location    = local.location
  project     = local.project
}
```

### Module terragrunt.hcl

```hcl
# infrastructure/dev/networking/terragrunt.hcl
terraform {
  source = "../../../modules//networking"
}

include "root" {
  path = find_in_parent_folders()
}

include "env" {
  path = find_in_parent_folders("dev/terragrunt.hcl")
}

dependency "resource_group" {
  config_path = "../resource-group"
  mock_outputs = {
    resource_group_name = "rg-mock"
  }
}

inputs = {
  resource_group_name = dependency.resource_group.outputs.name
  vnet_address_space  = ["10.1.0.0/16"]
  subnets = {
    "snet-aks"  = { address_prefixes = ["10.1.1.0/24"] }
    "snet-app"  = { address_prefixes = ["10.1.2.0/24"] }
    "snet-data" = { address_prefixes = ["10.1.3.0/24"] }
  }
}
```

```bash
# Terragrunt commands
terragrunt init
terragrunt plan
terragrunt apply
terragrunt destroy

# Run across all modules in a directory
cd infrastructure/dev
terragrunt run-all plan
terragrunt run-all apply --terragrunt-non-interactive

# Run for specific modules in correct dependency order
terragrunt run-all apply --terragrunt-include-dir "networking" --terragrunt-include-dir "aks"
```

---

## Summary Table

| Concept | Description |
|---------|-------------|
| `source = "./modules/x"` | Local module |
| `source = "git::...?ref=v1.0"` | Git module with version |
| `source = "Azure/aks/azurerm"` | Terraform Registry module |
| `version = "~> 7.5"` | Registry version constraint |
| `module.name.output` | Access module output |
| `modules/x/variables.tf` | Module inputs |
| `modules/x/outputs.tf` | Module exported values |
| Terragrunt `run-all apply` | Apply all modules in dependency order |
| Terragrunt `dependency` | Reference another module's outputs |
