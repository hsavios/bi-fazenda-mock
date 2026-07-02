/**
 * Registry central de drill-down — cobertura, resolvers e openDataDrilldown.
 *
 * Mapa de cobertura (auditoria):
 * visao-geral | kpis | kpi | ok
 * visao-geral | waterfall-exec | waterfallStep | ok
 * visao-geral | treemap-cultura | culture | ok
 * culturas | scatter | culture | ok
 * culturas | ranking-margem | culture | ok
 * culturas | culture-cards | culture | ok
 * estoques | kpis | kpi | ok
 * estoques | chart-estoque-prod | stockProduction | ok
 * estoques | treemap-insumos | stockItem | ok
 * estoques | ranking-insumos | stockItem | ok
 * financeiro | kpis | kpi | ok
 * financeiro | waterfall-dre | waterfallStep | ok
 * financeiro | custos-stack | culture | ok
 * financeiro | cards-dre | culture | ok
 * comercializacao | kpis | kpi | ok
 * comercializacao | chart-stack | commercialCulture | ok
 * comercializacao | chart-ranking | commercialCulture | ok
 * comercializacao | comercial-table | commercialCulture | ok
 * caixa | kpis | kpi/cashMonth | ok
 * caixa | cash-matrix | cashMonth | ok
 * caixa | chart-saldo | cashMonth | ok
 * operacoes | pareto | talhao | ok
 * operacoes | heatmap | heatmapCell | ok
 * operacoes | ranking-talhao | talhao | ok
 * operacoes | maquinas | machine | ok
 * perguntas | decision-cards | question | ok
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct,
    sumField
} from './api.js?v=5.0';
import {
    aggregateDreByCulture,
    buildCultureInsights,
    buildStockInsights,
    buildTalhaoInsight
} from './insights.js?v=5.0';
import {
    buildDecisionDrilldown,
    buildCommercialSummary,
    aggregateCashByMonth
} from './decisionQuestions.js?v=5.0';
import { openDrilldown } from './drilldown.js?v=5.0';

const COVERAGE = [];

let getDataFn = () => ({});
let getFilterContextFn = () => '';

export function registerDrillCoverage(section, element, type, status = 'ok') {
    const idx = COVERAGE.findIndex(c => c.section === section && c.element === element && c.type === type);
    if (idx >= 0) {
        COVERAGE[idx].status = status;
        return;
    }
    COVERAGE.push({ section, element, type, status });
}

export function getDrilldownCoverage() {
    return [...COVERAGE];
}

export function initDrilldownRegistry({ getData, getFilterContext }) {
    getDataFn = getData;
    getFilterContextFn = getFilterContext;
    if (typeof window !== 'undefined') {
        window.__BI_DRILLDOWN_COVERAGE__ = getDrilldownCoverage;
    }
}

function pctShare(value, total) {
    if (!total) return 0;
    return (Number(value) / Number(total)) * 100;
}

function statusFromMargin(margemPct) {
    if (margemPct >= 15) return { status: 'ok', label: 'Positivo', tone: 'positive' };
    if (margemPct >= 0) return { status: 'attention', label: 'Atenção', tone: 'warn' };
    return { status: 'critical', label: 'Crítico', tone: 'critical' };
}

function avgProdutividadeByCulture(prodRows) {
    const map = new Map();
    (prodRows || []).forEach(r => {
        const name = r.cultura_nome;
        if (!map.has(name)) map.set(name, { sum: 0, count: 0 });
        const e = map.get(name);
        e.sum += Number(r.produtividade_sc_ha || 0);
        e.count += 1;
    });
    const out = new Map();
    map.forEach((v, k) => out.set(k, v.count ? v.sum / v.count : 0));
    return out;
}

function fallbackDrill(title, context, source) {
    return {
        type: 'fallback',
        title: title || 'Detalhe indisponível para este recorte',
        subtitle: 'Exibindo detalhes dentro do recorte filtrado.',
        metrics: [
            { label: 'Contexto', value: JSON.stringify(context).slice(0, 80) || '—' },
            { label: 'Fonte', value: source || 'Base demonstrativa' }
        ],
        insight: {
            title: 'Próxima camada analítica',
            text: 'Este indicador está consolidado na base demonstrativa. Para detalhamento transacional, a próxima camada exigiria view específica.',
            tone: 'info'
        },
        nextAction: 'Ajuste os filtros ou consulte a aba relacionada para aprofundar.',
        source: source || 'vw_* (agregado)'
    };
}

function buildCultureDrill(cultura, data) {
    const byCulture = aggregateDreByCulture(data.dre || []);
    const row = byCulture.find(c => c.cultura_nome === cultura);
    if (!row) return null;
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const prodMap = avgProdutividadeByCulture(data.produtividade);
    const margemPct = row.receita_bruta ? (row.resultado / row.receita_bruta) * 100 : 0;
    const st = statusFromMargin(margemPct);
    const talhoes = (data.talhoes || []).filter(t => t.cultura_nome === cultura).slice(0, 5);
    const com = buildCommercialSummary(data.comercial).rows.find(r => r.cultura_nome === cultura);
    const estoque = (data.producao || []).filter(p => p.cultura_nome === cultura)
        .reduce((s, p) => s + Number(p.quantidade_atual_sc || 0), 0);
    const insight = buildCultureInsights(data, cultura)[0];

    return {
        type: 'culture',
        title: `Cultura — ${cultura}`,
        subtitle: `${formatPct(pctShare(row.receita_bruta, receitaTotal))} da receita · recorte filtrado`,
        status: st.status,
        statusLabel: st.label,
        metrics: [
            { label: 'Receita', value: formatCurrency(row.receita_bruta), highlight: false },
            { label: 'Custo total', value: formatCurrencyCompact(Number(row.custos_variaveis) + Number(row.custos_fixos)) },
            { label: 'Resultado', value: formatCurrency(row.resultado), highlight: true },
            { label: 'Margem %', value: formatPct(margemPct) },
            { label: 'Produtividade média', value: prodMap.has(cultura) ? formatNumber(prodMap.get(cultura), 1) + ' sc/ha' : '—' },
            { label: 'Participação receita', value: formatPct(pctShare(row.receita_bruta, receitaTotal)) },
            { label: 'Estoque (sc)', value: formatNumber(estoque, 0) },
            { label: 'Saldo comercial', value: com ? formatNumber(com.volume_pendente_sc, 0) + ' sc' : '—' }
        ],
        rows: talhoes.map(t => ({
            label: t.talhao_codigo,
            value: formatCurrencyCompact(t.resultado_estimado),
            meta: `Custo ${formatCurrencyCompact(t.custo_total)}`
        })),
        insight: insight || { title: 'Leitura', text: `${cultura} no recorte atual.`, tone: st.tone },
        nextAction: 'Compare talhões e comercialização desta cultura nas abas Operações e Comercialização.',
        source: 'vw_dre_gerencial · vw_resultado_talhao'
    };
}

function buildTalhaoDrill(talhaoCodigo, data) {
    const t = (data.talhoes || []).find(x => x.talhao_codigo === talhaoCodigo);
    if (!t) return null;
    const prod = (data.produtividade || []).find(p => p.talhao_codigo === talhaoCodigo);
    const area = prod ? Number(prod.area_planejada_ha || 0) : 0;
    const custoHa = area ? Number(t.custo_total) / area : null;
    const st = Number(t.resultado_estimado) >= 0 ? statusFromMargin(10) : statusFromMargin(-5);
    const peers = (data.talhoes || []).filter(x => x.cultura_nome === t.cultura_nome && x.talhao_codigo !== talhaoCodigo)
        .sort((a, b) => Number(b.resultado_estimado) - Number(a.resultado_estimado)).slice(0, 3);

    return {
        type: 'talhao',
        title: `Talhão ${t.talhao_codigo}`,
        subtitle: `${t.cultura_nome} · ${t.talhao_nome || ''}`.trim(),
        status: st.status,
        statusLabel: st.label,
        metrics: [
            { label: 'Cultura', value: t.cultura_nome },
            { label: 'Produção', value: formatNumber(t.producao_sc, 0) + ' sc' },
            { label: 'Custo total', value: formatCurrency(t.custo_total), highlight: true },
            { label: 'Resultado', value: formatCurrency(t.resultado_estimado), highlight: true },
            { label: 'Custo / ha', value: custoHa != null ? formatCurrency(custoHa) + '/ha' : '—' },
            { label: 'Produtividade', value: prod ? formatNumber(prod.produtividade_sc_ha, 1) + ' sc/ha' : '—' },
            { label: 'Preço médio (sc)', value: formatCurrency(t.preco_medio_sc) }
        ],
        rows: peers.map(p => ({ label: p.talhao_codigo, value: formatCurrency(p.resultado_estimado), meta: 'Referência mesma cultura' })),
        insight: buildTalhaoInsight(t)[0],
        nextAction: 'Auditar composição de custo e comparar produtividade com talhões de referência.',
        source: 'vw_resultado_talhao · vw_produtividade_talhao'
    };
}

function buildStockItemDrill(insumoNome, data) {
    const item = (data.insumos || []).find(i => i.insumo_nome === insumoNome);
    if (!item) return null;
    const total = sumField(data.insumos || [], 'valor_estoque');
    return {
        type: 'stockItem',
        title: item.insumo_nome,
        subtitle: item.categoria || 'Insumo',
        metrics: [
            { label: 'Categoria', value: item.categoria || '—' },
            { label: 'Quantidade', value: formatNumber(item.quantidade_atual, 1) + ' ' + (item.unidade || '') },
            { label: 'Valor', value: formatCurrency(item.valor_estoque), highlight: true },
            { label: 'Participação', value: formatPct(pctShare(item.valor_estoque, total)) },
            { label: 'Armazém', value: item.armazem_nome || item.armazem_codigo || '—' }
        ],
        insight: buildStockInsights(data, item)[0],
        nextAction: 'Revisar giro e ponto de reposição deste insumo.',
        source: 'vw_estoque_insumos_atual'
    };
}

function buildCommercialDrill(cultura, data) {
    const card = {
        id: `commercial-${cultura}`,
        question: `Comercialização — ${cultura}`,
        answer: 'Análise agregada por cultura.',
        tone: 'info',
        drillType: 'commercialCulture',
        payload: { cultura }
    };
    const drill = buildDecisionDrilldown(card, data);
    if (!drill) return null;
    return { ...drill, type: 'commercialCulture', source: 'vw_comercializacao_cultura' };
}

function buildCashMonthDrill(monthKey, monthLabel, data) {
    const card = {
        id: `cash-${monthKey}`,
        question: `Pressão de caixa — ${monthLabel}`,
        answer: 'Fluxo realizado no mês selecionado.',
        tone: 'warn',
        drillType: 'cashMonth',
        payload: { monthKey, monthLabel }
    };
    const drill = buildDecisionDrilldown(card, data);
    if (!drill) return null;
    return { ...drill, type: 'cashMonth', source: 'vw_fluxo_caixa_realizado' };
}

function buildMachineDrill(equipamento, data) {
    const m = (data.maquinas || []).find(x => x.equipamento_nome === equipamento);
    if (!m) return null;
    const total = sumField(data.maquinas || [], 'custo_total');
    return {
        type: 'machine',
        title: m.equipamento_nome,
        subtitle: m.categoria || 'Equipamento',
        metrics: [
            { label: 'Horas', value: formatNumber(m.horas_totais, 1) + ' h' },
            { label: 'Custo total', value: formatCurrency(m.custo_total), highlight: true },
            { label: 'Custo / hora', value: m.horas_totais ? formatCurrency(Number(m.custo_total) / Number(m.horas_totais)) : '—' },
            { label: 'Participação', value: formatPct(pctShare(m.custo_total, total)) },
            { label: 'Apontamentos', value: formatNumber(m.apontamentos, 0) }
        ],
        insight: { title: 'Dimensionamento', text: `${m.equipamento_nome} concentra uso relevante na safra demonstrativa.`, tone: 'info' },
        nextAction: 'Revisar alocação de frota e manutenção preventiva.',
        source: 'vw_uso_maquinas_safra'
    };
}

function buildWaterfallStepDrill(label, data) {
    const byCulture = aggregateDreByCulture(data.dre || []);
    const receita = sumField(byCulture, 'receita_bruta');
    const custoVar = sumField(byCulture, 'custos_variaveis');
    const custoFix = sumField(byCulture, 'custos_fixos');
    const resultado = sumField(byCulture, 'resultado');
    const norm = (label || '').toLowerCase();

    let value = 0;
    let field = null;
    if (norm.includes('receita')) { value = receita; field = 'receita_bruta'; }
    else if (norm.includes('vari')) { value = custoVar; field = 'custos_variaveis'; }
    else if (norm.includes('fix') || norm.includes('despesa')) { value = custoFix; field = 'custos_fixos'; }
    else if (norm.includes('resultado')) { value = resultado; field = 'resultado'; }
    else return fallbackDrill(`DRE — ${label}`, { label }, 'vw_dre_gerencial');

    const rows = byCulture
        .map(c => ({
            label: c.cultura_nome,
            value: formatCurrencyCompact(field === 'resultado' ? c.resultado : c[field] || 0),
            meta: formatPct(pctShare(field === 'resultado' ? c.resultado : c[field], value || 1))
        }))
        .sort((a, b) => parseFloat(b.meta) - parseFloat(a.meta))
        .slice(0, 6);

    return {
        type: 'waterfallStep',
        title: `Composição — ${label}`,
        subtitle: 'Participação por cultura no recorte filtrado',
        metrics: [
            { label: 'Grupo DRE', value: label, highlight: true },
            { label: 'Valor consolidado', value: formatCurrency(Math.abs(value)) },
            { label: 'Participação na receita', value: field !== 'receita_bruta' ? formatPct(pctShare(Math.abs(value), receita)) : '100%' }
        ],
        rows,
        insight: {
            title: 'Interpretação',
            text: `O bloco "${label}" representa ${formatCurrencyCompact(Math.abs(value))} na DRE consolidada do recorte.`,
            tone: value >= 0 ? 'positive' : 'warn'
        },
        nextAction: 'Investigue culturas com maior peso neste grupo na aba Financeiro.',
        source: 'vw_dre_gerencial'
    };
}

function buildHeatmapCellDrill(talhao, cultura, data) {
    const row = (data.talhoes || []).find(t => t.talhao_codigo === talhao && t.cultura_nome === cultura);
    if (row) return buildTalhaoDrill(talhao, data);
    if (Number.isFinite(Number(talhao)) || !talhao) {
        return fallbackDrill(`Talhão × ${cultura}`, { talhao, cultura }, 'vw_resultado_talhao');
    }
    return buildTalhaoDrill(talhao, data) || fallbackDrill(`${talhao} · ${cultura}`, { talhao, cultura }, 'vw_resultado_talhao');
}

function buildStockProductionDrill(cultura, data) {
    const vol = (data.producao || []).filter(p => p.cultura_nome === cultura)
        .reduce((s, p) => s + Number(p.quantidade_atual_sc || 0), 0);
    return {
        type: 'stockProduction',
        title: `Produção armazenada — ${cultura}`,
        subtitle: 'Volume em estoque por cultura',
        metrics: [
            { label: 'Cultura', value: cultura },
            { label: 'Volume (sc)', value: formatNumber(vol, 0), highlight: true },
            { label: 'Lotes', value: formatNumber((data.producao || []).filter(p => p.cultura_nome === cultura).length, 0) }
        ],
        rows: (data.producao || []).filter(p => p.cultura_nome === cultura).slice(0, 5).map(p => ({
            label: p.talhao_codigo || p.lote_codigo || '—',
            value: formatNumber(p.quantidade_atual_sc, 0) + ' sc',
            meta: p.safra_codigo || ''
        })),
        insight: { title: 'Estoque de produção', text: `${cultura} concentra ${formatNumber(vol, 0)} sc no recorte.`, tone: 'info' },
        nextAction: 'Alinhar comercialização e logística de entrega.',
        source: 'vw_estoque_producao_atual'
    };
}

function buildKpiDrill(kpiId, data, context = {}) {
    const byCulture = aggregateDreByCulture(data.dre || []);
    const receita = sumField(byCulture, 'receita_bruta');
    const custoVar = sumField(byCulture, 'custos_variaveis');
    const custoFix = sumField(byCulture, 'custos_fixos');
    const custoTotal = custoVar + custoFix;
    const resultado = sumField(byCulture, 'resultado');
    const com = buildCommercialSummary(data.comercial);
    const months = aggregateCashByMonth(data.fluxo);

    const configs = {
        'receita-total': {
            title: 'Composição da receita total',
            value: receita,
            field: 'receita_bruta',
            source: 'vw_dre_gerencial'
        },
        'custo-total': {
            title: 'Composição do custo total',
            value: custoTotal,
            field: '_custo',
            source: 'vw_dre_gerencial'
        },
        resultado: {
            title: 'Composição do resultado',
            value: resultado,
            field: 'resultado',
            source: 'vw_dre_gerencial'
        },
        margem: {
            title: 'Margem líquida — visão por cultura',
            value: resultado,
            field: 'resultado',
            source: 'vw_dre_gerencial'
        },
        'custo-variaveis': {
            title: 'Composição dos custos variáveis',
            value: custoVar,
            field: 'custos_variaveis',
            source: 'vw_dre_gerencial'
        },
        despesas: {
            title: 'Composição de despesas / fixos',
            value: custoFix,
            field: 'custos_fixos',
            source: 'vw_dre_gerencial'
        },
        'valor-contratado': {
            title: 'Valor contratado por cultura',
            rows: com.rows.map(r => ({ label: r.cultura_nome, value: formatCurrency(r.valor_contratado || 0) })),
            metrics: [{ label: 'Total contratado', value: formatCurrency(com.totalValor), highlight: true }],
            source: 'vw_comercializacao_cultura'
        },
        'pct-entregue': {
            title: '% entregue por cultura',
            rows: com.rows.map(r => ({
                label: r.cultura_nome,
                value: formatPct(r.pct_entregue || 0),
                meta: formatNumber(r.volume_entregue_sc, 0) + ' sc'
            })),
            metrics: [{ label: '% médio ponderado', value: formatPct(com.totalContratado ? (com.totalEntregue / com.totalContratado) * 100 : 0), highlight: true }],
            source: 'vw_comercializacao_cultura'
        },
        'valor-insumos': {
            title: 'Composição do estoque de insumos',
            rows: [...(data.insumos || [])].sort((a, b) => b.valor_estoque - a.valor_estoque).slice(0, 6)
                .map(i => ({ label: i.insumo_nome, value: formatCurrencyCompact(i.valor_estoque), meta: i.categoria })),
            metrics: [{ label: 'Valor total', value: formatCurrency(sumField(data.insumos, 'valor_estoque')), highlight: true }],
            source: 'vw_estoque_insumos_atual'
        },
        'estoque-insumos': {
            title: 'Composição do estoque de insumos',
            rows: [...(data.insumos || [])].sort((a, b) => b.valor_estoque - a.valor_estoque).slice(0, 6)
                .map(i => ({ label: i.insumo_nome, value: formatCurrencyCompact(i.valor_estoque), meta: i.categoria })),
            metrics: [{ label: 'Valor total', value: formatCurrency(sumField(data.insumos, 'valor_estoque')), highlight: true }],
            source: 'vw_estoque_insumos_atual'
        },
        'item-critico': {
            action: () => (context.insumo ? buildStockItemDrill(context.insumo, data) : fallbackDrill('Item crítico', context, 'vw_estoque_insumos_atual'))
        },
        'valor-producao': {
            title: 'Produção armazenada por cultura',
            rows: [...new Set((data.producao || []).map(p => p.cultura_nome))].map(c => ({
                label: c,
                value: formatNumber((data.producao || []).filter(p => p.cultura_nome === c).reduce((s, p) => s + Number(p.quantidade_atual_sc || 0), 0), 0) + ' sc'
            })),
            metrics: [{ label: 'Volume total', value: formatNumber(sumField(data.producao, 'quantidade_atual_sc'), 0) + ' sc', highlight: true }],
            source: 'vw_estoque_producao_atual'
        },
        'producao-armazenada': {
            title: 'Produção armazenada por cultura',
            rows: [...new Set((data.producao || []).map(p => p.cultura_nome))].map(c => ({
                label: c,
                value: formatNumber((data.producao || []).filter(p => p.cultura_nome === c).reduce((s, p) => s + Number(p.quantidade_atual_sc || 0), 0), 0) + ' sc'
            })),
            source: 'vw_estoque_producao_atual'
        },
        contratado: {
            title: 'Volume contratado por cultura',
            rows: com.rows.map(r => ({ label: r.cultura_nome, value: formatNumber(r.volume_contratado_sc, 0) + ' sc' })),
            metrics: [{ label: 'Total contratado', value: formatNumber(com.totalContratado, 0) + ' sc', highlight: true }],
            source: 'vw_comercializacao_cultura'
        },
        entregue: {
            title: 'Volume entregue por cultura',
            rows: com.rows.map(r => ({ label: r.cultura_nome, value: formatNumber(r.volume_entregue_sc, 0) + ' sc', meta: formatPct(r.pct_entregue) })),
            metrics: [{ label: 'Total entregue', value: formatNumber(com.totalEntregue, 0) + ' sc', highlight: true }],
            source: 'vw_comercializacao_cultura'
        },
        'saldo-entregar': {
            title: 'Saldo a entregar por cultura',
            rows: com.rows.map(r => ({ label: r.cultura_nome, value: formatNumber(r.volume_pendente_sc, 0) + ' sc' })),
            metrics: [{ label: 'Saldo total', value: formatNumber(com.totalPendente, 0) + ' sc', highlight: true }],
            source: 'vw_comercializacao_cultura'
        },
        'total-entradas': {
            title: 'Entradas de caixa',
            metrics: [{ label: 'Total entradas', value: formatCurrency(months.reduce((s, m) => s + m.entradas, 0)), highlight: true }],
            rows: months.map(m => ({ label: m.monthLabel, value: formatCurrencyCompact(m.entradas) })),
            source: 'vw_fluxo_caixa_realizado'
        },
        'total-saidas': {
            title: 'Saídas de caixa',
            metrics: [{ label: 'Total saídas', value: formatCurrency(months.reduce((s, m) => s + m.saidas, 0)), highlight: true }],
            rows: months.map(m => ({ label: m.monthLabel, value: formatCurrencyCompact(m.saidas) })),
            source: 'vw_fluxo_caixa_realizado'
        },
        'saldo-final': {
            title: 'Saldo acumulado',
            metrics: [{ label: 'Saldo final', value: formatCurrency(months.length ? months[months.length - 1].saldoAcumulado : 0), highlight: true }],
            rows: months.map(m => ({ label: m.monthLabel, value: formatCurrencyCompact(m.saldoAcumulado) })),
            source: 'vw_fluxo_caixa_realizado'
        },
        'pressao-caixa': {
            title: 'Mês de maior pressão de caixa',
            action: () => {
                const hot = [...months].sort((a, b) => b.pressao - a.pressao)[0];
                return hot ? buildCashMonthDrill(hot.monthKey, hot.monthLabel, data) : null;
            }
        },
        'maior-entrada': {
            title: 'Mês de maior entrada',
            action: () => {
                const max = [...months].sort((a, b) => b.entradas - a.entradas)[0];
                return max ? buildCashMonthDrill(max.monthKey, max.monthLabel, data) : null;
            }
        }
    };

    const cfg = configs[kpiId];
    if (!cfg) return fallbackDrill(`KPI — ${kpiId}`, { kpiId }, 'vw_*');

    if (cfg.action) return cfg.action();

    if (cfg.rows) {
        return {
            type: 'kpi',
            title: cfg.title,
            subtitle: 'Detalhamento no recorte filtrado',
            metrics: cfg.metrics || [{ label: 'Indicador', value: formatCurrencyCompact(cfg.value || 0), highlight: true }],
            rows: cfg.rows,
            insight: { title: 'Leitura', text: 'Clique em uma linha relacionada nas abas para aprofundar.', tone: 'info' },
            nextAction: 'Use filtros e abas temáticas para cruzar este KPI.',
            source: cfg.source
        };
    }

    const rows = byCulture.map(c => {
        let v = c[cfg.field] || 0;
        if (cfg.field === '_custo') v = Number(c.custos_variaveis) + Number(c.custos_fixos);
        return { label: c.cultura_nome, value: formatCurrencyCompact(v), meta: formatPct(pctShare(v, cfg.value || 1)) };
    }).sort((a, b) => parseFloat(b.meta) - parseFloat(a.meta));

    return {
        type: 'kpi',
        title: cfg.title,
        subtitle: 'Por cultura · recorte filtrado',
        metrics: [{ label: 'Total', value: formatCurrency(cfg.value), highlight: true }],
        rows,
        insight: { title: 'Distribuição', text: 'Principais culturas que compõem este indicador.', tone: 'info' },
        nextAction: 'Abra a cultura de maior peso para investigar drivers.',
        source: cfg.source
    };
}

function buildCostConcentrationDrill(talhaoCodes, dataIndex, data) {
    const sorted = [...(data.talhoes || [])].sort((a, b) => Number(b.custo_total) - Number(a.custo_total));
    const slice = sorted.slice(0, talhaoCodes?.length || 8);
    const idx = Math.min(dataIndex ?? slice.length - 1, slice.length - 1);
    const subset = slice.slice(0, idx + 1);
    const total = sumField(sorted, 'custo_total');
    const partial = sumField(subset, 'custo_total');
    return {
        type: 'costConcentration',
        title: 'Concentração de custos por talhão',
        subtitle: `Curva acumulada até ${subset[subset.length - 1]?.talhao_codigo || '—'}`,
        metrics: [
            { label: 'Talhões acumulados', value: String(subset.length), highlight: true },
            { label: 'Custo acumulado', value: formatCurrency(partial) },
            { label: '% do total', value: formatPct(pctShare(partial, total)) }
        ],
        rows: subset.map(t => ({
            label: t.talhao_codigo,
            value: formatCurrencyCompact(t.custo_total),
            meta: t.cultura_nome
        })),
        insight: {
            title: 'Interpretação',
            text: `${formatPct(pctShare(partial, total))} dos custos operacionais concentram-se nos ${subset.length} primeiros talhões do ranking.`,
            tone: 'warn'
        },
        nextAction: 'Priorize auditoria de custo nos talhões de maior peso na curva.',
        source: 'vw_resultado_talhao'
    };
}

function sumResumo(data, linha, cultura = 'Consolidado') {
    return (data.dreResumo || [])
        .filter(r => r.linha_dre === linha && (r.cultura_nome || 'Consolidado') === cultura)
        .reduce((s, r) => s + Number(r.valor || 0), 0);
}

function buildDreLineDrill(label, data) {
    const valor = sumResumo(data, label);
    const contas = (data.dreContabil || [])
        .filter(r => r.grupo_dre && label.toLowerCase().includes(r.grupo_dre.split(' ')[0].toLowerCase()))
        .slice(0, 6);
    const rows = (data.dreContabil || [])
        .reduce((acc, r) => {
            const k = r.subgrupo_dre || r.conta_nome;
            if (!acc.find(x => x.label === k)) {
                acc.push({ label: k, value: formatCurrencyCompact(r.valor), meta: r.grupo_dre });
            }
            return acc;
        }, [])
        .slice(0, 6);
    return {
        type: 'dreLine',
        title: `DRE — ${label}`,
        subtitle: 'Competência contábil · recorte filtrado',
        metrics: [
            { label: 'Linha DRE', value: label, highlight: true },
            { label: 'Valor gerencial', value: formatCurrency(valor) }
        ],
        rows: rows.length ? rows : contas.map(r => ({
            label: r.subgrupo_dre || r.conta_nome,
            value: formatCurrencyCompact(r.valor),
            meta: r.grupo_dre
        })),
        insight: {
            title: 'Interpretação contábil',
            text: `${label} totaliza ${formatCurrencyCompact(valor)} no recorte, derivado de lançamentos contábeis balanceados.`,
            tone: valor >= 0 ? 'positive' : 'warn'
        },
        nextAction: 'Aprofunde por conta contábil ou lançamento na hierarquia da DRE.',
        source: 'vw_dre_gerencial_resumo · vw_dre_gerencial_contabil'
    };
}

function buildDreGroupDrill(grupo, conta, data) {
    const rows = (data.dreContabil || []).filter(r =>
        r.grupo_dre === grupo && (!conta || r.conta_codigo === conta)
    );
    const byConta = new Map();
    rows.forEach(r => {
        const k = r.conta_codigo;
        byConta.set(k, (byConta.get(k) || 0) + Number(r.valor || 0));
    });
    const valor = rows.reduce((s, r) => s + Number(r.valor || 0), 0);
    return {
        type: 'dreGroup',
        title: conta ? `Conta ${conta}` : `Grupo — ${grupo}`,
        subtitle: 'Composição contábil por conta analítica',
        metrics: [
            { label: 'Grupo DRE', value: grupo },
            { label: 'Valor consolidado', value: formatCurrency(valor), highlight: true }
        ],
        rows: [...byConta.entries()].map(([cod, v]) => {
            const nome = rows.find(r => r.conta_codigo === cod)?.conta_nome || cod;
            return { label: `${cod} · ${nome}`, value: formatCurrencyCompact(v) };
        }),
        insight: {
            title: 'Investigação gerencial',
            text: `O grupo "${grupo}" concentra ${formatCurrencyCompact(valor)} no recorte filtrado.`,
            tone: 'info'
        },
        nextAction: 'Clique em uma conta para ver lançamentos contábeis relacionados.',
        source: 'vw_dre_gerencial_contabil'
    };
}

function buildAccountingAccountDrill(contaCodigo, data) {
    const entries = (data.dreDrilldown || []).filter(r => r.conta_codigo === contaCodigo).slice(0, 10);
    const nome = entries[0]?.conta_nome || contaCodigo;
    const total = entries.reduce((s, e) => s + Number(e.valor_dre || 0), 0);
    return {
        type: 'accountingAccount',
        title: `Conta ${contaCodigo}`,
        subtitle: nome,
        metrics: [
            { label: 'Impacto na DRE', value: formatCurrency(total), highlight: true },
            { label: 'Lançamentos', value: String(entries.length) }
        ],
        rows: entries.map(e => ({
            label: e.data_lancamento,
            value: formatCurrencyCompact(e.valor_dre),
            meta: (e.historico || e.documento_origem || '').slice(0, 60)
        })),
        insight: {
            title: 'Rastreabilidade',
            text: 'Lançamentos derivados do razão contábil demonstrativo.',
            tone: 'info'
        },
        nextAction: 'Confronte com balancete e comprovantes na próxima camada transacional.',
        source: 'vw_dre_conta_drilldown'
    };
}

function buildCultureDreDrill(cultura, data) {
    const lines = ['Receita bruta', 'Receita líquida', 'Margem bruta', 'EBITDA', 'Resultado líquido gerencial'];
    const comp = (data.dreCulturaComp || []).find(r => r.cultura_nome === cultura);
    return {
        type: 'cultureDre',
        title: `DRE contábil — ${cultura}`,
        subtitle: 'Visão por cultura · competência',
        metrics: comp ? [
            { label: 'Receita líquida', value: formatCurrency(comp.receita_liquida) },
            { label: 'Margem bruta', value: formatCurrency(comp.margem_bruta) },
            { label: 'Resultado líquido', value: formatCurrency(comp.resultado_liquido), highlight: true },
            { label: 'Margem líquida', value: formatPct(comp.margem_liquida_pct) },
            { label: 'Resultado / ha', value: comp.resultado_ha ? formatCurrency(comp.resultado_ha) : '—' },
            { label: 'Resultado / sc', value: comp.resultado_sc ? formatCurrency(comp.resultado_sc) : '—' }
        ] : [],
        rows: lines.map(l => ({
            label: l,
            value: formatCurrencyCompact(sumResumo(data, l, cultura))
        })),
        insight: {
            title: 'Leitura por cultura',
            text: `${cultura} no recorte contábil demonstrativo.`,
            tone: 'info'
        },
        nextAction: 'Compare com produtividade e comercialização nas abas Culturas e Comercialização.',
        source: 'vw_dre_cultura_comparativo · vw_dre_gerencial_resumo'
    };
}

function buildAccountingKpiDrill(kpiId, data) {
    const map = {
        'receita-liquida-contabil': 'Receita líquida',
        'margem-bruta-contabil': 'Margem bruta',
        'ebitda-contabil': 'EBITDA',
        'resultado-liquido-contabil': 'Resultado líquido gerencial',
        'margem-liquida-contabil': 'Resultado líquido gerencial'
    };
    const linha = map[kpiId];
    if (!linha) return fallbackDrill(`KPI contábil — ${kpiId}`, { kpiId }, 'vw_kpis_contabeis');
    return buildDreLineDrill(linha, data);
}

export function resolveDrilldown(type, context = {}) {
    const data = getDataFn();
    switch (type) {
        case 'culture':
            return buildCultureDrill(context.cultura || context.name, data);
        case 'talhao':
            return buildTalhaoDrill(context.talhaoCodigo || context.name, data);
        case 'stockItem':
            return buildStockItemDrill(context.insumo || context.name, data);
        case 'commercialCulture':
            return buildCommercialDrill(context.cultura || context.name, data);
        case 'cashMonth':
            return buildCashMonthDrill(context.monthKey, context.monthLabel || context.name, data);
        case 'machine':
            return buildMachineDrill(context.equipamento || context.name, data);
        case 'waterfallStep':
            return buildWaterfallStepDrill(context.label || context.name, data);
        case 'heatmapCell':
            return buildHeatmapCellDrill(context.talhao, context.cultura, data);
        case 'stockProduction':
            return buildStockProductionDrill(context.cultura || context.name, data);
        case 'kpi':
            return buildKpiDrill(context.kpiId, data, context);
        case 'financial': {
            const cultura = context.cultura || context.name;
            return buildCultureDrill(cultura, data) || fallbackDrill(`DRE — ${cultura}`, { cultura }, 'vw_dre_gerencial');
        }
        case 'costConcentration':
            return buildCostConcentrationDrill(context.talhaoCodes, context.dataIndex, data);
        case 'dreLine':
            return buildDreLineDrill(context.label || context.linha, data);
        case 'dreGroup':
            return buildDreGroupDrill(context.grupo, context.conta, data);
        case 'accountingAccount':
            return buildAccountingAccountDrill(context.conta, data);
        case 'accountingEntry':
            return buildAccountingAccountDrill(context.conta || context.conta_codigo, data);
        case 'accountingKpi':
            return buildAccountingKpiDrill(context.kpiId, data);
        case 'cultureDre':
            return buildCultureDreDrill(context.cultura, data);
        case 'question': {
            const card = context.card;
            if (!card) return null;
            const drill = buildDecisionDrilldown(card, data);
            return drill ? { ...drill, type: 'question', source: 'Perguntas do Gestor' } : null;
        }
        default:
            return null;
    }
}

export function openDataDrilldown(opts) {
    const payload = opts.type && !opts.title
        ? resolveDrilldown(opts.type, opts.context || opts)
        : opts;

    const final = payload || fallbackDrill(opts.title, opts.context, opts.source);

    openDrilldown({
        title: final.title,
        subtitle: final.subtitle || final.summary || '',
        status: final.status,
        statusLabel: final.statusLabel,
        metrics: final.metrics || [],
        rows: final.rows,
        insight: final.insight,
        nextAction: final.nextAction,
        source: final.source,
        filterContext: getFilterContextFn()
            ? `${getFilterContextFn()} · Exibindo detalhes dentro do recorte filtrado.`
            : 'Visão consolidada · Toda a fazenda.'
    });
}

export function openDrill(type, context = {}) {
    openDataDrilldown({ type, context });
}
