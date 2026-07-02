#!/usr/bin/env bash
# Valida demo pública (local e HTTPS) após publicação via Cloudflared
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$PROJECT_ROOT/.env.bi"

DEMO_URL="${DEMO_URL:-https://demo-agro.heliosavio.com}"
LANDING_URL="${LANDING_URL:-https://heliosavio.com}"
BI_URL="${BI_URL:-}"
LOCAL_ONLY="${LOCAL_ONLY:-false}"

load_bi_ports() {
    if [[ -f "$ENV_FILE" ]]; then
        # shellcheck disable=SC1090
        source "$ENV_FILE"
    fi
    BI_URL="${BI_URL:-http://127.0.0.1:${BI_NGINX_PORT:-8088}}"
}

usage() {
    cat <<'EOF'
Uso: validate_demo_public.sh

Valida demo publicada e segurança básica.

Variáveis:
  DEMO_URL      URL pública da demo (default: https://demo-agro.heliosavio.com)
  LANDING_URL   URL da landing (default: https://heliosavio.com)
  BI_URL        URL local do nginx (default: .env.bi ou :8088)
  LOCAL_ONLY=1  Só valida local (sem HTTPS público)

EOF
}

[[ "${1:-}" == "--help" ]] && { usage; exit 0; }

load_bi_ports
FAILURES=0

log() { echo "[$(date '+%H:%M:%S')] $*"; }

check_http() {
    local label="$1" url="$2" expect="${3:-200}"
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || echo "000")
    if [[ "$code" == "$expect" ]]; then
        log "OK: $label [$code] $url"
    else
        log "ERRO: $label esperado $expect, obteve $code — $url"
        FAILURES=$((FAILURES + 1))
    fi
}

check_header() {
    local label="$1" url="$2" header="$3"
    if curl -sI "$url" | grep -qi "$header"; then
        log "OK: header $label"
    else
        log "ERRO: header ausente — $label ($url)"
        FAILURES=$((FAILURES + 1))
    fi
}

check_no_public_pgrst() {
    local host="${1:-demo-agro.heliosavio.com}"
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "https://${host}:3010/" 2>/dev/null || echo "000")
    if [[ "$code" == "000" ]] || [[ "$code" == "000" ]]; then
        log "OK: :3010 não acessível publicamente em $host (código: ${code:-timeout})"
    elif [[ "$code" == "403" ]] || [[ "$code" == "404" ]] || [[ "$code" == "502" ]]; then
        log "OK: :3010 não expõe PostgREST publicamente [$code]"
    else
        log "AVISO: resposta inesperada em https://${host}:3010/ [$code] — verificar firewall/tunnel"
        FAILURES=$((FAILURES + 1))
    fi
}

log "=== Validação demo pública ==="

log "--- Local ---"
check_http "Dashboard local" "$BI_URL/"
check_http "API local" "$BI_URL/api/vw_dre_gerencial?limit=1"
check_header "X-Content-Type-Options" "$BI_URL/" "x-content-type-options: nosniff"

if [[ "$LOCAL_ONLY" != "true" ]] && [[ "$LOCAL_ONLY" != "1" ]]; then
    log "--- Público HTTPS ---"
    check_http "Dashboard público" "$DEMO_URL/"
    check_http "API pública readonly" "$DEMO_URL/api/vw_dre_gerencial?limit=1"
    check_header "X-Content-Type-Options público" "$DEMO_URL/" "x-content-type-options: nosniff"
    check_header "Referrer-Policy público" "$DEMO_URL/" "referrer-policy:"
    check_http "Landing principal" "$LANDING_URL/"
    check_no_public_pgrst "demo-agro.heliosavio.com"
fi

if [[ -x "$SCRIPT_DIR/validate_bi_vps.sh" ]]; then
    log "--- Stack BI interno ---"
    PGRST_URL="http://127.0.0.1:${BI_PGRST_PORT:-3010}" BI_URL="$BI_URL" "$SCRIPT_DIR/validate_bi_vps.sh" || FAILURES=$((FAILURES + 1))
fi

if [[ $FAILURES -gt 0 ]]; then
    log "Validação concluída com FALHAS ($FAILURES)."
    exit 1
fi

log "Validação concluída com sucesso."
