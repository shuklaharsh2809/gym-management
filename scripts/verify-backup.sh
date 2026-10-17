#!/usr/bin/env bash
# Backup and recovery drill: dump the database, restore it into a scratch database and compare
# row counts for every table. Exits non-zero if anything differs.
# Usage: scripts/verify-backup.sh [container] [db]   (defaults: fitgrid-postgres fitgrid)
set -euo pipefail
CONTAINER="${1:-fitgrid-postgres}"
SOURCE_DB="${2:-fitgrid}"
RESTORE_DB="${SOURCE_DB}_restore_check"
DUMP="/tmp/${SOURCE_DB}-$(date +%Y%m%d%H%M%S).dump"
psql() { docker exec -i "$CONTAINER" psql -U fitgrid -v ON_ERROR_STOP=1 "$@"; }

echo "1/4 Dumping ${SOURCE_DB} (custom format)…"
docker exec "$CONTAINER" pg_dump -U fitgrid -Fc -f "$DUMP" "$SOURCE_DB"

echo "2/4 Restoring into ${RESTORE_DB}…"
psql -d postgres -qc "DROP DATABASE IF EXISTS ${RESTORE_DB}" -c "CREATE DATABASE ${RESTORE_DB}"
docker exec "$CONTAINER" pg_restore -U fitgrid --no-owner -d "$RESTORE_DB" "$DUMP"

COUNT_SQL="SELECT string_agg(t || '=' || n, E'\n' ORDER BY t) FROM (
  SELECT table_name AS t, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text::bigint AS n
  FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') x"

echo "3/4 Comparing row counts…"
SOURCE_COUNTS=$(psql -d "$SOURCE_DB" -tAc "$COUNT_SQL")
RESTORE_COUNTS=$(psql -d "$RESTORE_DB" -tAc "$COUNT_SQL")
if [[ "$SOURCE_COUNTS" != "$RESTORE_COUNTS" ]]; then
  diff <(echo "$SOURCE_COUNTS") <(echo "$RESTORE_COUNTS") || true
  echo "FAILED: restored data differs from the source." >&2
  exit 1
fi
echo "$SOURCE_COUNTS" | awk -F= '{ rows += $2 } END { print "   " NR " tables, " rows " rows match." }'

echo "4/4 Cleaning up…"
psql -d postgres -qc "DROP DATABASE ${RESTORE_DB}"
docker exec "$CONTAINER" rm -f "$DUMP"
echo "Backup verified: restore is complete and consistent."
