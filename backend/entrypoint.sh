#!/bin/sh
# Entrypoint script for the AI Study Planner backend container
# Runs Prisma migrations and seeds the database on startup

set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Checking if database needs seeding..."
# Check if the courses table has data
HAS_DATA=$(PGPASSWORD=postgres psql -h postgres -U postgres -d studyplanner -t -c "SELECT COUNT(*) FROM courses;" 2>/dev/null || echo "0")
HAS_DATA=$(echo "$HAS_DATA" | tr -d '[:space:]')

if [ -z "$HAS_DATA" ] || [ "$HAS_DATA" = "0" ]; then
  echo "[entrypoint] Database is empty — seeding with course data..."
  node dist/scripts/seedDb.js || echo "[entrypoint] Seed failed — continuing anyway"
else
  echo "[entrypoint] Database already contains $HAS_DATA course(s) — skipping seed."
fi

echo "[entrypoint] Starting application..."
exec node dist/index.js
