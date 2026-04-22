# 03 — Resources, Providers & Meta-Arguments

## 1. Resource Block Anatomy

```hcl
resource "<PROVIDER>_<TYPE>" "<LOCAL_NAME>" {
  # Required arguments
  name                = "value"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  # Optional arguments
  tags = local.common_tags

  # Nested block
  sku {
    name     = "Standard"
    capacity = 2
  }

  # Meta-arguments (special — not provider-specific)
  count      = 3
  for_each   = var.subnet_map
  depends_on = [azurerm_resource_group.main]
  provider   = azurerm.secondary
  lifecycle {
    prevent_destroy = true
  }
}
```

### Resource Reference Syntax

```hcl
# Reference another resource's attribute
resource "azurerm_subnet" "app" {
  name                 = "snet-app"
  resource_group_name  = azurerm_resource_group.main.name   # reference
  virtual_network_name = azurerm_virtual_network.main.name  # reference
  address_prefixes     = ["10.0.1.0/24"]
}

# <resource_type>.<local_name>.<attribute>
# azurerm_resource_group.main.name
# azurerm_resource_group.main.id
# azurerm_resource_group.main.location
```

______________________________________________________________________

## 2. count — Create Multiple Identical Resources

```hcl
# Create 3 VMs
resource "azurerm_linux_virtual_machine" "app" {
  count               = var.vm_count   # e.g. 3
  name                = "vm-app-${count.index + 1}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  size                = var.vm_size

  # count.index = 0, 1, 2 for 3 instances
  computer_name  = "appvm${count.index + 1}"
  admin_username = "azureuser"

  network_interface_ids = [azurerm_network_interface.app[count.index].id]

  os_disk {
    name                 = "osdisk-app-${count.index + 1}"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
}

# Reference a specific instance
output "first_vm_name" {
  value = azurerm_linux_virtual_machine.app[0].name
}

# Reference all instances
output "all_vm_names" {
  value = azurerm_linux_virtual_machine.app[*].name
}

# Conditional resource (count = 0 means don't create)
resource "azurerm_monitor_diagnostic_setting" "main" {
  count = var.enable_diagnostics ? 1 : 0
  name  = "diag-${var.project}"
  # ...
}
```

______________________________________________________________________

## 3. for_each — Create Resources from a Map or Set

`for_each` is preferred over `count` when resources are distinct — removing one doesn't shift indexes.

```hcl
# for_each with a map
variable "vnets" {
  type = map(object({
    address_space = list(string)
    location      = string
  }))
  default = {
    "vnet-dev-eus" = {
      address_space = ["10.1.0.0/16"]
      location      = "East US"
    }
    "vnet-staging-eus" = {
      address_space = ["10.2.0.0/16"]
      location      = "East US"
    }
  }
}

resource "azurerm_virtual_network" "main" {
  for_each            = var.vnets
  name                = each.key                       # map key
  address_space       = each.value.address_space       # map value
  location            = each.value.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Reference: azurerm_virtual_network.main["vnet-dev-eus"].id

# for_each with a set(string)
resource "azurerm_subnet" "app" {
  for_each             = toset(["snet-app", "snet-data", "snet-mgmt"])
  name                 = each.key
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main["vnet-dev-eus"].name
  address_prefixes     = [local.subnet_cidrs[each.key]]
}

# for_each with list(object) — must convert to map first
variable "nsg_rules" {
  type = list(object({ name = string; priority = number; port = string }))
}

resource "azurerm_network_security_rule" "rules" {
  for_each = { for rule in var.nsg_rules : rule.name => rule }

  name                        = each.key
  priority                    = each.value.priority
  destination_port_range      = each.value.port
  resource_group_name         = azurerm_resource_group.main.name
  network_security_group_name = azurerm_network_security_group.app.name
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
}
```

______________________________________________________________________

## 4. depends_on — Explicit Dependencies

Terraform auto-detects dependencies from references. Use `depends_on` only when the dependency is implicit (e.g., IAM permission needed before resource creation).

```hcl
# Terraform can't detect this implicit dependency automatically
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
}

resource "azurerm_kubernetes_cluster" "main" {
  name                = "aks-app-dev"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  dns_prefix          = "aks-app-dev"

  # AKS needs ACR pull permission before it can pull images
  depends_on = [azurerm_role_assignment.aks_acr_pull]

  default_node_pool {
    name       = "default"
    node_count = 2
    vm_size    = "Standard_D2s_v3"
  }

  identity {
    type = "SystemAssigned"
  }
}
```

______________________________________________________________________

## 5. lifecycle — Control Resource Behavior

