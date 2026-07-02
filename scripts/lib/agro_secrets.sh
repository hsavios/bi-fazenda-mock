#!/usr/bin/env bash
# Carrega credenciais do banco agro_fazenda_mock (sem expor senha).
# Suporta AGRO_* (VPS) e AGRO_MOCK_* (legado).

load_agro_secrets() {
    local secrets_file="${1:-${HOME}/.secrets/agro_fazenda_mock.env}"

    if [[ ! -f "$secrets_file" ]]; then
        echo "ERRO: Arquivo de credenciais não encontrado: $secrets_file" >&2
        echo "Execute o deploy primeiro: ./scripts/deploy_agro_fazenda_mock_vps.sh --yes" >&2
        return 1
    fi

    # shellcheck disable=SC1090
    source "$secrets_file"

    export AGRO_DB="${AGRO_DB:-${AGRO_MOCK_DB:-agro_fazenda_mock}}"
    export AGRO_USER="${AGRO_USER:-${AGRO_MOCK_USER:-agro_mock_user}}"
    export AGRO_PASS="${AGRO_PASS:-${AGRO_MOCK_PASSWORD:-}}"
    export AGRO_HOST="${AGRO_HOST:-${AGRO_MOCK_HOST:-127.0.0.1}}"
    export AGRO_PORT="${AGRO_PORT:-${AGRO_MOCK_PORT:-5432}}"
    export AGRO_SCHEMA="${AGRO_SCHEMA:-${AGRO_MOCK_SCHEMA:-agro}}"

    if [[ -z "$AGRO_PASS" ]]; then
        echo "ERRO: Senha não definida em $secrets_file (AGRO_PASS ou AGRO_MOCK_PASSWORD)." >&2
        return 1
    fi

    return 0
}

assert_postgres_container() {
    local container="${1:-postgres}"

    if [[ "$container" == "gesto-app-postgres-1" ]]; then
        echo "ERRO: Container gesto-app-postgres-1 é proibido para este projeto." >&2
        echo "Use somente o container postgres." >&2
        return 1
    fi

    command -v docker >/dev/null 2>&1 || {
        echo "ERRO: Docker não disponível." >&2
        return 1
    }

    docker ps --format '{{.Names}}' | grep -qx "$container" || {
        echo "ERRO: Container '$container' não está rodando." >&2
        return 1
    }

    return 0
}

get_postgres_admin_user() {
    local container="$1"
    local pguser
    pguser=$(docker exec "$container" printenv POSTGRES_USER 2>/dev/null || true)
    if [[ -z "$pguser" ]]; then
        echo "ERRO: POSTGRES_USER não definido no container $container." >&2
        return 1
    fi
    echo "$pguser"
}
