# Web image: build the Vite app, then serve the static output with nginx.
# Built from the monorepo root so npm workspaces and the root lockfile resolve.
# Set the build context to the repo root.

# ---- Build stage ----
FROM node:22-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=@cordillera/web --include-workspace-root

COPY apps/web apps/web
RUN npm run build --workspace=@cordillera/web

# ---- Runtime stage: nginx serving the SPA and proxying /api ----
FROM nginx:1.27-alpine AS runtime
# SPA routing + /api reverse proxy to the api service on the compose network.
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

# Healthcheck hits nginx itself; it must not depend on the API being up.
# Use 127.0.0.1 (not localhost) so BusyBox wget doesn't try IPv6 [::1], which
# nginx isn't listening on.
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
    CMD wget --spider -q http://127.0.0.1:80/ || exit 1
