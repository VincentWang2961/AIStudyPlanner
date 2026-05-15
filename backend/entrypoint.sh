#!/bin/sh
# Entrypoint script for the AI Study Planner backend container
# Runs Prisma migrations and seeds the database on startup

set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Checking if database needs seeding..."
# Only seed if the courses table is empty
SEED_NEEDED=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.courses.count().then(c => {
    if (c === 0) { console.log('yes'); } else { console.log('no'); }
    process.exit(0);
  }).catch(() => { console.log('yes'); process.exit(0); });
")

if [ "$SEED_NEEDED" = "yes" ]; then
  echo "[entrypoint] Seeding database..."
  node dist/scripts/seedDb.js
else
  echo "[entrypoint] Database already contains data — skipping seed."
fi

echo "[entrypoint] Starting application..."
exec node dist/index.js
