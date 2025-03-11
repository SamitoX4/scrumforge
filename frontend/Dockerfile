# ── Build context: repo root ───────────────────────────────────────────────────
# Build:   docker build -f frontend/Dockerfile -t scrumforge-frontend .
# Compose: context: . / dockerfile: frontend/Dockerfile

# ── Stage 1: Install dependencies ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
# frontend-sdk is resolved by the Vite alias at build time (not via npm install)
COPY packages/frontend-sdk ./packages/frontend-sdk
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY frontend ./frontend

# Build args for environment variables baked at build time
ARG VITE_GRAPHQL_URL=http://localhost:4000/graphql
ARG VITE_WS_URL=ws://localhost:4000/graphql
ARG VITE_BACKEND_URL=http://localhost:4000

ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN cd frontend && npm run build

# ── Stage 3: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy built assets (packages/frontend-sdk already bundled inside dist/)
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
