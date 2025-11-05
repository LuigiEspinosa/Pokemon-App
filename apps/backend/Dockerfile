# --- dev stage ---
FROM node:20-alpine AS dev
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
ENV NODE_ENV=development
ENV PORT=4000
ENV NODE_OPTIONS=--enable-source-maps
EXPOSE 4000
CMD ["pnpm", "dev"]

# --- prod deps ---
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- prod build ---
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build  # runs "tsc -p tsconfig.json"

# --- prod runner (ESM) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/dist ./dist
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
EXPOSE 4000
CMD ["node", "dist/index.js"]
