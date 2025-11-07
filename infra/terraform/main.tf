############################
# Provider & Basics
############################
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

  ecr_frontend_img = "${var.account_id}.dkr.ecr.${var.region}.amazonaws.com/${var.ecr_repo_frontend}:latest"
  ecr_backend_img  = "${var.account_id}.dkr.ecr.${var.region}.amazonaws.com/${var.ecr_repo_backend}:latest"
}

############################
# VPC (terraform-aws-modules)
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
# Security Groups
############################
resource "aws_security_group" "alb" {
  name        = "pokemon-alb-sg"
  description = "ALB ingress 80/443"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "service" {
  name        = "pokemon-svc-sg"
  description = "ECS services ingress from ALB and egress to internet"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description    = "ALB - frontend"
    from_port      = 3000
    to_port        = 3000
    protocol       = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description    = "ALB - backend"
    from_port      = 4000
    to_port        = 4000
    protocol       = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}


############################
# ALB + Target Groups
############################
resource "aws_lb" "app" {
  name               = "pokemon-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
}

resource "aws_lb_target_group" "frontend" {
  name        = "tg-frontend"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path = "/"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "tg-backend"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path = "/health"
  }
}

############################
# ACM Certificate (+ DNS validation for both hosts)
############################
resource "aws_acm_certificate" "this" {
  domain_name               = local.frontend_host
  subject_alternative_names = [local.api_host]
  validation_method         = "DNS"
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = var.route53_zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "validated" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

############################
# ALB Listeners (HTTP→HTTPS, and HTTPS host routing)
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

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
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

resource "aws_lb_listener_rule" "frontend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    host_header {
      values = [local.frontend_host]
    }
  }
}

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header {
      values = [local.api_host]
    }
  }
}

############################
# ECS Cluster
############################
resource "aws_ecs_cluster" "this" {
  name = "pokemon-ecs"
}

############################
# ECS Task Definitions (Fargate)
############################
resource "aws_ecs_task_definition" "frontend" {
  family                   = "pokemon-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.ecs_task_execution_role

  container_definitions = jsonencode([
    {
      name      = "frontend",
      image     = local.ecr_frontend_img,
      essential = true,
      portMappings = [
        {
          containerPort = 3000,
          hostPort      = 3000,
          protocol      = "tcp"
        }
      ],
      environment = [
        { name = "NEXT_PUBLIC_API_BASE_URL", value = "https://${local.api_host}/api" }
      ],
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

resource "aws_ecs_task_definition" "backend" {
  family                   = "pokemon-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.ecs_task_execution_role

  container_definitions = jsonencode([
    {
      name      = "backend",
      image     = local.ecr_backend_img,
      essential = true,
      portMappings = [
        {
          containerPort = 4000,
          hostPort      = 4000,
          protocol      = "tcp"
        }
      ],
      environment = [
        { name = "PORT",            value = "4000" },
        { name = "NODE_ENV",        value = "production" },
        { name = "POKEAPI_BASE",    value = "https://pokeapi.co/api/v2" },
        { name = "CORS_ORIGIN",     value = "https://${local.frontend_host}" },
        { name = "JWT_SECRET",      value = var.jwt_secret },
        { name = "JWT_EXPIRES_IN",  value = "7d" }
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
############################
resource "aws_route53_record" "frontend_a" {
  zone_id = var.route53_zone_id
  name    = local.frontend_host
  type    = "A"
  allow_overwrite = true
  alias {
    name                   = aws_lb.app.dns_name
    zone_id                = aws_lb.app.zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "backend_a" {
  zone_id = var.route53_zone_id
  name    = local.api_host
  type    = "A"
  allow_overwrite = true
  alias {
    name                   = aws_lb.app.dns_name
    zone_id                = aws_lb.app.zone_id
    evaluate_target_health = false
  }
}

############################
# Create the log groups
############################
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/pokemon-frontend"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/pokemon-backend"
  retention_in_days = 14
}
