#!/usr/bin/env bash
# Deploy do stack BI (PostgREST + nginx) na VPS
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

GRANT_SCRIPT="$SCRIPT_DIR/grant_agro_fazenda_mock.sh"
VALIDATE_BI_SCRIPT="$SCRIPT_DIR/validate_bi_vps.sh"
ENV_FILE="$PROJECT_ROOT/.env.bi"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.bi.yml"
COMPOSE_OVERRIDE="$PROJECT_ROOT/docker-compose.bi.override.yml"
PG_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
BI_PGRST_PORT="${BI_PGRST_PORT:-3000}"
BI_NGINX_PORT="${BI_NGINX_PORT:-8088}"

usage() {
    cat <<'EOF'
Uso: deploy_bi_vps.sh [opções]

Sobe PostgREST + nginx para o dashboard BI.

Pré-requisitos:
  - Container postgres rodando com agro_fazenda_mock provisionado
  - ~/.secrets/agro_fazenda_mock.env

Opções:
  --skip-grant        Não reaplica permissões no banco antes do deploy
  --skip-validation   Não valida endpoints após subir os containers
  --help              Exibe esta ajuda

Variáveis de ambiente:
  BI_PGRST_PORT       Porta do PostgREST no host (default: 3000)
  BI_NGINX_PORT       Porta do nginx no host (default: 8088)
  POSTGRES_CONTAINER  Nome do container PostgreSQL (default: postgres)

Acesso após deploy:
  Dashboard: http://127.0.0.1:8088
  PostgREST: http://127.0.0.1:3000
EOF
}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

urlencode() {
    python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

detect_postgres_connection() {
    local published
    published=$(docker port "$PG_CONTAINER" 5432/tcp 2>/dev/null | head -1 || true)

    if [[ -n "$published" ]]; then
        PGRST_DB_HOST="host.docker.internal"
        PGRST_DB_PORT="${published##*:}"
        PG_NETWORK_MODE="host-gateway"
        log "PostgreSQL via host publicado em ${published} → host.docker.internal:${PGRST_DB_PORT}"
        return 0
    fi

    PG_NETWORK=$(docker inspect "$PG_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{println $k}}{{end}}' | head -1)

    if [[ -n "$PG_NETWORK" && "$PG_NETWORK" != "bridge" ]]; then
        PGRST_DB_HOST="$PG_CONTAINER"
        PGRST_DB_PORT="5432"
        PG_NETWORK_MODE="docker-network"
        log "PostgreSQL via rede Docker '$PG_NETWORK' → ${PGRST_DB_HOST}:${PGRST_DB_PORT}"
        return 0
    fi

    PGRST_DB_HOST=$(docker inspect "$PG_CONTAINER" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
    PGRST_DB_PORT="5432"
    PG_NETWORK_MODE="ip"
    if [[ -z "$PGRST_DB_HOST" ]]; then
        log "ERRO: não foi possível detectar IP do container $PG_CONTAINER." >&2
        return 1
    fi
    log "PostgreSQL via IP do container → ${PGRST_DB_HOST}:${PGRST_DB_PORT}"
}

write_compose_override() {
  if [[ "$PG_NETWORK_MODE" == "docker-network" ]]; then
    cat > "$COMPOSE_OVERRIDE" <<EOF
services:
  postgrest:
    networks:
      - default
      - postgres_external

networks:
  postgres_external:
    external: true
    name: ${PG_NETWORK}
EOF
  else
    rm -f "$COMPOSE_OVERRIDE"
  fi
}

check_port_free() {
    local port="$1"
    local label="$2"
    if ss -tln 2>/dev/null | grep -q ":${port} "; then
        local owner
        owner=$(ss -tlnp 2>/dev/null | grep ":${port} " | head -1 || true)
        log "ERRO: porta ${port} (${label}) já em uso: ${owner:-ocupada}" >&2
        log "Use BI_PGRST_PORT / BI_NGINX_PORT para escolher outras portas." >&2
        return 1
    fi
    return 0
}

SKIP_GRANT=false
SKIP_VALIDATION=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-grant) SKIP_GRANT=true; shift ;;
        --skip-validation) SKIP_VALIDATION=true; shift ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Opção desconhecida: $1" >&2; usage; exit 1 ;;
    esac
done

command -v docker >/dev/null 2>&1 || { echo "ERRO: Docker não disponível." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERRO: docker compose não disponível." >&2; exit 1; }

assert_postgres_container "$PG_CONTAINER"
load_agro_secrets
detect_postgres_connection

check_port_free "$BI_PGRST_PORT" "PostgREST" || exit 1
check_port_free "$BI_NGINX_PORT" "nginx BI" || exit 1

ENCODED_PASS=$(urlencode "$AGRO_PASS")
PGRST_DB_URI="postgres://${AGRO_USER}:${ENCODED_PASS}@${PGRST_DB_HOST}:${PGRST_DB_PORT}/${AGRO_DB}"

log "Iniciando deploy BI (PostgREST + nginx)"
log "Banco: $AGRO_DB | Usuário PostgREST: $AGRO_USER | Schema: $AGRO_SCHEMA"

if [[ "$SKIP_GRANT" != "true" ]]; then
    log "Reaplicando permissões (app + readonly)..."
    chmod +x "$GRANT_SCRIPT"
    POSTGRES_CONTAINER="$PG_CONTAINER" "$GRANT_SCRIPT"
fi

cat > "$ENV_FILE" <<EOF
PGRST_DB_URI=${PGRST_DB_URI}
BI_PGRST_PORT=${BI_PGRST_PORT}
BI_NGINX_PORT=${BI_NGINX_PORT}
EOF
chmod 600 "$ENV_FILE"
log "Config gerada: $ENV_FILE"

write_compose_override

cd "$PROJECT_ROOT"
COMPOSE_ARGS=(-f "$COMPOSE_FILE")
[[ -f "$COMPOSE_OVERRIDE" ]] && COMPOSE_ARGS+=(-f "$COMPOSE_OVERRIDE")

docker compose "${COMPOSE_ARGS[@]}" --env-file "$ENV_FILE" up -d

if [[ "$PG_NETWORK_MODE" == "ip" ]]; then
    log "Conectando PostgREST à rede bridge do PostgreSQL..."
    docker network connect bridge fazenda-mock-postgrest 2>/dev/null || true
fi

log "Aguardando PostgREST..."
READY=false
for _ in $(seq 1 45); do
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${BI_PGRST_PORT}/" || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        READY=true
        break
    fi
    sleep 1
done

if [[ "$READY" != "true" ]]; then
    log "ERRO: PostgREST não respondeu HTTP 200 em http://127.0.0.1:${BI_PGRST_PORT} (último código: ${HTTP_CODE:-?})"
    docker compose "${COMPOSE_ARGS[@]}" --env-file "$ENV_FILE" logs --tail=40 postgrest
    exit 1
fi

if [[ "$SKIP_VALIDATION" != "true" ]]; then
    chmod +x "$VALIDATE_BI_SCRIPT"
    PGRST_URL="http://127.0.0.1:${BI_PGRST_PORT}" BI_URL="http://127.0.0.1:${BI_NGINX_PORT}" \
        "$VALIDATE_BI_SCRIPT"
fi

log ""
log "========== BI DEPLOY OK =========="
log "Dashboard:  http://127.0.0.1:${BI_NGINX_PORT}"
log "PostgREST:  http://127.0.0.1:${BI_PGRST_PORT}"
log "Parar:      docker compose -f docker-compose.bi.yml ${COMPOSE_OVERRIDE:+-f docker-compose.bi.override.yml} down"
log "=================================="
