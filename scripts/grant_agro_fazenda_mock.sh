#!/usr/bin/env bash
# Aplica permissões do agro_mock_user no schema agro (idempotente)
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

CONTAINER_NAME="${POSTGRES_CONTAINER:-postgres}"
DB_NAME="${AGRO_DB:-agro_fazenda_mock}"
APP_USER="${AGRO_USER:-agro_mock_user}"
PGUSER="${POSTGRES_USER:-}"

assert_postgres_container "$CONTAINER_NAME"
if [[ -z "${AGRO_PASS:-}" ]]; then
    load_agro_secrets || true
fi
APP_USER="${AGRO_USER:-$APP_USER}"
DB_NAME="${AGRO_DB:-$DB_NAME}"
AGRO_PASS="${AGRO_PASS:-}"

if [[ -z "$PGUSER" ]]; then
    PGUSER=$(get_postgres_admin_user "$CONTAINER_NAME")
fi

echo "Aplicando permissões para $APP_USER em $DB_NAME (schema agro)..."

docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<EOSQL
GRANT CONNECT ON DATABASE $DB_NAME TO $APP_USER;
GRANT USAGE ON SCHEMA agro TO $APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA agro TO $APP_USER;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA agro TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA agro
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA agro
  GRANT USAGE, SELECT ON SEQUENCES TO $APP_USER;
ALTER ROLE $APP_USER SET search_path TO agro, public;
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agro_mock_readonly') THEN
    GRANT USAGE ON SCHEMA agro TO agro_mock_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA agro TO agro_mock_readonly;
    GRANT agro_mock_readonly TO $APP_USER;
  END IF;
END \$\$;
EOSQL

echo "Testando acesso como $APP_USER..."
docker exec -i -e PGPASSWORD="$AGRO_PASS" "$CONTAINER_NAME" \
    psql -U "$APP_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c \
    "SELECT COUNT(*) AS fazendas FROM agro.fazendas;"

echo "Permissões aplicadas com sucesso."
