#!/usr/bin/env bash
# Abre psql interativo no banco agro_fazenda_mock
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

CONTAINER_NAME="${POSTGRES_CONTAINER:-postgres}"

usage() {
    cat <<'EOF'
Uso: connect_agro_fazenda_mock.sh

Abre sessão psql interativa no banco agro_fazenda_mock usando credenciais de
~/.secrets/agro_fazenda_mock.env

Variáveis de ambiente opcionais:
  POSTGRES_CONTAINER (default: postgres)
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h) usage; exit 0 ;;
        *) echo "Opção desconhecida: $1" >&2; usage; exit 1 ;;
    esac
done

assert_postgres_container "$CONTAINER_NAME"
load_agro_secrets

echo "Conectando a $AGRO_DB como $AGRO_USER no container $CONTAINER_NAME..."
echo "Schema padrão: $AGRO_SCHEMA (use: SET search_path TO agro, public;)"
echo ""

exec docker exec -it -e PGPASSWORD="$AGRO_PASS" "$CONTAINER_NAME" \
    psql -U "$AGRO_USER" -d "$AGRO_DB" -v ON_ERROR_STOP=1
