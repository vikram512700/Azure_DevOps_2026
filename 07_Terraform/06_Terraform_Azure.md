# 06 — Terraform with Azure — Production Examples

## 1. Resource Naming Convention

```hcl
# Azure recommended naming: <type>-<project>-<env>-<region-short>
# rg-payment-prod-eus
# vnet-payment-prod-eus
# aks-payment-prod-eus
# kv-payment-prod-eus        (Key Vault: 3-24 chars, alphanumeric+hyphens)
# acr-paymentprod            (ACR: alphanumeric only)
# st-paymentprod-eus         (Storage: 3-24 chars, lowercase alphanumeric only)

locals {
  location_short = {
    "East US"      = "eus"
    "East US 2"    = "eus2"
    "West US"      = "wus"
    "West Europe"  = "weu"
    "North Europe" = "neu"
    "UK South"     = "uks"
    "Southeast Asia" = "sea"
  }[var.location]

  prefix = "${var.project}-${var.environment}-${local.location_short}"
}
```

______________________________________________________________________

## 2. Resource Group

```hcl
resource "azurerm_resource_group" "main" {
  name     = "rg-${local.prefix}"
  location = var.location

  tags = {
    Environment  = var.environment
    Project      = var.project
    ManagedBy    = "terraform"
    Owner        = "devops-team@company.com"
    CostCenter   = var.cost_center
    CreatedDate  = formatdate("YYYY-MM-DD", timestamp())
  }

  lifecycle {
    prevent_destroy = var.environment == "prod" ? true : false
    ignore_changes  = [tags["CreatedDate"]]
  }
}
```

______________________________________________________________________

## 3. Virtual Network, Subnets & NSG

```hcl
resource "azurerm_virtual_network" "main" {
  name                = "vnet-${local.prefix}"
  address_space       = var.vnet_address_space
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_servers         = var.custom_dns_servers    # optional, use Azure default if []

  tags = local.common_tags
}

resource "azurerm_subnet" "subnets" {
  for_each             = var.subnets
  name                 = each.key
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = each.value.address_prefixes
  service_endpoints    = lookup(each.value, "service_endpoints", [])
}

resource "azurerm_network_security_group" "main" {
  name                = "nsg-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "allow-https-inbound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "deny-all-inbound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

resource "azurerm_subnet_network_security_group_association" "app" {
  subnet_id                 = azurerm_subnet.subnets["snet-app"].id
  network_security_group_id = azurerm_network_security_group.main.id
}
```

______________________________________________________________________

## 4. Azure Key Vault

```hcl
data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                        = "kv-${replace(local.prefix, "-", "")}"  # hyphens ok, max 24 chars
  location                    = var.location
  resource_group_name         = azurerm_resource_group.main.name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 90
  purge_protection_enabled    = var.environment == "prod" ? true : false
  enable_rbac_authorization   = true   # modern RBAC model (vs old access policies)

  network_acls {
    bypass         = "AzureServices"
    default_action = "Deny"
    virtual_network_subnet_ids = [azurerm_subnet.subnets["snet-app"].id]
    ip_rules       = var.allowed_ip_ranges
  }

  tags = local.common_tags
}

# Grant access — RBAC model
resource "azurerm_role_assignment" "kv_secrets_officer" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_role_assignment" "kv_app_reader" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# Store a secret
resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-admin-password"
  value        = random_password.db_admin.result
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.kv_secrets_officer]

  lifecycle {
    ignore_changes = [value]   # don't rotate password on every apply
  }
}
```

______________________________________________________________________

## 5. Azure Container Registry (ACR)

```hcl
resource "azurerm_container_registry" "main" {
  name                = "acr${replace(local.prefix, "-", "")}"   # no hyphens
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  sku                 = var.environment == "prod" ? "Premium" : "Standard"
  admin_enabled       = false   # use managed identity instead

  # Geo-replication (Premium only)
  dynamic "georeplications" {
    for_each = var.environment == "prod" ? ["UK South"] : []
    content {
      location                = georeplications.value
      zone_redundancy_enabled = true
      tags                    = local.common_tags
    }
  }

  network_rule_set {
    default_action = var.environment == "prod" ? "Deny" : "Allow"

    dynamic "virtual_network" {
      for_each = var.environment == "prod" ? [1] : []
      content {
        action    = "Allow"
        subnet_id = azurerm_subnet.subnets["snet-aks"].id
      }
    }
  }

  tags = local.common_tags
}

# Grant AKS kubelet identity pull access to ACR
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
}

output "acr_login_server" {
  value = azurerm_container_registry.main.login_server
}
```

______________________________________________________________________

## 6. Azure Kubernetes Service (AKS)

