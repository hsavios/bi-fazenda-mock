#!/usr/bin/env bash
# Deploy do stack BI (PostgREST + nginx) na VPS
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
SECRETS_FILE="${HOME}/.secrets/agro_fazenda_mock.env"
ENV_FILE="$PROJECT_ROOT/.env.bi"

usage() {
    cat <<'EOF'
Uso: deploy_bi_vps.sh

Sobe PostgREST + nginx para o dashboard BI.
Requer banco agro_fazenda_mock provisionado e ~/.secrets/agro_fazenda_mock.env
EOF
}

[[ "${1:-}" == "--help" ]] && { usage; exit 0; }

command -v docker >/dev/null 2>&1 || { echo "Docker não disponível." >&2; exit 1; }

[[ -f "$SECRETS_FILE" ]] || {
    echo "Credenciais não encontradas. Execute primeiro:" >&2
    echo "  ./scripts/deploy_agro_fazenda_mock_vps.sh --yes" >&2
    exit 1
}

# shellcheck disable=SC1090
source "$SECRETS_FILE"

PGRST_DB_URI="postgres://${AGRO_MOCK_USER}:${AGRO_MOCK_PASSWORD}@host.docker.internal:${AGRO_MOCK_PORT:-5432}/${AGRO_MOCK_DB}"

cat > "$ENV_FILE" <<EOF
PGRST_DB_URI=${PGRST_DB_URI}
EOF
chmod 600 "$ENV_FILE"

cd "$PROJECT_ROOT"
docker compose -f docker-compose.bi.yml --env-file "$ENV_FILE" up -d

echo ""
echo "Dashboard BI: http://127.0.0.1:8088"
echo "PostgREST:    http://127.0.0.1:3000"
echo ""
echo "Parar: docker compose -f docker-compose.bi.yml down"
