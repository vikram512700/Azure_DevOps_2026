# Terraform for DevOps Engineers — Complete Reference (Azure)

A structured guide covering Terraform from fundamentals to advanced production patterns with real-world **Azure** scenarios.

______________________________________________________________________

## Index

| File | Topics Covered |
|------|---------------|
| [01_Terraform_Basics.md](01_Terraform_Basics.md) | Installation, CLI workflow, init/plan/apply/destroy, Azure provider setup |
| [02_Terraform_HCL_Language.md](02_Terraform_HCL_Language.md) | Variables, outputs, locals, data sources, expressions, built-in functions |
| [03_Terraform_Resources_Providers.md](03_Terraform_Resources_Providers.md) | Resource blocks, count, for_each, depends_on, lifecycle, meta-arguments |
| [04_Terraform_State_Management.md](04_Terraform_State_Management.md) | State files, Azure Blob remote backend, state locking, state commands |
| [05_Terraform_Modules.md](05_Terraform_Modules.md) | Module structure, root/child modules, registry, versioning, Terragrunt |
| [06_Terraform_Azure.md](06_Terraform_Azure.md) | VNet, VM, AKS, Azure SQL, Storage, Key Vault, ACR, App Service — production examples |
| [07_Terraform_Workspaces_Environments.md](07_Terraform_Workspaces_Environments.md) | Workspaces, env patterns, dev/staging/prod strategies |
| [08_Terraform_CI_CD.md](08_Terraform_CI_CD.md) | GitHub Actions, Azure DevOps Pipelines, Atlantis, automation |
| [09_Terraform_Best_Practices.md](09_Terraform_Best_Practices.md) | Structure, naming, security, testing (Terratest), drift detection |
| [10_Terraform_Troubleshooting.md](10_Terraform_Troubleshooting.md) | Common errors, state recovery, import, taint, debug logging |

______________________________________________________________________

## Quick Reference Card

```bash
# Core workflow
terraform init             # download providers & modules
terraform validate         # check HCL syntax
terraform fmt -recursive   # format code
terraform plan             # preview changes
terraform plan -out=tfplan # save plan to file
terraform apply tfplan     # apply saved plan
terraform destroy          # tear down all resources

# State operations
terraform show             # read current state
terraform state list       # list all resources in state
terraform output           # print all outputs
terraform output vnet_id   # specific output

# Workspace
terraform workspace new    staging
terraform workspace select staging
terraform workspace list
```

______________________________________________________________________

> Each file contains real-time Azure DevOps scenarios, complete HCL code, and production-tested patterns.
