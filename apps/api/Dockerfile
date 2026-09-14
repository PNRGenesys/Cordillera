# API image (Fastify + Drizzle). Built from the monorepo root so npm workspaces
# and the root lockfile resolve correctly. Set the build context to the repo root.

# ---- Build stage: install all deps (incl. dev) and compile TypeScript ----
FROM node:22-slim AS build
WORKDIR /repo

# Install workspace dependencies using the root lockfile for reproducible installs.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=@cordillera/api --include-workspace-root

# Copy the API source and build it.
COPY apps/api apps/api
RUN npm run build --workspace=@cordillera/api

# ---- Runtime stage: production deps + compiled output ----
# drizzle-kit and tsx stay available here because migrations run at startup and
# the seed is invoked manually with `docker compose run`.
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
# Install all deps including dev: drizzle-kit (a devDependency) runs the migrations
# at startup and tsx runs the seed on demand. NODE_ENV=production would otherwise
# make npm skip devDependencies, so force their inclusion explicitly.
RUN npm ci --workspace=@cordillera/api --include-workspace-root --include=dev

# Compiled JavaScript, migrations and drizzle config.
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/drizzle apps/api/drizzle
COPY apps/api/drizzle.config.ts apps/api/drizzle.config.ts
COPY apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
RUN chmod +x apps/api/docker-entrypoint.sh

WORKDIR /repo/apps/api
EXPOSE 3000

# Image-level healthcheck against the Fastify health route (uses Node, no curl needed).
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Run migrations, then start the server.
ENTRYPOINT ["./docker-entrypoint.sh"]
