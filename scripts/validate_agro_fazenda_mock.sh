#!/usr/bin/env bash
# Valida integridade do banco agro_fazenda_mock
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
DB_DIR="$PROJECT_ROOT/database/agro_fazenda_mock"
VALIDATION_SQL="$DB_DIR/05_validation_queries.sql"

CONTAINER_NAME="${POSTGRES_CONTAINER:-postgres}"
DB_NAME="${AGRO_MOCK_DB:-agro_fazenda_mock}"
PGUSER="${POSTGRES_USER:-}"

usage() {
    cat <<'EOF'
Uso: validate_agro_fazenda_mock.sh [opções]

Valida integridade do banco agro_fazenda_mock no container postgres.

Opções:
  --container NAME   Nome do container Docker (default: postgres)
  --help             Exibe esta ajuda

Variáveis de ambiente:
  POSTGRES_CONTAINER, AGRO_MOCK_DB, POSTGRES_USER
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --container) CONTAINER_NAME="$2"; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Opção desconhecida: $1" >&2; usage; exit 1 ;;
    esac
done

if [[ "$CONTAINER_NAME" == "gesto-app-postgres-1" ]]; then
    echo "ERRO: Uso do container gesto-app-postgres-1 é proibido." >&2
    exit 1
fi

command -v docker >/dev/null 2>&1 || { echo "Docker não encontrado." >&2; exit 1; }
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME" || {
    echo "Container '$CONTAINER_NAME' não está rodando." >&2; exit 1;
}

[[ -f "$VALIDATION_SQL" ]] || { echo "Arquivo não encontrado: $VALIDATION_SQL" >&2; exit 1; }

if [[ -z "$PGUSER" ]]; then
    PGUSER=$(docker exec "$CONTAINER_NAME" printenv POSTGRES_USER 2>/dev/null || true)
    [[ -n "$PGUSER" ]] || { echo "Não foi possível obter POSTGRES_USER do container." >&2; exit 1; }
fi

CURRENT_DB=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc "SELECT current_database();" 2>/dev/null || true)
if [[ "$CURRENT_DB" != "$DB_NAME" ]]; then
    echo "ERRO: Banco ativo '$CURRENT_DB' difere de '$DB_NAME'." >&2
    exit 1
fi

echo "=== Validando $DB_NAME no container $CONTAINER_NAME ==="

TMP_OUT=$(mktemp)
trap 'rm -f "$TMP_OUT"' EXIT

docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    < "$VALIDATION_SQL" | tee "$TMP_OUT"

FAILURES=0

if grep -q 'FALHA' "$TMP_OUT"; then
    echo ""
    echo "AVISO: Foram encontrados registros com status FALHA." >&2
    FAILURES=$((FAILURES + 1))
fi

# Verificar lançamentos desbalanceados (seção deve retornar 0 linhas)
UNBALANCED=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc "
SELECT COUNT(*) FROM (
    SELECT lc.id
    FROM agro.lancamentos_contabeis lc
    JOIN agro.partidas_lancamento pl ON pl.lancamento_id = lc.id
    GROUP BY lc.id
    HAVING SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) <>
           SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END)
) x;
")
UNBALANCED=$(echo "$UNBALANCED" | tr -d '[:space:]')

if [[ "$UNBALANCED" != "0" ]]; then
    echo "ERRO: $UNBALANCED lançamento(s) contábil(is) desbalanceado(s)." >&2
    FAILURES=$((FAILURES + 1))
else
    echo "Partidas contábeis: OK (todos balanceados)"
fi

if [[ $FAILURES -gt 0 ]]; then
    echo "Validação concluída com FALHAS ($FAILURES problema(s))." >&2
    exit 1
fi

echo "Validação concluída com sucesso."
