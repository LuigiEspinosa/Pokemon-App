############################
# Provider & Basics
# Keep TF and providers at known-good versions for reproducible plans/applies.
############################
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # Tracks latest v5.x without jumping major versions.
    }
  }
}

provider "aws" {
  region = var.region
}

############################
# Locals
############################
locals {
  zone_root     = "pokemon.cuatro.dev"
  api_host      = "api.pokemon.cuatro.dev"
  frontend_host = "pokemon.cuatro.dev"

  # Canonical ECR image URIs for ECS tasks. We pin ":latest" for simplicity
  # (CI should update tags); consider immutable SHAs/tags for prod.
  ecr_frontend_img = "${var.account_id}.dkr.ecr.${var.region}.amazonaws.com/${var.ecr_repo_frontend}:latest"
  ecr_backend_img  = "${var.account_id}.dkr.ecr.${var.region}.amazonaws.com/${var.ecr_repo_backend}:latest"
}

############################
# VPC (terraform-aws-modules)
# Isolate workloads into a minimal VPC with public (ALB/NAT) and private
# (ECS tasks) subnets. NAT enables tasks to reach the internet (e.g., npm).
############################
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"

  name = "pokemon-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.region}a", "${var.region}b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
}

############################
# IAM (task roles & execution roles)
# Task Role = app runtime permissions (e.g., SSM); Execution Role = ECS
# pulls + logs (ECR/CloudWatch). Keep least privilege & separation of duties.
############################
resource "aws_iam_role" "pokemon_backend_task_role" {
  name = "pokemon-backend-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Service = "ecs-tasks.amazonaws.com" }
        Action   = "sts:AssumeRole"
      }
    ]
  })
}

# Caller context (used to build ARNs in policies).
data "aws_caller_identity" "current" {}

# Default KMS key used by SSM Parameter Store for SecureString.
data "aws_kms_key" "ssm" {
  key_id = "alias/aws/ssm"
}

# Execution role: pull images, write logs, fetch basic secrets if needed.
resource "aws_iam_role" "ecs_task_execution" {
  name = "pokemon-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" # ECR+CW Logs.
}

# Let the *execution* role read a specific SSM parameter (JWT_SECRET) if
# you ever move secret resolution to init/sidecars. Backend task uses its own role.
resource "aws_iam_policy" "ecs_task_execution_ssm" {
  name = "pokemon-ecs-exec-ssm"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["ssm:GetParameter", "ssm:GetParameters"],
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/pokemon/JWT_SECRET"
      },
      {
        Effect   = "Allow",
        Action   = ["kms:Decrypt"],
        Resource = data.aws_kms_key.ssm.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_ssm_attach" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.ecs_task_execution_ssm.arn
}

# Backend app's runtime permissions: read JWT secret from SSM and decrypt via KMS.
resource "aws_iam_policy" "pokemon_backend_ssm_policy" {
  name = "pokemon-backend-ssm-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters", "kms:Decrypt"]
        # TODO: This ARN is hardcoded to us-east-1. Consider using ${var.region} for consistency.
        Resource = "arn:aws:ssm:us-east-1:${data.aws_caller_identity.current.account_id}:parameter/pokemon/JWT_SECRET"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "pokemon_backend_ssm_attach" {
  role       = aws_iam_role.pokemon_backend_task_role.name
  policy_arn = aws_iam_policy.pokemon_backend_ssm_policy.arn
}

############################
# Security Groups
# ALB SG: public 80/443 ingress; egress open (ALB health checks, redirects).
############################
resource "aws_security_group" "alb" {
  name        = "pokemon-alb-sg"
  description = "ALB ingress 80/443"
  vpc_id      = module.vpc.vpc_id

  ingress { 
    from_port = 80  
    to_port = 80  
    protocol = "tcp" 
    cidr_blocks = ["0.0.0.0/0"] 
  }

  ingress { 
    from_port = 443 
    to_port = 443 
    protocol = "tcp" 
    cidr_blocks = ["0.0.0.0/0"] 
  }

  egress  { 
    from_port = 0   
    to_port = 0   
    protocol = "-1"  
    cidr_blocks = ["0.0.0.0/0"] 
  }
}

# Service SG: only ALB can reach tasks (ports 3000/4000). Tasks can egress freely.
resource "aws_security_group" "service" {
  name        = "pokemon-svc-sg"
  description = "ECS services ingress from ALB and egress to internet"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "ALB - frontend"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id] # Principle of least access: ALB only.
  }

  ingress {
    description     = "ALB - backend"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress { 
    from_port = 0 
    to_port = 0 
    protocol = "-1" 
    cidr_blocks = ["0.0.0.0/0"] 
  }
}

############################
# ALB + Target Groups
# One ALB terminates TLS and routes by host header to frontend/backend.
############################
resource "aws_lb" "app" {
  name               = "pokemon-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets # ALB must be public.
}

# TG for Next.js frontend (port 3000). Health check "/" aligns with web root.
resource "aws_lb_target_group" "frontend" {
  name        = "tg-frontend"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip" # Fargate tasks register IPs.

  health_check { path = "/" }
}

# TG for Node backend (port 4000). Health check "/health" expected in app.
resource "aws_lb_target_group" "backend" {
  name        = "tg-backend"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check { path = "/health" }
}

