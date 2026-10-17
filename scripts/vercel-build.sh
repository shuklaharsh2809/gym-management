#!/usr/bin/env sh
# Vercel build entry point (`npm run vercel-build`).
# Migrations run only for production: preview deployments may share the production database
# (Neon connects both environments by default), and an unmerged branch must never migrate it.
set -eu
if [ "${VERCEL_ENV:-}" = "production" ]; then
  npx prisma migrate deploy
else
  echo "Skipping migrations (VERCEL_ENV=${VERCEL_ENV:-unset})"
fi
npx next build
