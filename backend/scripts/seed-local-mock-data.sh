#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -f "${repo_root}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${repo_root}/.env"
  set +a
fi

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=23310}"
: "${MYSQL_DATABASE:=studyclub}"
: "${MYSQL_USER:=studyclub}"
: "${MYSQL_PASSWORD:=studyclub_local}"

command -v mysql >/dev/null 2>&1 || {
  echo "mysql client is required. Start the local MySQL environment and install the client first." >&2
  exit 1
}

echo "Seeding local database ${MYSQL_DATABASE} at ${MYSQL_HOST}:${MYSQL_PORT}..."
mysql \
  --protocol=TCP \
  --host="${MYSQL_HOST}" \
  --port="${MYSQL_PORT}" \
  --user="${MYSQL_USER}" \
  --password="${MYSQL_PASSWORD}" \
  "${MYSQL_DATABASE}" < "${repo_root}/backend/scripts/seed-local-mock-data.sql"
echo "Local mock data seeded."