############################
# ACM Certificate (+ DNS validation for both hosts)
# Single cert with SAN for both hosts; validated via Route53 DNS records.
############################
resource "aws_acm_certificate" "this" {
  domain_name               = local.frontend_host
  subject_alternative_names = [local.api_host]
  validation_method         = "DNS"
}

# Create DNS validation records in the hosted zone so ACM can issue the cert.
resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

# Blocks until ACM verifies DNS and issues the cert.
resource "aws_acm_certificate_validation" "validated" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

############################
# ALB Listeners (HTTP→HTTPS, and HTTPS host routing)
# Force HTTPS: redirect cleartext traffic on :80 to :443.
############################
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# TLS termination on :443 using ACM cert; default 404 for unknown hosts.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08" # Consider a newer policy for stronger ciphers.
  certificate_arn   = aws_acm_certificate_validation.validated.certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

# Route apex (frontend host) to frontend TG.
resource "aws_lb_listener_rule" "frontend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    host_header { values = [local.frontend_host] }
  }
}

# Route api subdomain to backend TG.
resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header { values = [local.api_host] }
  }
}

############################
# ECS Cluster
# Logical grouping for Fargate services. Capacity is serverless (no EC2).
############################
resource "aws_ecs_cluster" "this" {
  name = "pokemon-ecs"
}

############################
# ECS Task Definitions (Fargate)
# Frontend: Next.js app on port 3000
# - NEXT_PUBLIC_API_BASE_URL points to the backend /api route
# - NEXT_DISABLE_IMAGE_OPTIMIZATION avoids Next/Image remote loader config when behind ALB
############################
resource "aws_ecs_task_definition" "frontend" {
  family                   = "pokemon-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "frontend",
      image     = local.ecr_frontend_img,
      essential = true,
      portMappings = [
        { containerPort = 3000, hostPort = 3000, protocol = "tcp" }
      ],
      environment = concat([
        { name = "NEXT_PUBLIC_API_BASE_URL",        value = "https://${local.api_host}/api" },
        { name = "NEXT_DISABLE_IMAGE_OPTIMIZATION", value = "true" }
      ], []),
      logConfiguration = {
        logDriver = "awslogs",
        options = {
          awslogs-group         = "/ecs/pokemon-frontend",
          awslogs-region        = var.region,
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

# Backend: Node API on port 4000
# - Inject JWT_SECRET securely from SSM Parameter Store (KMS-encrypted).
# - Keep PORT explicit to avoid surprises if app defaults change.
resource "aws_ecs_task_definition" "backend" {
  family                   = "pokemon-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512

  execution_role_arn = aws_iam_role.ecs_task_execution.arn
  task_role_arn      = aws_iam_role.pokemon_backend_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "backend",                         # Must match service.load_balancer.container_name
      image = local.ecr_backend_img,             # CI/CD should push latest/tagged images

      essential = true,

      portMappings = [
        { containerPort = 4000, hostPort = 4000, protocol = "tcp" }
      ],

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT",     value = "4000" }
      ],

      # Secrets resolved at runtime by ECS agent; avoids putting secrets in TF state.
      secrets = [
        {
          name      = "JWT_SECRET",
          valueFrom = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/pokemon/JWT_SECRET"
        }
      ],

      logConfiguration = {
        logDriver = "awslogs",
        options = {
          awslogs-group         = "/ecs/pokemon-backend",
          awslogs-region        = var.region,
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])
}

############################
# ECS Services (attach to ALB target groups)
# Desired count of 2 for basic HA across AZs; runs in private subnets with
# no public IPs; ALB handles ingress. Depends on log groups & listener rules.
############################
resource "aws_ecs_service" "frontend" {
  name            = "pokemon-frontend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }

  depends_on = [
    aws_cloudwatch_log_group.frontend,
    aws_lb_listener_rule.frontend
  ]
}

resource "aws_ecs_service" "backend" {
  name            = "pokemon-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.vpc.private_subnets
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 4000
  }

  depends_on = [
    aws_cloudwatch_log_group.backend,
    aws_lb_listener_rule.backend
  ]
}

############################
# Route53 A records (Alias to ALB)
# Both hosts are ALIAS A-records to the ALB for low-latency & health-aware DNS.
############################
resource "aws_route53_record" "frontend_a" {
  zone_id         = var.route53_zone_id
  name            = local.frontend_host
  type            = "A"
  allow_overwrite = true
  alias {
    name                   = aws_lb.app.dns_name
    zone_id                = aws_lb.app.zone_id
    evaluate_target_health = false      # ALB health is already managed; can be true if desired.
  }
}

resource "aws_route53_record" "backend_a" {
  zone_id         = var.route53_zone_id
  name            = local.api_host
  type            = "A"
  allow_overwrite = true
  alias {
    name                   = aws_lb.app.dns_name
    zone_id                = aws_lb.app.zone_id
    evaluate_target_health = false
  }
}

############################
# CloudWatch Log Groups
# Pre-create log groups to control retention and avoid first-write races.
############################
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/pokemon-frontend"
  retention_in_days = 14 # Trim log storage costs; adjust as needed.
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/pokemon-backend"
  retention_in_days = 14
}
