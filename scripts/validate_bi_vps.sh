#!/usr/bin/env bash
# Valida endpoints do stack BI (PostgREST + nginx)
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
LOG_DIR="$PROJECT_ROOT/logs"

PGRST_URL="${PGRST_URL:-http://127.0.0.1:3000}"
BI_URL="${BI_URL:-http://127.0.0.1:8088}"
TEST_VIEW="${TEST_VIEW:-vw_dre_gerencial}"

usage() {
    cat <<'EOF'
Uso: validate_bi_vps.sh

Valida se PostgREST e nginx do dashboard BI estão respondendo.
EOF
}

[[ "${1:-}" == "--help" ]] && { usage; exit 0; }

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

log "=== Validando stack BI ==="
log "Log: $LOG_FILE"

check_url "PostgREST root" "$PGRST_URL/"
check_url "PostgREST view" "$PGRST_URL/${TEST_VIEW}?limit=1"
check_url "nginx dashboard" "$BI_URL/"
check_url "nginx proxy /api" "$BI_URL/api/${TEST_VIEW}?limit=1"

if [[ $FAILURES -gt 0 ]]; then
    log "Validação BI concluída com FALHAS ($FAILURES problema(s))."
    exit 1
fi

log "Validação BI concluída com sucesso."
