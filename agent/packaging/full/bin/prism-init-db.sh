#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/prism-monitor/prism-web.env"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

SCHEMA_PATH="/opt/prism-monitor/sql/schema.sql"

if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "Schema file not found: $SCHEMA_PATH" >&2
  exit 1
fi

run_mysql() {
  local password="$1"
  shift
  MYSQL_PWD="$password" mysql "$@"
}

if [[ -n "${PRISM_DB_ADMIN_USER:-}" ]]; then
  ADMIN_ARGS=(--protocol=tcp -h "$DB_HOST" -P "$DB_PORT" -u "$PRISM_DB_ADMIN_USER")
  ADMIN_PASSWORD="${PRISM_DB_ADMIN_PASSWORD:-}"
elif mysql -e "SELECT 1" >/dev/null 2>&1; then
  ADMIN_ARGS=()
  ADMIN_PASSWORD=""
else
  ADMIN_ARGS=(--protocol=tcp -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER")
  ADMIN_PASSWORD="$DB_PASSWORD"
fi

run_mysql "$ADMIN_PASSWORD" "${ADMIN_ARGS[@]}" -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;"
sed "s/prism_document/$DB_NAME/g" "$SCHEMA_PATH" | run_mysql "$ADMIN_PASSWORD" "${ADMIN_ARGS[@]}"

echo "Initialized PRISM schema in database: $DB_NAME"
