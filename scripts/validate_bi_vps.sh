#!/usr/bin/env bash
# Valida endpoints do stack BI (PostgREST + nginx) e permissões readonly
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

LOG_DIR="$PROJECT_ROOT/logs"
ENV_FILE="$PROJECT_ROOT/.env.bi"
PG_CONTAINER="${POSTGRES_CONTAINER:-postgres}"

PGRST_URL="${PGRST_URL:-}"
BI_URL="${BI_URL:-}"
TEST_VIEW="${TEST_VIEW:-vw_dre_gerencial}"

KPI_VIEWS=(
    vw_custo_hectare_cultura_safra
    vw_custo_saca_cultura_safra
    vw_resultado_gerencial_cultura
    vw_resultado_talhao
    vw_estoque_insumos_atual
    vw_estoque_producao_atual
    vw_uso_maquinas_safra
    vw_horas_mao_obra_safra
    vw_fluxo_caixa_realizado
    vw_balancete_contabil
    vw_dre_gerencial
    vw_margem_bruta_cultura
    vw_produtividade_talhao
    vw_comercializacao_cultura
)

usage() {
    cat <<'EOF'
Uso: validate_bi_vps.sh

Valida PostgREST, nginx e permissões readonly do BI.
Lê portas de .env.bi (gerado pelo deploy) quando disponível.
EOF
}

[[ "${1:-}" == "--help" ]] && { usage; exit 0; }

load_bi_ports() {
    if [[ -f "$ENV_FILE" ]]; then
        # shellcheck disable=SC1090
        source "$ENV_FILE"
    fi
    PGRST_URL="${PGRST_URL:-http://127.0.0.1:${BI_PGRST_PORT:-3010}}"
    BI_URL="${BI_URL:-http://127.0.0.1:${BI_NGINX_PORT:-8088}}"
}

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/validacao_bi_$(date '+%Y%m%d_%H%M%S').log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

FAILURES=0

check_url() {
    local label="$1"
    local url="$2"
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || echo "000")
    if [[ "$code" == "200" ]]; then
        log "OK: $label ($url) [HTTP $code]"
    else
        log "ERRO: $label ($url) [HTTP $code]"
        FAILURES=$((FAILURES + 1))
    fi
}

validate_readonly_permissions() {
    load_agro_secrets || return 1

    log "Validando permissões agro_mock_readonly..."

    local out
    out=$(docker exec -i -e PGPASSWORD="$AGRO_PASS" "$PG_CONTAINER" \
        psql -U "$AGRO_USER" -d "$AGRO_DB" -v ON_ERROR_STOP=0 -P pager=off 2>&1 <<'EOSQL'
SET ROLE agro_mock_readonly;
SELECT 'select_view_ok' AS teste, COUNT(*)::text AS resultado FROM agro.vw_dre_gerencial;
INSERT INTO agro.fazendas (codigo, razao_social, municipio, uf, area_total_ha)
VALUES ('READONLY-TEST', 'Teste', 'Rio Verde', 'GO', 1);
EOSQL
    )

    if echo "$out" | grep -q 'select_view_ok'; then
        log "OK: agro_mock_readonly consegue SELECT em view KPI"
    else
        log "ERRO: agro_mock_readonly não consegue SELECT em view KPI"
        FAILURES=$((FAILURES + 1))
    fi

    if echo "$out" | grep -qi 'INSERT INTO agro.fazendas' && echo "$out" | grep -qiE 'permission denied|insufficient privilege'; then
        log "OK: agro_mock_readonly bloqueado em INSERT em tabela operacional"
    elif echo "$out" | grep -qi 'INSERT 0 1'; then
        log "ERRO: agro_mock_readonly conseguiu INSERT (não deveria)"
        FAILURES=$((FAILURES + 1))
    else
        log "OK: agro_mock_readonly bloqueado em INSERT em tabela operacional"
    fi
}

validate_kpi_views_api() {
    local view count=0
    for view in "${KPI_VIEWS[@]}"; do
        local code
        code=$(curl -s -o /dev/null -w '%{http_code}' "${PGRST_URL}/${view}?limit=1" || echo "000")
        if [[ "$code" == "200" ]]; then
            count=$((count + 1))
        else
            log "ERRO: view KPI inacessível via API: $view [HTTP $code]"
            FAILURES=$((FAILURES + 1))
        fi
    done
    log "Views KPI acessíveis via PostgREST: ${count}/${#KPI_VIEWS[@]}"
    if [[ "$count" != "${#KPI_VIEWS[@]}" ]]; then
        FAILURES=$((FAILURES + 1))
    fi
}

load_bi_ports

log "=== Validando stack BI ==="
log "Log: $LOG_FILE"
log "PostgREST: $PGRST_URL | Dashboard: $BI_URL"

check_url "PostgREST root" "$PGRST_URL/"
check_url "PostgREST view" "$PGRST_URL/${TEST_VIEW}?limit=1"
check_url "nginx dashboard" "$BI_URL/"
check_url "nginx proxy /api" "$BI_URL/api/${TEST_VIEW}?limit=1"

validate_kpi_views_api
validate_readonly_permissions

if [[ $FAILURES -gt 0 ]]; then
    log "Validação BI concluída com FALHAS ($FAILURES problema(s))."
    exit 1
fi

log "Validação BI concluída com sucesso."