```hcl
resource "azurerm_mssql_server" "main" {
  name                = "sql-payment-prod"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  version             = "12.0"

  administrator_login          = var.db_admin_user
  administrator_login_password = var.db_admin_password

  lifecycle {
    # Never destroy this resource (even with terraform destroy)
    prevent_destroy = true

    # Ignore changes to these attributes (e.g. password changed outside Terraform)
    ignore_changes = [
      administrator_login_password,
      tags["LastModified"],
    ]

    # Create new resource before destroying old one (zero-downtime replacement)
    create_before_destroy = true
  }
}

# Real use case: replace AKS node pool without downtime
resource "azurerm_kubernetes_cluster_node_pool" "app" {
  name                  = "apppool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = var.node_vm_size
  node_count            = var.node_count

  lifecycle {
    create_before_destroy = true
    ignore_changes = [node_count]   # let autoscaler control count
  }
}

# precondition / postcondition (Terraform 1.2+)
resource "azurerm_linux_virtual_machine" "app" {
  name = "vm-app-prod"
  size = var.vm_size

  lifecycle {
    precondition {
      condition     = var.environment != "prod" || startswith(var.vm_size, "Standard_D")
      error_message = "Production VMs must use D-series for reliability."
    }
  }
}
```

______________________________________________________________________

## 6. Provider Configuration & Aliases

```hcl
# Single provider
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# Multiple providers (e.g., multi-region or multi-subscription)
provider "azurerm" {
  alias           = "primary"
  features        {}
  subscription_id = var.primary_subscription_id
}

provider "azurerm" {
  alias           = "dr"
  features        {}
  subscription_id = var.dr_subscription_id
  # Deploy to UK South for disaster recovery
}

# Use specific provider alias
resource "azurerm_resource_group" "primary" {
  provider = azurerm.primary
  name     = "rg-app-prod-eus"
  location = "East US"
}

resource "azurerm_resource_group" "dr" {
  provider = azurerm.dr
  name     = "rg-app-prod-uks"
  location = "UK South"
}

# Additional providers alongside azurerm
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.47"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
```

______________________________________________________________________

## 7. The random Provider (Common Pattern)

```hcl
# Random suffix for globally unique Azure resource names (Storage Accounts, Key Vaults)
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "azurerm_storage_account" "main" {
  name                = "st${var.project}${var.environment}${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  account_tier        = "Standard"
  account_replication_type = "LRS"
}

resource "random_password" "db_admin" {
  length           = 20
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  min_special      = 2
}

resource "azurerm_mssql_server" "main" {
  administrator_login          = "sqladmin"
  administrator_login_password = random_password.db_admin.result
  # ...
}

# Store the generated password in Key Vault
resource "azurerm_key_vault_secret" "db_password" {
  name         = "sql-admin-password"
  value        = random_password.db_admin.result
  key_vault_id = azurerm_key_vault.main.id
}
```

______________________________________________________________________

## 8. Real-Time Scenario: Multi-Environment Resource Tags

```hcl
# versions.tf
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = { source = "hashicorp/azurerm", version = "~> 3.100" }
    random  = { source = "hashicorp/random",  version = "~> 3.6"   }
  }
}

# locals.tf
locals {
  env_config = {
    dev = {
      vm_sku         = "Standard_B2ms"
      node_count     = 1
      db_sku         = "Basic"
      replication    = "LRS"
      prevent_destroy = false
    }
    staging = {
      vm_sku         = "Standard_D2s_v3"
      node_count     = 2
      db_sku         = "GeneralPurpose"
      replication    = "GRS"
      prevent_destroy = false
    }
    prod = {
      vm_sku         = "Standard_D4s_v3"
      node_count     = 3
      db_sku         = "BusinessCritical"
      replication    = "GZRS"
      prevent_destroy = true
    }
  }

  config = local.env_config[var.environment]
}

# Use in resource
resource "azurerm_mssql_database" "main" {
  name      = "db-payment-${var.environment}"
  server_id = azurerm_mssql_server.main.id
  sku_name  = local.config.db_sku

  lifecycle {
    prevent_destroy = local.config.prevent_destroy
  }
}
```

______________________________________________________________________

## Summary Table

| Meta-Argument | Purpose |
|---------------|---------|
| `count = N` | Create N identical resources |
| `count = 0` | Conditionally disable a resource |
| `for_each = map` | Create one resource per map entry |
| `for_each = toset(list)` | Create one resource per list item |
| `depends_on = [resource]` | Explicit dependency (implicit not detected) |
| `lifecycle.prevent_destroy` | Block terraform destroy |
| `lifecycle.ignore_changes` | Ignore external modifications |
| `lifecycle.create_before_destroy` | Zero-downtime replacement |
| `lifecycle.precondition` | Validate inputs before apply |
| `provider = azurerm.alias` | Use alternate provider configuration |