```hcl
resource "azurerm_user_assigned_identity" "aks_control_plane" {
  name                = "id-aks-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  tags                = local.common_tags
}

resource "azurerm_kubernetes_cluster" "main" {
  name                = "aks-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "aks-${local.prefix}"
  kubernetes_version  = var.kubernetes_version
  sku_tier            = var.environment == "prod" ? "Standard" : "Free"

  # Managed identity for control plane
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aks_control_plane.id]
  }

  # System node pool
  default_node_pool {
    name                 = "system"
    node_count           = var.system_node_count
    vm_size              = "Standard_D2s_v3"
    vnet_subnet_id       = azurerm_subnet.subnets["snet-aks"].id
    only_critical_addons_enabled = true   # only system pods on this pool
    os_disk_type         = "Ephemeral"
    os_disk_size_gb      = 60
    enable_auto_scaling  = var.environment == "prod" ? true : false
    min_count            = var.environment == "prod" ? 2 : null
    max_count            = var.environment == "prod" ? 5 : null
    zones                = var.environment == "prod" ? ["1", "2", "3"] : null

    upgrade_settings {
      max_surge = "33%"
    }
  }

  # Networking
  network_profile {
    network_plugin      = "azure"
    network_policy      = "azure"
    dns_service_ip      = cidrhost(var.service_cidr, 10)
    service_cidr        = var.service_cidr
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"
  }

  # Integrations
  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  }

  azure_active_directory_role_based_access_control {
    managed            = true
    azure_rbac_enabled = true
  }

  # Key Vault integration
  key_vault_secrets_provider {
    secret_rotation_enabled  = true
    secret_rotation_interval = "2m"
  }

  # HTTP application routing (dev only)
  http_application_routing_enabled = var.environment == "dev" ? true : false

  tags = local.common_tags

  lifecycle {
    ignore_changes = [
      default_node_pool[0].node_count,   # autoscaler manages this
      kubernetes_version                  # managed via upgrade commands
    ]
  }
}

# Additional user node pool
resource "azurerm_kubernetes_cluster_node_pool" "app" {
  name                  = "apppool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.main.id
  vm_size               = var.app_node_vm_size
  vnet_subnet_id        = azurerm_subnet.subnets["snet-aks"].id
  os_disk_type          = "Ephemeral"
  os_disk_size_gb       = 100
  enable_auto_scaling   = true
  min_count             = var.app_node_min_count
  max_count             = var.app_node_max_count
  zones                 = var.environment == "prod" ? ["1", "2", "3"] : null

  node_labels = {
    "workload" = "app"
    "environment" = var.environment
  }

  node_taints = []   # no taints for app pool

  tags = local.common_tags

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [node_count]
  }
}

# Grant control plane identity network permissions
resource "azurerm_role_assignment" "aks_vnet_contributor" {
  scope                = azurerm_virtual_network.main.id
  role_definition_name = "Network Contributor"
  principal_id         = azurerm_user_assigned_identity.aks_control_plane.principal_id
}

output "aks_kube_config" {
  value     = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive = true
}

output "aks_host" {
  value     = azurerm_kubernetes_cluster.main.kube_config[0].host
  sensitive = true
}
```

______________________________________________________________________

## 7. Azure SQL Database

```hcl
resource "azurerm_mssql_server" "main" {
  name                = "sql-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  version             = "12.0"

  administrator_login          = "sqladmin"
  administrator_login_password = random_password.db_admin.result

  # Azure AD admin (modern approach — disable SQL auth in prod)
  azuread_administrator {
    login_username              = "aks-managed-identity"
    object_id                   = azurerm_user_assigned_identity.app.principal_id
    azuread_authentication_only = false
  }

  minimum_tls_version            = "1.2"
  public_network_access_enabled  = false   # private endpoint only in prod

  tags = local.common_tags

  lifecycle {
    prevent_destroy = var.environment == "prod" ? true : false
  }
}

resource "azurerm_mssql_database" "main" {
  name         = "db-${var.project}-${var.environment}"
  server_id    = azurerm_mssql_server.main.id
  collation    = "SQL_Latin1_General_CP1_CI_AS"
  license_type = "LicenseIncluded"

  sku_name     = local.config.db_sku
  # dev=Basic, staging=S2, prod=BusinessCritical_Gen5_4

  geo_backup_enabled   = var.environment == "prod" ? true : false
  zone_redundant       = var.environment == "prod" ? true : false

  short_term_retention_policy {
    retention_days           = var.environment == "prod" ? 35 : 7
    backup_interval_in_hours = 12
  }

  long_term_retention_policy {
    weekly_retention  = var.environment == "prod" ? "P4W" : null
    monthly_retention = var.environment == "prod" ? "P12M" : null
    yearly_retention  = var.environment == "prod" ? "P5Y" : null
    week_of_year      = 1
  }

  tags = local.common_tags
}

# Private endpoint for SQL (prod)
resource "azurerm_private_endpoint" "sql" {
  count               = var.environment == "prod" ? 1 : 0
  name                = "pe-sql-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.subnets["snet-data"].id

  private_service_connection {
    name                           = "psc-sql-${local.prefix}"
    private_connection_resource_id = azurerm_mssql_server.main.id
    subresource_names              = ["sqlServer"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name = "sql-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.sql[0].id]
  }

  tags = local.common_tags
}
```

______________________________________________________________________

## 8. Azure Storage Account

