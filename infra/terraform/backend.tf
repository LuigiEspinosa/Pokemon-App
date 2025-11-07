terraform {
  backend "s3" {
    bucket         = "pokemon-tf-state"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "pokemon-tf-locks"
    encrypt        = true
  }
}
