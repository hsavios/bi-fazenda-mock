#!/usr/bin/env bash
# Deploy do banco mock agro_fazenda_mock na VPS (container postgres genérico)
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

DB_DIR="$PROJECT_ROOT/database/agro_fazenda_mock"
FULL_SQL="$DB_DIR/agro_fazenda_mock_full.sql"
BUILD_SCRIPT="$SCRIPT_DIR/build_agro_fazenda_mock_full.sh"
VALIDATE_SCRIPT="$SCRIPT_DIR/validate_agro_fazenda_mock.sh"
LOG_DIR="$PROJECT_ROOT/logs"
SECRETS_FILE="${HOME}/.secrets/agro_fazenda_mock.env"

CONTAINER_NAME="postgres"
DB_NAME="agro_fazenda_mock"
APP_USER="agro_mock_user"
CONFIRM_DROP=false
RESET_PASSWORD=false
SKIP_VALIDATION=false
PGUSER=""

usage() {
    cat <<'EOF'
Uso: deploy_agro_fazenda_mock_vps.sh [opções]

Provisiona o banco mock agrícola agro_fazenda_mock no container Docker postgres.

ATENÇÃO: o SQL consolidado executa DROP SCHEMA IF EXISTS agro CASCADE,
apagando todo o schema agro e recriando do zero.

Opções:
  --yes              Confirma execução destrutiva (DROP SCHEMA agro CASCADE)
  --reset-password   Gera nova senha para agro_mock_user
  --skip-validation  Não executa validações ao final
  --help             Exibe esta ajuda

Exemplo:
  ./scripts/deploy_agro_fazenda_mock_vps.sh --yes
EOF
}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes) CONFIRM_DROP=true; shift ;;
        --reset-password) RESET_PASSWORD=true; shift ;;
        --skip-validation) SKIP_VALIDATION=true; shift ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Opção desconhecida: $1" >&2; usage; exit 1 ;;
    esac
done

if [[ "$CONFIRM_DROP" != "true" ]]; then
    echo "Operação destrutiva: o schema agro será recriado (DROP CASCADE)." >&2
    echo "Execute com --yes para confirmar." >&2
    exit 1
fi

mkdir -p "$LOG_DIR" "$(dirname "$SECRETS_FILE")"
LOG_FILE="$LOG_DIR/agro_fazenda_mock_deploy_$(date '+%Y%m%d_%H%M%S').log"
exec > >(tee -a "$LOG_FILE") 2>&1

log "Iniciando deploy agro_fazenda_mock"
log "Log: $LOG_FILE"

# --- Validações Docker ---
assert_postgres_container "$CONTAINER_NAME"

if docker ps -a --format '{{.Names}}' | grep -qx "gesto-app-postgres-1"; then
    log "AVISO: gesto-app-postgres-1 detectado — este deploy usa somente '$CONTAINER_NAME'."
fi

PGUSER=$(get_postgres_admin_user "$CONTAINER_NAME")

docker exec "$CONTAINER_NAME" pg_isready -U "$PGUSER" >/dev/null 2>&1 || {
    log "ERRO: PostgreSQL no container não está aceitando conexões."
    exit 1
}

log "Container: $CONTAINER_NAME | Admin: $PGUSER"

# --- Build SQL consolidado ---
[[ -x "$BUILD_SCRIPT" ]] || chmod +x "$BUILD_SCRIPT"
"$BUILD_SCRIPT"

[[ -f "$FULL_SQL" ]] || { log "ERRO: $FULL_SQL não encontrado."; exit 1; }

# --- Criar banco ---
DB_EXISTS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';" 2>/dev/null || echo "")

if [[ "$DB_EXISTS" != "1" ]]; then
    log "Criando banco $DB_NAME..."
    if docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
        -c "CREATE DATABASE $DB_NAME ENCODING 'UTF8' LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8' TEMPLATE template0;" 2>/dev/null; then
        log "Banco criado com locale en_US.utf8."
    else
        log "Locale en_US.utf8 indisponível — criando com encoding UTF8 padrão."
        docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
            -c "CREATE DATABASE $DB_NAME ENCODING 'UTF8' TEMPLATE template0;"
    fi
else
    log "Banco $DB_NAME já existe."
fi

# --- Gerenciar senha ---
APP_PASSWORD=""
if [[ -f "$SECRETS_FILE" ]] && [[ "$RESET_PASSWORD" != "true" ]]; then
    # shellcheck disable=SC1090
    source "$SECRETS_FILE"
    APP_PASSWORD="${AGRO_PASS:-${AGRO_MOCK_PASSWORD:-}}"
fi

