#!/usr/bin/env bash
# Backup do banco agro_fazenda_mock via pg_dump no container postgres
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

BACKUP_DIR="$PROJECT_ROOT/backups"
CONTAINER_NAME="${POSTGRES_CONTAINER:-postgres}"
PGUSER="${POSTGRES_USER:-}"
FORMAT="both"

usage() {
    cat <<'EOF'
Uso: backup_agro_fazenda_mock.sh [opções]

Gera backup do banco agro_fazenda_mock no container postgres.

Opções:
  --format dump|sql|both   Formato do backup (default: both)
  --help                   Exibe esta ajuda

Saída:
  backups/agro_fazenda_mock_YYYYMMDD_HHMMSS.dump  (formato custom)
  backups/agro_fazenda_mock_YYYYMMDD_HHMMSS.sql   (formato plain)
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --format) FORMAT="$2"; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Opção desconhecida: $1" >&2; usage; exit 1 ;;
    esac
done

case "$FORMAT" in
    dump|sql|both) ;;
    *) echo "Formato inválido: $FORMAT (use dump, sql ou both)" >&2; exit 1 ;;
esac

assert_postgres_container "$CONTAINER_NAME"
load_agro_secrets

if [[ -z "$PGUSER" ]]; then
    PGUSER=$(get_postgres_admin_user "$CONTAINER_NAME")
fi

mkdir -p "$BACKUP_DIR"
STAMP=$(date '+%Y%m%d_%H%M%S')
BASE_NAME="agro_fazenda_mock_${STAMP}"
DUMP_FILE="$BACKUP_DIR/${BASE_NAME}.dump"
SQL_FILE="$BACKUP_DIR/${BASE_NAME}.sql"

echo "Gerando backup de $AGRO_DB no container $CONTAINER_NAME (admin: $PGUSER)..."

if [[ "$FORMAT" == "dump" || "$FORMAT" == "both" ]]; then
    docker exec "$CONTAINER_NAME" \
        pg_dump -U "$PGUSER" -d "$AGRO_DB" -Fc --no-owner --no-acl \
        > "$DUMP_FILE"
    echo "Backup custom: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
fi

if [[ "$FORMAT" == "sql" || "$FORMAT" == "both" ]]; then
    docker exec "$CONTAINER_NAME" \
        pg_dump -U "$PGUSER" -d "$AGRO_DB" --no-owner --no-acl \
        > "$SQL_FILE"
    echo "Backup SQL:    $SQL_FILE ($(du -h "$SQL_FILE" | cut -f1))"
fi

echo "Backup concluído."
