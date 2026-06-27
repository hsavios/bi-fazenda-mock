#!/usr/bin/env bash
# Deploy do banco mock agro_fazenda_mock na VPS (container postgres genérico)
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
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
command -v docker >/dev/null 2>&1 || { log "ERRO: Docker não disponível."; exit 1; }

if docker ps -a --format '{{.Names}}' | grep -qx "gesto-app-postgres-1"; then
    if [[ "$CONTAINER_NAME" == "gesto-app-postgres-1" ]]; then
        log "ERRO: Container gesto-app-postgres-1 não pode ser usado."
        exit 1
    fi
fi

docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME" || {
    log "ERRO: Container '$CONTAINER_NAME' não está rodando."
    exit 1
}

# Health check / conectividade
PGUSER=$(docker exec "$CONTAINER_NAME" printenv POSTGRES_USER 2>/dev/null || true)
[[ -n "$PGUSER" ]] || { log "ERRO: POSTGRES_USER não definido no container."; exit 1; }

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
    docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
        -c "CREATE DATABASE $DB_NAME ENCODING 'UTF8' LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8' TEMPLATE template0;"
else
    log "Banco $DB_NAME já existe."
fi

# --- Gerenciar senha ---
APP_PASSWORD=""
if [[ -f "$SECRETS_FILE" ]] && [[ "$RESET_PASSWORD" != "true" ]]; then
    # shellcheck disable=SC1090
    source "$SECRETS_FILE"
    APP_PASSWORD="${AGRO_MOCK_PASSWORD:-}"
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
    RAISE EXCEPTION 'Abortado: banco ativo %', current_database();
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
GRANT agro_mock_readonly TO $APP_USER;
EOSQL

# --- Validação ---
VALIDATION_OK="pulada"
if [[ "$SKIP_VALIDATION" != "true" ]]; then
    chmod +x "$VALIDATE_SCRIPT"
    POSTGRES_USER="$PGUSER" POSTGRES_CONTAINER="$CONTAINER_NAME" AGRO_MOCK_DB="$DB_NAME" \
        "$VALIDATE_SCRIPT" && VALIDATION_OK="sucesso" || VALIDATION_OK="falha"
fi

# --- Resumo ---
TOTAL_TABLES=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'agro' AND table_type = 'BASE TABLE';")
TOTAL_VIEWS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'agro';")

log ""
log "========== RESUMO DO DEPLOY =========="
log "Container usado:     $CONTAINER_NAME"
log "Banco:               $DB_NAME"
log "Usuário app:         $APP_USER"
log "Tabelas (schema agro): $TOTAL_TABLES"
log "Views (schema agro):   $TOTAL_VIEWS"

docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -c "
SET search_path TO agro, public;
SELECT 'fazendas' AS entidade, COUNT(*)::text AS registros FROM fazendas
UNION ALL SELECT 'talhoes', COUNT(*)::text FROM talhoes
UNION ALL SELECT 'culturas', COUNT(*)::text FROM culturas
UNION ALL SELECT 'insumos', COUNT(*)::text FROM insumos
UNION ALL SELECT 'equipamentos', COUNT(*)::text FROM equipamentos
UNION ALL SELECT 'colaboradores', COUNT(*)::text FROM colaboradores
UNION ALL SELECT 'contratos_venda', COUNT(*)::text FROM contratos_venda
UNION ALL SELECT 'lancamentos_contabeis', COUNT(*)::text FROM lancamentos_contabeis;
"

PARTIDAS_STATUS=$(docker exec "$CONTAINER_NAME" psql -U "$PGUSER" -d "$DB_NAME" -tAc "
SELECT CASE WHEN COUNT(*) = 0 THEN 'OK — partidas balanceadas' ELSE 'FALHA — ' || COUNT(*) || ' desbalanceados' END
FROM (
    SELECT lc.id FROM agro.lancamentos_contabeis lc
    JOIN agro.partidas_lancamento pl ON pl.lancamento_id = lc.id
    GROUP BY lc.id
    HAVING SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) <>
           SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END)
) x;
")

log "Partidas contábeis:  $PARTIDAS_STATUS"
log "Validação:          $VALIDATION_OK"
log "Credenciais:        $SECRETS_FILE"
log "Log:                $LOG_FILE"
log "======================================="

if [[ "$VALIDATION_OK" == "falha" ]]; then
    exit 1
fi
