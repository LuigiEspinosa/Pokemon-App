# --- dev stage ---
# Run Next.js dev server in a container for local development.
FROM node:20-alpine AS dev
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
ENV NODE_ENV=development
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "dev", "-p", "3000", "-H", "0.0.0.0"]

# --- deps layer
# Freeze dependency graph for reproducible builds.
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build layer
# Build the Next.js app (generates .next).
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# --- runtime layer
# Minimal, non-root runtime image for serving the built Next.js app.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
RUN corepack enable

# Copy the minimal runtime artifacts for Next.js
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000
USER app
CMD ["pnpm", "start"]
