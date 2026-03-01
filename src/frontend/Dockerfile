# =============================================================================
# Prose Arc Frontend — Multi-stage Dockerfile
# Stage 1 (development): Vite dev server with HMR (source is volume-mounted)
# Stage 2 (production):  Static build served by nginx
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: development
# ---------------------------------------------------------------------------
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci

# Source is volume-mounted at runtime
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]


# ---------------------------------------------------------------------------
# Stage 2: production — static build + nginx
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing: serve index.html for all unknown paths
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
