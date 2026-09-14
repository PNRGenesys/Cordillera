#!/bin/sh
# Apply pending database migrations, then start the API server.
# Migrations are idempotent: drizzle-kit skips those already recorded in the
# database, so restarting the container is safe. The demo seed is intentionally
# NOT run here; invoke it manually with `docker compose run --rm api npm run db:seed`.
set -e

echo "Running database migrations..."
npm run db:migrate --workspace=@cordillera/api

echo "Starting API server..."
exec node dist/server.js
