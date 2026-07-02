#!/usr/bin/env bash
# Valida integridade contábil e views da DRE gerencial
set -Eeuo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
# shellcheck source=lib/agro_secrets.sh
source "$SCRIPT_DIR/lib/agro_secrets.sh"

PG_CONTAINER="${POSTGRES_CONTAINER:-postgres}"
PGRST_URL="${PGRST_URL:-http://127.0.0.1:3010}"
BI_URL="${BI_URL:-http://127.0.0.1:8088}"

ENV_FILE="$PROJECT_ROOT/.env.bi"
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    PGRST_URL="${PGRST_URL:-http://127.0.0.1:${BI_PGRST_PORT:-3010}}"
    BI_URL="${BI_URL:-http://127.0.0.1:${BI_NGINX_PORT:-8088}}"
fi

load_agro_secrets || exit 1
assert_postgres_container "$PG_CONTAINER"

FAILURES=0
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

check_sql() {
    local label="$1"
    local sql="$2"
    local expect="$3"
    local out
    out=$(docker exec -i -e PGPASSWORD="$AGRO_PASS" "$PG_CONTAINER" \
        psql -U "$AGRO_USER" -d "$AGRO_DB" -v ON_ERROR_STOP=1 -P pager=off -t -A -c "$sql" 2>&1) || {
        log "ERRO: $label — falha SQL: $out"
        FAILURES=$((FAILURES + 1))
        return
    }
    if [[ "$out" == "$expect" ]]; then
        log "OK: $label ($out)"
    else
        log "ERRO: $label — esperado '$expect', obteve '$out'"
        FAILURES=$((FAILURES + 1))
    fi
}

check_http() {
    local label="$1"
    local url="$2"
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || echo "000")
    if [[ "$code" == "200" ]]; then
        log "OK: $label [HTTP $code]"
    else
        log "ERRO: $label [HTTP $code] $url"
        FAILURES=$((FAILURES + 1))
    fi
}

log "=== Validando DRE contábil ==="

check_sql "Lançamentos desbalanceados = 0" "
SELECT count(*)::text FROM (
  SELECT lc.id
  FROM agro.lancamentos_contabeis lc
  JOIN agro.partidas_lancamento pl ON pl.lancamento_id = lc.id
  GROUP BY lc.id
  HAVING round(sum(CASE WHEN pl.tipo='debito' THEN pl.valor ELSE 0 END), 2)
      <> round(sum(CASE WHEN pl.tipo='credito' THEN pl.valor ELSE 0 END), 2)
) x;" "0"

check_sql "Contas analíticas sem mapeamento DRE" "
SELECT count(*)::text FROM agro.plano_contas pc
WHERE pc.analitica = TRUE AND pc.tipo IN ('receita','despesa')
  AND NOT EXISTS (SELECT 1 FROM agro.mapeamento_conta_dre m WHERE m.conta_codigo = pc.codigo);" "0"

check_sql "DRE resumo — linhas esperadas (Consolidado)" "
SELECT count(DISTINCT linha_dre)::text FROM agro.vw_dre_gerencial_resumo
WHERE cultura_nome = 'Consolidado';" "16"

check_sql "Receita bruta consolidada > 0" "
SELECT CASE WHEN SUM(valor) > 0 THEN 'ok' ELSE 'zero' END
FROM agro.vw_dre_gerencial_resumo
WHERE cultura_nome = 'Consolidado' AND linha_dre = 'Receita bruta';" "ok"

check_sql "Resultado líquido coerente com somatório resumo" "
WITH dre AS (
  SELECT
    linha_dre,
    round(sum(valor)::numeric, 2) AS valor
  FROM agro.vw_dre_gerencial_resumo
  WHERE cultura_nome = 'Consolidado'
  GROUP BY linha_dre
),
valores AS (
  SELECT
    (SELECT count(*) FROM dre) AS qtd_linhas,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Receita bruta'), 0) AS receita_bruta,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Deduções'), 0) AS deducoes,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Receita líquida'), 0) AS receita_liquida,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Custos variáveis'), 0) AS custos_variaveis,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Margem bruta'), 0) AS margem_bruta,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Custos fixos'), 0) AS custos_fixos,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Resultado atividade agrícola'), 0) AS resultado_atividade,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Despesas comerciais'), 0) AS despesas_comerciais,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Despesas administrativas'), 0) AS despesas_admin,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'EBITDA'), 0) AS ebitda,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Depreciação/amortização'), 0) AS depreciacao,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Resultado operacional'), 0) AS resultado_operacional,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Resultado financeiro'), 0) AS resultado_financeiro,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Resultado antes impostos'), 0) AS resultado_antes_impostos,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Tributos'), 0) AS tributos,
    COALESCE(MAX(valor) FILTER (WHERE linha_dre = 'Resultado líquido gerencial'), 0) AS resultado_liquido
  FROM dre
)
SELECT CASE
  WHEN qtd_linhas < 16 THEN 'linhas_incompletas'
  WHEN ABS(resultado_liquido - (resultado_antes_impostos + tributos)) <= 1.00 THEN 'ok'
  ELSE 'erro'
END
FROM valores;" "ok"

DRE_VIEWS=(
    vw_dre_gerencial_contabil
    vw_dre_gerencial_resumo
    vw_dre_cultura_comparativo
    vw_dre_conta_drilldown
    vw_balancete_gerencial
    vw_kpis_contabeis
)

for v in "${DRE_VIEWS[@]}"; do
    check_http "PostgREST $v" "$PGRST_URL/$v?limit=1"
    check_http "nginx /api/$v" "$BI_URL/api/$v?limit=1"
done

log "Validando readonly..."
out=$(docker exec -i -e PGPASSWORD="$AGRO_PASS" "$PG_CONTAINER" \
    psql -U "$AGRO_USER" -d "$AGRO_DB" -P pager=off 2>&1 <<'EOSQL'
SET ROLE agro_mock_readonly;
SELECT count(*)::text FROM agro.vw_dre_gerencial_resumo;
INSERT INTO agro.lancamentos_contabeis (numero, data_lancamento, status) VALUES ('RO-TEST', CURRENT_DATE, 'lançado');
EOSQL
)
if echo "$out" | grep -qiE 'permission denied|insufficient privilege'; then
    log "OK: agro_mock_readonly bloqueado em INSERT contábil"
else
    log "ERRO: readonly conseguiu INSERT contábil"
    FAILURES=$((FAILURES + 1))
fi

if [[ $FAILURES -gt 0 ]]; then
    log "Validação DRE concluída com FALHAS ($FAILURES)."
    exit 1
fi
log "Validação DRE concluída com sucesso."
