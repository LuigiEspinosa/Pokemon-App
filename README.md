# Pokémon App

- Frontend: https://pokemon.cuatro.dev
- Backend: https://api.pokemon.cuatro.dev

## Structure

```txt
.
├─ apps/
│ ├─ frontend/            # Next.js 16 (App Router, RSC) + Tailwind
│ └─ backend/             # Express, caches + PokeAPI proxy
├─ infra/
│ ├─ terraform/           # ECS Fargate (2 services), ALB, ACM, Route53
│ └─ scripts/
│ └─ render-tfvars.sh     # Helper to generate .tfvars from env
├─ .github/
│ └─ workflows/
│ └─ ci-cd.yml            # Build, test, push to ECR, Terraform plan/apply
├─ docker-compose.yml     # Local dev
└─ README.md
```

## Local dev

Docker Required

```zsh
pnpm install-app
pnpm dev-app
```