```hcl
resource "random_string" "sa_suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "azurerm_storage_account" "main" {
  name                = "st${replace(var.project, "-", "")}${var.environment}${random_string.sa_suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location

  account_tier              = "Standard"
  account_replication_type  = local.config.replication   # LRS/GRS/GZRS

  account_kind        = "StorageV2"
  access_tier         = "Hot"
  https_traffic_only_enabled       = true
  min_tls_version     = "TLS1_2"
  allow_nested_items_to_be_public  = false
  shared_access_key_enabled        = true
  large_file_share_enabled         = false

  # Soft delete
  blob_properties {
    delete_retention_policy {
      days = 30
    }
    container_delete_retention_policy {
      days = 30
    }
    versioning_enabled  = true
    change_feed_enabled = true
  }

  # Network rules
  network_rules {
    default_action             = "Deny"
    bypass                     = ["AzureServices"]
    virtual_network_subnet_ids = [azurerm_subnet.subnets["snet-app"].id]
    ip_rules                   = var.allowed_ip_ranges
  }

  tags = local.common_tags
}

resource "azurerm_storage_container" "app_data" {
  name                  = "appdata"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}
```

______________________________________________________________________

## 9. Azure App Service (Web App)

```hcl
resource "azurerm_service_plan" "main" {
  name                = "asp-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = local.config.app_sku   # B1, P1v3, P3v3

  zone_balancing_enabled = var.environment == "prod" ? true : false
  tags                   = local.common_tags
}

resource "azurerm_linux_web_app" "main" {
  name                = "app-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  service_plan_id     = azurerm_service_plan.main.id

  https_only                    = true
  public_network_access_enabled = var.environment == "prod" ? false : true

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  site_config {
    always_on              = var.environment == "prod" ? true : false
    minimum_tls_version    = "1.2"
    ftps_state             = "Disabled"
    http2_enabled          = true
    health_check_path      = "/health"
    health_check_eviction_time_in_min = 5

    application_stack {
      node_version = "20-lts"
    }
  }

  app_settings = {
    "NODE_ENV"              = var.environment
    "APPINSIGHTS_INSTRUMENTATIONKEY" = azurerm_application_insights.main.instrumentation_key
    "DB_HOST"               = azurerm_mssql_server.main.fully_qualified_domain_name
    "DB_NAME"               = azurerm_mssql_database.main.name
    "KEY_VAULT_URI"         = azurerm_key_vault.main.vault_uri
    "AZURE_CLIENT_ID"       = azurerm_user_assigned_identity.app.client_id
    "WEBSITE_RUN_FROM_PACKAGE" = "1"
  }

  tags = local.common_tags
}

# Auto-scaling
resource "azurerm_monitor_autoscale_setting" "app" {
  name                = "autoscale-${local.prefix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  target_resource_id  = azurerm_service_plan.main.id

  profile {
    name = "default"
    capacity {
      default = 2
      minimum = 1
      maximum = 10
    }
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.main.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 70
      }
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = 1
        cooldown  = "PT5M"
      }
    }
  }
}
```

______________________________________________________________________

## 10. Log Analytics & Application Insights

```hcl
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = var.environment == "prod" ? 90 : 30
  tags                = local.common_tags
}

resource "azurerm_application_insights" "main" {
  name                = "appi-${local.prefix}"
  location            = var.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  retention_in_days   = 90
  tags                = local.common_tags
}

output "app_insights_connection_string" {
  value     = azurerm_application_insights.main.connection_string
  sensitive = true
}

output "app_insights_instrumentation_key" {
  value     = azurerm_application_insights.main.instrumentation_key
  sensitive = true
}
```

______________________________________________________________________

## 11. Complete outputs.tf for a Full Stack Deployment

```hcl
# Networking
output "vnet_id"          { value = azurerm_virtual_network.main.id }
output "vnet_name"        { value = azurerm_virtual_network.main.name }
output "subnet_ids"       { value = { for k, v in azurerm_subnet.subnets : k => v.id } }

# AKS
output "aks_cluster_name" { value = azurerm_kubernetes_cluster.main.name }
output "aks_fqdn"         { value = azurerm_kubernetes_cluster.main.fqdn }
output "aks_kube_config"  { value = azurerm_kubernetes_cluster.main.kube_config_raw; sensitive = true }

# ACR
output "acr_login_server" { value = azurerm_container_registry.main.login_server }
output "acr_name"         { value = azurerm_container_registry.main.name }

# Key Vault
output "key_vault_uri"    { value = azurerm_key_vault.main.vault_uri }
output "key_vault_name"   { value = azurerm_key_vault.main.name }

# Database
output "sql_server_fqdn"  { value = azurerm_mssql_server.main.fully_qualified_domain_name }
output "sql_db_name"      { value = azurerm_mssql_database.main.name }

# Monitoring
output "log_workspace_id" { value = azurerm_log_analytics_workspace.main.id }
output "app_insights_connection_string" {
  value     = azurerm_application_insights.main.connection_string
  sensitive = true
}
```
