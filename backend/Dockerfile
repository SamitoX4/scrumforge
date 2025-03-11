# ── Build context: repo root ───────────────────────────────────────────────────
# Build:   docker build -f backend/Dockerfile -t scrumforge-backend .
# Compose: context: . / dockerfile: backend/Dockerfile

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
# backend-sdk must be present before npm ci (file: reference in package.json)
COPY packages/backend-sdk ./packages/backend-sdk
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY packages/backend-sdk ./packages/backend-sdk
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
# Generate Prisma Client (native binaries for alpine)
RUN cd backend && npx prisma generate --schema=src/config/db/schema.prisma
# Compile TypeScript → dist/
RUN cd backend && npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# backend-sdk: npm ci creates the symlink; dist/index.js resolves imports at runtime
COPY packages/backend-sdk ./packages/backend-sdk

# Install only production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

WORKDIR /app/backend

# Copy compiled output
COPY --from=builder /app/backend/dist ./dist

# Copy Prisma schema and generated client (native binaries needed at runtime)
COPY --from=builder /app/backend/src/config/db/schema.prisma ./src/config/db/schema.prisma
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/node_modules/@prisma ./node_modules/@prisma

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 scrumforge
USER scrumforge

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
