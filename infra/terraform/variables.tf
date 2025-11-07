#############################################
# AWS REGION
#############################################
variable "region" {
  description = "AWS region to deploy into"
  type        = string
}

#############################################
# AWS ACCOUNT ID
#############################################
variable "account_id" {
  description = "Your AWS account ID (numbers only)"
  type        = string
}

#############################################
# ECR REPOSITORIES
#############################################
variable "ecr_repo_frontend" {
  description = "ECR repository name for the frontend image"
  type        = string
}

variable "ecr_repo_backend" {
  description = "ECR repository name for the backend image"
  type        = string
}

#############################################
# ROUTE53 HOSTED ZONE
#############################################
variable "route53_zone_id" {
  description = "Hosted zone ID for pokemon.cuatro.dev"
  type        = string
}

#############################################
# ECS Task Execution Role
#############################################
variable "ecs_task_execution_role" {
  description = "ARN of the ECS task execution role used to pull images & send logs"
  type        = string
}

#############################################
# JWT Secret
#############################################
variable "jwt_secret" {
  type        = string
  description = "JWT signing secret"
  sensitive   = true
}