if [[ -z "$APP_PASSWORD" ]]; then
    APP_PASSWORD=$(openssl rand -hex 24)
    log "Nova senha gerada para $APP_USER."
else
    log "Reutilizando senha existente de $SECRETS_FILE."
fi

# --- Criar/atualizar role ---
ROLE_EXISTS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$APP_USER';" 2>/dev/null || echo "")

if [[ "$ROLE_EXISTS" == "1" ]]; then
    docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
        -c "ALTER USER $APP_USER WITH PASSWORD '$APP_PASSWORD';"
else
    docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
        -c "CREATE USER $APP_USER WITH PASSWORD '$APP_PASSWORD';"
fi

docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
    -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $APP_USER;"

# Salvar credenciais (sem expor senha no log)
cat > "$SECRETS_FILE" <<EOF
# Credenciais agro_fazenda_mock — não commitar
AGRO_DB=$DB_NAME
AGRO_USER=$APP_USER
AGRO_PASS=$APP_PASSWORD
AGRO_HOST=127.0.0.1
AGRO_PORT=5432
AGRO_SCHEMA=agro
# Aliases legados
AGRO_MOCK_DB=$DB_NAME
AGRO_MOCK_USER=$APP_USER
AGRO_MOCK_PASSWORD=$APP_PASSWORD
AGRO_MOCK_HOST=127.0.0.1
AGRO_MOCK_PORT=5432
AGRO_MOCK_SCHEMA=agro
EOF
chmod 600 "$SECRETS_FILE"
log "Credenciais salvas em $SECRETS_FILE"

# --- Executar SQL com guard clause ---
GUARD_SQL="
DO \$\$ BEGIN
  IF current_database() <> '$DB_NAME' THEN
    RAISE EXCEPTION 'Abortado: banco ativo %, esperado $DB_NAME', current_database();
  END IF;
END \$\$;
"

log "Executando SQL consolidado em $DB_NAME..."

{
    echo "$GUARD_SQL"
    cat "$FULL_SQL"
} | docker exec -i "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -v ON_ERROR_STOP=1

# Permissões no schema
docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<EOSQL
GRANT USAGE ON SCHEMA agro TO $APP_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA agro TO $APP_USER;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA agro TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA agro GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA agro GRANT USAGE, SELECT ON SEQUENCES TO $APP_USER;
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agro_mock_readonly') THEN
    GRANT agro_mock_readonly TO $APP_USER;
  END IF;
END \$\$;
EOSQL

# --- Validação ---
VALIDATION_OK="pulada"
if [[ "$SKIP_VALIDATION" != "true" ]]; then
    chmod +x "$VALIDATE_SCRIPT"
    POSTGRES_USER="$PGUSER" POSTGRES_CONTAINER="$CONTAINER_NAME" AGRO_DB="$DB_NAME" \
        "$VALIDATE_SCRIPT" && VALIDATION_OK="sucesso" || VALIDATION_OK="falha"
fi

# --- Resumo ---
TOTAL_TABLES=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'agro' AND table_type = 'BASE TABLE';")
TOTAL_VIEWS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'agro';")

PARTIDAS_STATUS="N/A — tabelas contábeis não encontradas"
if docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='agro' AND table_name='lancamento_contabil';" \
    | grep -q 1; then
    PARTIDAS_STATUS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc "
SELECT CASE WHEN COUNT(*) = 0 THEN 'OK — partidas balanceadas'
            ELSE 'FALHA — ' || COUNT(*) || ' desbalanceados' END
FROM (
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
    PARTIDAS_STATUS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc "
SELECT CASE WHEN COUNT(*) = 0 THEN 'OK — partidas balanceadas'
            ELSE 'FALHA — ' || COUNT(*) || ' desbalanceados' END
FROM (
  SELECT lc.id
  FROM agro.lancamentos_contabeis lc
  JOIN agro.partidas_lancamento pl ON pl.lancamento_id = lc.id
  GROUP BY lc.id
  HAVING SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) <>
         SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END)
) x;
")
fi

log ""
log "========== RESUMO DO DEPLOY =========="
log "Container usado:       $CONTAINER_NAME"
log "Banco:                 $DB_NAME"
log "Usuário app:           $APP_USER"
log "Tabelas (schema agro): $TOTAL_TABLES"
log "Views (schema agro):   $TOTAL_VIEWS"
log "Partidas contábeis:    $PARTIDAS_STATUS"
log "Validação:             $VALIDATION_OK"
log "Credenciais:           $SECRETS_FILE"
log "Log:                   $LOG_FILE"
log "======================================="

if [[ "$VALIDATION_OK" == "falha" ]]; then
    exit 1
fi
