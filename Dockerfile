# ─────────────────────────────────────────────────────────────
#  Stage 1 – deps
#  Install ALL dependencies (including devDeps needed to compile)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests first – Docker cache layer reused unless they change
COPY package.json package-lock.json ./

RUN npm ci --frozen-lockfile


# ─────────────────────────────────────────────────────────────
#  Stage 2 – builder
#  Compile TypeScript → JavaScript
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

RUN npm run build


# ─────────────────────────────────────────────────────────────
#  Stage 3 – development
#  Hot-reload with ts-node-dev (used by docker-compose dev target)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# Install ALL deps (devDeps needed for ts-node-dev)
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --frozen-lockfile

COPY src ./src

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

CMD ["npm", "run", "dev"]


# ─────────────────────────────────────────────────────────────
#  Stage 4 – production
#  Lean image: only compiled JS + production deps
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile --omit=dev

# Copy compiled output and SQL schema
COPY --from=builder /app/dist ./dist
COPY src/config/schema.sql ./dist/config/schema.sql

# Non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

# Healthcheck so Docker knows when the API is ready
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "dist/index.js"]
