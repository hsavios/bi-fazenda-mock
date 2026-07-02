#!/usr/bin/env bash
# Valida integridade do banco agro_fazenda_mock
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

DB_DIR="$PROJECT_ROOT/database/agro_fazenda_mock"
VALIDATION_SQL="$DB_DIR/05_validation_queries.sql"
LOG_DIR="$PROJECT_ROOT/logs"

CONTAINER_NAME="${POSTGRES_CONTAINER:-postgres}"
DB_NAME="${AGRO_DB:-agro_fazenda_mock}"
PGUSER="${POSTGRES_USER:-}"
EXPECTED_TABLES="${EXPECTED_TABLES:-}"
EXPECTED_VIEWS="${EXPECTED_VIEWS:-}"

usage() {
    cat <<'EOF'
Uso: validate_agro_fazenda_mock.sh [opções]

Valida integridade do banco agro_fazenda_mock no container postgres.

Opções:
  --container NAME   Nome do container Docker (default: postgres)
  --help             Exibe esta ajuda

Variáveis de ambiente:
  POSTGRES_CONTAINER, AGRO_DB, POSTGRES_USER
  EXPECTED_TABLES, EXPECTED_VIEWS (opcional — força contagem esperada)
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --container) CONTAINER_NAME="$2"; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Opção desconhecida: $1" >&2; usage; exit 1 ;;
    esac
done

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/validacao_agro_fazenda_mock_$(date '+%Y%m%d_%H%M%S').log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

assert_postgres_container "$CONTAINER_NAME"

[[ -f "$VALIDATION_SQL" ]] || { echo "Arquivo não encontrado: $VALIDATION_SQL" >&2; exit 1; }

if [[ -z "$PGUSER" ]]; then
    PGUSER=$(get_postgres_admin_user "$CONTAINER_NAME")
fi

load_agro_secrets || true
DB_NAME="${AGRO_DB:-$DB_NAME}"

CURRENT_DB=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc "SELECT current_database();" 2>/dev/null || true)
if [[ "$CURRENT_DB" != "$DB_NAME" ]]; then
    log "ERRO: Banco ativo '$CURRENT_DB' difere de '$DB_NAME'."
    exit 1
fi

log "=== Validando $DB_NAME no container $CONTAINER_NAME ==="
log "Log: $LOG_FILE"

TMP_OUT=$(mktemp)
trap 'rm -f "$TMP_OUT"' EXIT

docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -P pager=off -v ON_ERROR_STOP=1 \
    < "$VALIDATION_SQL" | tee "$TMP_OUT" | tee -a "$LOG_FILE"

FAILURES=0

if grep -q 'FALHA' "$TMP_OUT"; then
    log "AVISO: Foram encontrados registros com status FALHA."
    FAILURES=$((FAILURES + 1))
fi

# Contagens de schema
TOTAL_TABLES=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'agro' AND table_type = 'BASE TABLE';")
TOTAL_VIEWS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'agro';")
TOTAL_TABLES=$(echo "$TOTAL_TABLES" | tr -d '[:space:]')
TOTAL_VIEWS=$(echo "$TOTAL_VIEWS" | tr -d '[:space:]')

log "Tabelas no schema agro: $TOTAL_TABLES"
log "Views no schema agro:   $TOTAL_VIEWS"

if [[ -n "$EXPECTED_TABLES" ]] && [[ "$TOTAL_TABLES" != "$EXPECTED_TABLES" ]]; then
    log "ERRO: Esperado $EXPECTED_TABLES tabelas, encontrado $TOTAL_TABLES."
    FAILURES=$((FAILURES + 1))
fi

if [[ -n "$EXPECTED_VIEWS" ]] && [[ "$TOTAL_VIEWS" != "$EXPECTED_VIEWS" ]]; then
    log "ERRO: Esperado $EXPECTED_VIEWS views, encontrado $TOTAL_VIEWS."
    FAILURES=$((FAILURES + 1))
fi

# Partidas contábeis — detecta modelo de tabelas
UNBALANCED=""
ACCOUNTING_MODEL=""

if docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='agro' AND table_name='lancamento_contabil';" \
    | grep -q 1; then
    ACCOUNTING_MODEL="lancamento_contabil"
    UNBALANCED=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc "
SELECT COUNT(*) FROM (
  SELECT lc.id
  FROM agro.lancamento_contabil lc
  JOIN agro.lancamento_contabil_item lci ON lci.lancamento_contabil_id = lc.id
  GROUP BY lc.id
  HAVING round(sum(coalesce(lci.debito, 0)), 2) <> round(sum(coalesce(lci.credito, 0)), 2)
) x;
")
elif docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='agro' AND table_name='lancamentos_contabeis';" \
    | grep -q 1; then
    ACCOUNTING_MODEL="lancamentos_contabeis"
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
else
    log "AVISO: Tabelas contábeis não encontradas no schema agro."
    FAILURES=$((FAILURES + 1))
fi

UNBALANCED=$(echo "${UNBALANCED:-}" | tr -d '[:space:]')

if [[ -n "$ACCOUNTING_MODEL" ]]; then
    if [[ "$UNBALANCED" != "0" ]]; then
        log "ERRO: $UNBALANCED lançamento(s) contábil(is) desbalanceado(s) [$ACCOUNTING_MODEL]."
        FAILURES=$((FAILURES + 1))
    else
        log "Partidas contábeis ($ACCOUNTING_MODEL): OK — 0 desbalanceados"
    fi
fi

# Resumo final
docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -P pager=off -c "
SELECT
  current_database() AS banco,
  current_user AS usuario,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'agro' AND table_type = 'BASE TABLE') AS tabelas,
  (SELECT COUNT(*) FROM information_schema.views
   WHERE table_schema = 'agro') AS views;
" | tee -a "$LOG_FILE"

if [[ $FAILURES -gt 0 ]]; then
    log "Validação concluída com FALHAS ($FAILURES problema(s))."
    exit 1
fi

# Validar acesso como agro_mock_user (não apenas admin)
if load_agro_secrets 2>/dev/null; then
    APP_COUNT=$(docker exec -e PGPASSWORD="$AGRO_PASS" "$CONTAINER_NAME" \
        psql -U "$AGRO_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM agro.fazendas;" 2>/dev/null || echo "ERRO")
    APP_COUNT=$(echo "$APP_COUNT" | tr -d '[:space:]')
    if [[ "$APP_COUNT" == "ERRO" ]] || [[ -z "$APP_COUNT" ]]; then
        log "ERRO: agro_mock_user não consegue ler agro.fazendas. Rode: ./scripts/grant_agro_fazenda_mock.sh"
        exit 1
    fi
    log "Acesso app ($AGRO_USER): agro.fazendas = $APP_COUNT registro(s)"
fi

log "Validação concluída com sucesso."
