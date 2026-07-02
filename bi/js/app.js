import {
    fetchView,
    formatNumber,
    formatCurrency,
    formatCurrencyCompact,
    formatPct,
    sumField
} from './api.js?v=4.5';
import {
    aggregateDreByCulture,
    buildExecutiveInsights,
    buildCultureInsights,
    buildStockInsights,
    buildStockPanelInsights,
    buildTalhaoInsight,
    renderInsightCards
} from './insights.js?v=4.5';
import {
    buildDecisionQuestions,
    buildDecisionDrilldown,
    buildCommercialSummary,
    buildCommercialInsights,
    buildCashInsights,
    aggregateCashByMonth,
    renderDecisionCards,
    renderSelectedQuestionPanel,
    renderCommercialTable,
    renderCashMatrix,
    renderCashMobilePanel
} from './decisionQuestions.js?v=4.5';
import { initDrilldown, openDrilldown } from './drilldown.js?v=4.5';
import {
    CHART_COLORS,
    waterfallOption,
    treemapOption,
    scatterBubbleOption,
    horizontalBarOption,
    paretoOption,
    stackedBarOption,
    heatmapOption,
    lineAreaOption,
    comboBarLineOption
} from './charts.js?v=4.5';

const charts = {};
const chartsReady = new Set();
let chartResizeObserver = null;
let decisionCards = [];
let selectedDecisionId = null;
let selectedCashMonthKey = null;
const DEBUG_BI = location.hostname === 'localhost' || location.search.includes('debug=1');
const TABS = ['visao-geral', 'culturas', 'estoques', 'financeiro', 'comercializacao', 'caixa', 'operacoes', 'perguntas', 'sobre'];
const CULTURE_ORDER = ['Café', 'Feijão', 'Milho', 'Soja', 'Sorgo'];

let store = {};

function el(id) {
    return document.getElementById(id);
}

function initChart(id) {
    const node = el(id);
    if (!node || typeof echarts === 'undefined') return null;
    if (charts[id]) charts[id].dispose();
    charts[id] = echarts.init(node);
    return charts[id];
}

function setChart(id, option) {
    const chart = initChart(id);
    if (chart) chart.setOption(option, true);
    return chart;
}

function resizeVisibleCharts() {
    const activePanel = document.querySelector('.view-panel.active');
    if (!activePanel) return;
    let count = 0;
    activePanel.querySelectorAll('.chart').forEach(node => {
        const chart = charts[node.id];
        if (chart) {
            chart.resize();
            count += 1;
        }
    });
    if (DEBUG_BI) console.log('[BI] charts resized', count);
}

function resizeCharts() {
    resizeVisibleCharts();
}

function setupChartResizeObserver() {
    if (chartResizeObserver || typeof ResizeObserver === 'undefined') return;
    chartResizeObserver = new ResizeObserver(() => {
        resizeVisibleCharts();
    });
    document.querySelectorAll('.chart-body').forEach(el => chartResizeObserver.observe(el));
}

function sortCultures(names) {
    return [...names].sort((a, b) => {
        const ia = CULTURE_ORDER.indexOf(a);
        const ib = CULTURE_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

function avgProdutividadeByCulture(prodRows) {
    const map = new Map();
    prodRows.forEach(r => {
        const name = r.cultura_nome;
        if (!map.has(name)) map.set(name, { sum: 0, count: 0 });
        const entry = map.get(name);
        entry.sum += Number(r.produtividade_sc_ha || 0);
        entry.count += 1;
    });
    const result = new Map();
    map.forEach((v, k) => result.set(k, v.count ? v.sum / v.count : 0));
    return result;
}

function pctShare(value, total) {
    if (!total) return 0;
    return (Number(value) / Number(total)) * 100;
}

function statusFromMargin(margemPct) {
    if (margemPct >= 15) return { status: 'ok', label: 'Positivo', tone: 'positive' };
    if (margemPct >= 0) return { status: 'attention', label: 'Atenção', tone: 'warn' };
    return { status: 'negative', label: 'Crítico', tone: 'critical' };
}

function kpiPremium(label, value, hint, tone = '', className = '', fullValue = '') {
    const title = fullValue ? ` title="${fullValue.replace(/"/g, '&quot;')}"` : '';
    return `
        <div class="kpi-card kpi-card--${tone || 'default'}">
            <div class="kpi-label">${label}</div>
            <div class="kpi-value ${className}"${title}>${value}</div>
            ${hint ? `<div class="kpi-hint">${hint}</div>` : ''}
        </div>
    `;
}

function renderKpis(containerId, items) {
    const container = el(containerId);
    if (!container) return;
    container.innerHTML = items.map(item =>
        kpiPremium(item.label, item.value, item.hint || '', item.tone || '', item.className || '', item.full || '')
    ).join('');
}

function moneyKpi(label, n, hint = '', tone = '', className = '') {
    return {
        label,
        value: formatCurrencyCompact(n),
        full: formatCurrency(n),
        hint,
        tone,
        className
    };
}

/* ─── Drill-down builders ─── */

function openCultureDrilldown(nome) {
    const byCulture = aggregateDreByCulture(store.dre || []);
    const row = byCulture.find(c => c.cultura_nome === nome) || {};
    const margem = (store.margem || []).find(m => m.cultura_nome === nome) || {};
    const resultado = (store.resultado || []).find(r => r.cultura_nome === nome) || {};
    const prodMap = avgProdutividadeByCulture(store.produtividade || []);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const estoque = (store.producao || [])
        .filter(p => p.cultura_nome === nome)
        .reduce((s, p) => s + Number(p.quantidade_atual_sc || 0), 0);
    const talhoes = (store.talhoes || [])
        .filter(t => t.cultura_nome === nome)
        .sort((a, b) => Number(b.custo_total) - Number(a.custo_total))
        .slice(0, 3);
    const margemPct = row.receita_bruta ? (Number(row.resultado) / Number(row.receita_bruta)) * 100 : 0;
    const st = statusFromMargin(margemPct);
    const insight = buildCultureInsights(store, nome)[0];

    openDrilldown({
        title: `Análise da cultura — ${nome}`,
        subtitle: `${formatPct(pctShare(row.receita_bruta, receitaTotal))} da receita total`,
        status: st.status,
        statusLabel: st.label,
        metrics: [
            { label: 'Receita', value: formatCurrency(row.receita_bruta), title: formatCurrency(row.receita_bruta) },
            { label: 'Custo total', value: formatCurrencyCompact(Number(row.custos_variaveis) + Number(row.custos_fixos)) },
            { label: 'Resultado', value: formatCurrency(row.resultado), highlight: true },
            { label: 'Margem %', value: formatPct(margemPct) },
            { label: 'Produtividade média', value: prodMap.has(nome) ? formatNumber(prodMap.get(nome), 1) + ' sc/ha' : '—' },
            { label: 'Estoque (sc)', value: formatNumber(estoque, 0) },
            { label: 'Talhões principais', value: talhoes.map(t => t.talhao_codigo).join(', ') || '—' },
            { label: 'Custos variáveis', value: formatCurrencyCompact(row.custos_variaveis || resultado.custos_variaveis) },
            { label: 'Despesas / fixos', value: formatCurrencyCompact(row.custos_fixos || resultado.custos_fixos) }
        ],
        insight
    });
}

function openTalhaoDrilldown(talhaoCodigo) {
    const t = (store.talhoes || []).find(x => x.talhao_codigo === talhaoCodigo);
    if (!t) return;
    const prod = (store.produtividade || []).find(p => p.talhao_codigo === talhaoCodigo && p.cultura_nome === t.cultura_nome);
    const area = prod ? Number(prod.area_planejada_ha || 0) : 0;
    const custoHa = area ? Number(t.custo_total) / area : null;
    const st = Number(t.resultado_estimado) >= 0 ? statusFromMargin(10) : statusFromMargin(-5);
    const insight = buildTalhaoInsight(t)[0];

    openDrilldown({
        title: `Talhão ${t.talhao_codigo}`,
        subtitle: `${t.cultura_nome} · ${t.talhao_nome || ''}`.trim(),
        status: st.status,
        statusLabel: st.label,
        metrics: [
            { label: 'Cultura', value: t.cultura_nome },
            { label: 'Produção', value: formatNumber(t.producao_sc, 0) + ' sc' },
            { label: 'Custo total', value: formatCurrency(t.custo_total) },
            { label: 'Resultado estimado', value: formatCurrency(t.resultado_estimado), highlight: true },
            { label: 'Custo / hectare', value: custoHa != null ? formatCurrency(custoHa) + '/ha' : '—' },
            { label: 'Produtividade', value: prod ? formatNumber(prod.produtividade_sc_ha, 1) + ' sc/ha' : '—' },
            { label: 'Preço médio (sc)', value: formatCurrency(t.preco_medio_sc) }
        ],
        insight
    });
}

function openStockDrilldown(insumoNome) {
    const item = (store.insumos || []).find(i => i.insumo_nome === insumoNome);
    if (!item) return;
    const total = sumField(store.insumos || [], 'valor_estoque');
    const insight = buildStockInsights(store, item)[0];

    openDrilldown({
        title: item.insumo_nome,
        subtitle: item.categoria || 'Insumo',
        metrics: [
            { label: 'Categoria', value: item.categoria || '—' },
            { label: 'Quantidade', value: formatNumber(item.quantidade_atual, 1) + ' ' + (item.unidade || '') },
            { label: 'Valor estimado', value: formatCurrency(item.valor_estoque), highlight: true },
            { label: 'Participação', value: formatPct(pctShare(item.valor_estoque, total)) },
            { label: 'Armazém', value: item.armazem_nome || item.armazem_codigo || '—' },
            { label: 'Custo unitário', value: formatCurrency(item.custo_unitario) }
        ],
        insight
    });
}

function openFinancialDrilldown(culturaNome) {
    const byCulture = aggregateDreByCulture(store.dre || []);
    const row = byCulture.find(c => c.cultura_nome === culturaNome);
    if (!row) return;
    const margemPct = row.receita_bruta ? (Number(row.resultado) / Number(row.receita_bruta)) * 100 : 0;
    const st = statusFromMargin(margemPct);
    const insight = buildFinancialInsight(row)[0];

    openDrilldown({
        title: `DRE — ${culturaNome}`,
        subtitle: 'Composição gerencial da cultura',
        status: st.status,
        statusLabel: st.label,
        metrics: [
            { label: 'Receita bruta', value: formatCurrency(row.receita_bruta) },
            { label: 'Custos variáveis', value: formatCurrency(row.custos_variaveis) },
            { label: 'Custos fixos / despesas', value: formatCurrency(row.custos_fixos) },
            { label: 'Resultado', value: formatCurrency(row.resultado), highlight: true },
            { label: 'Margem líquida', value: formatPct(margemPct) }
        ],
        insight
    });
}

function openMachineDrilldown(equipamentoNome) {
    const m = (store.maquinas || []).find(x => x.equipamento_nome === equipamentoNome);
    if (!m) return;

    openDrilldown({
        title: m.equipamento_nome,
        subtitle: m.categoria || 'Equipamento',
        metrics: [
            { label: 'Horas trabalhadas', value: formatNumber(m.horas_totais, 1) + ' h' },
            { label: 'Custo estimado', value: formatCurrency(m.custo_total), highlight: true },
            { label: 'Apontamentos', value: formatNumber(m.apontamentos, 0) },
            { label: 'Custo / hora', value: m.horas_totais ? formatCurrency(Number(m.custo_total) / Number(m.horas_totais)) : '—' }
        ],
        insight: {
            title: 'Uso operacional',
            text: `${m.equipamento_nome} registrou ${formatNumber(m.horas_totais, 1)} horas na safra demonstrativa.`,
            tone: 'info'
        }
    });
}

function bindDrilldownClicks() {
    document.getElementById('culture-cards')?.addEventListener('click', e => {
        const row = e.target.closest('[data-culture]');
        const btn = e.target.closest('[data-analyze]');
        const nome = row?.dataset.culture || btn?.dataset.analyze;
        if (nome) openCultureDrilldown(nome);
    });

    document.getElementById('ranking-insumos')?.addEventListener('click', e => {
        const row = e.target.closest('[data-insumo]');
        if (row) openStockDrilldown(row.dataset.insumo);
    });

    document.getElementById('cards-dre')?.addEventListener('click', e => {
        const row = e.target.closest('[data-dre-culture]');
        if (row) openFinancialDrilldown(row.dataset.dreCulture);
    });
}

function bindTalhaoChartClick(chartId, talhaoCodes) {
    const chart = charts[chartId];
    if (!chart) return;
    chart.off('click');
    chart.on('click', params => {
        const code = params.name || talhaoCodes[params.dataIndex];
        if (code) openTalhaoDrilldown(code);
    });
}

function openDecisionById(id) {
    const card = decisionCards.find(c => c.id === id);
    if (!card) return;
    const drill = buildDecisionDrilldown(card, store);
    if (drill) openDrilldown(drill);
}

function openCommercialCultureDrilldown(cultura) {
    const card = {
        id: `commercial-${cultura}`,
        question: `Como está a comercialização de ${cultura}?`,
        answer: 'Análise agregada por cultura na safra demonstrativa.',
        tone: 'info',
        drillType: 'commercialCulture',
        payload: { cultura }
    };
    const drill = buildDecisionDrilldown(card, store);
    if (drill) openDrilldown(drill);
}

function openCashMonthDrilldown(month) {
    const card = {
        id: `cash-${month.monthKey}`,
        question: 'Em quais meses há maior pressão de caixa?',
        answer: `${month.monthLabel} concentra movimentação relevante de caixa na safra demonstrativa.`,
        tone: month.pressao > 0 ? 'warn' : 'info',
        drillType: 'cashMonth',
        payload: { monthKey: month.monthKey, monthLabel: month.monthLabel }
    };
    const drill = buildDecisionDrilldown(card, store);
    if (drill) openDrilldown(drill);
}

function selectDecision(id) {
    if (!decisionCards.find(c => c.id === id)) return;
    selectedDecisionId = id;
    renderDecisionCards(el('decision-cards'), decisionCards, selectedDecisionId);
    renderSelectedQuestionPanel(
        el('selected-question-panel'),
        decisionCards.find(c => c.id === id),
        store
    );
}

function bindDecisionClicks() {
    const grid = document.getElementById('decision-cards');
    grid?.addEventListener('click', e => {
        const card = e.target.closest('[data-decision-id]');
        if (!card) return;
        selectDecision(card.dataset.decisionId);
    });
    grid?.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest('[data-decision-id]');
        if (!card) return;
        e.preventDefault();
        selectDecision(card.dataset.decisionId);
    });

    document.getElementById('selected-question-panel')?.addEventListener('click', e => {
        const drillBtn = e.target.closest('[data-open-drill]');
        if (drillBtn) openDecisionById(drillBtn.dataset.openDrill);
        const navBtn = e.target.closest('[data-goto-tab]');
        if (navBtn) switchTab(navBtn.dataset.gotoTab);
    });
}

function renderPerguntas() {
    decisionCards = buildDecisionQuestions(store);
    if (!selectedDecisionId || !decisionCards.find(c => c.id === selectedDecisionId)) {
        selectedDecisionId = decisionCards[0]?.id || null;
    }

    renderDecisionCards(el('decision-cards'), decisionCards, selectedDecisionId);
    renderSelectedQuestionPanel(
        el('selected-question-panel'),
        decisionCards.find(c => c.id === selectedDecisionId),
        store
    );
}

function renderComercializacao(drawChart = false) {
    const com = buildCommercialSummary(store.comercial || []);
    const pctEntregue = com.totalContratado
        ? (com.totalEntregue / com.totalContratado) * 100
        : 0;

    renderKpis('kpi-comercial', [
        { label: 'Volume contratado', value: formatNumber(com.totalContratado, 0) + ' sc', hint: '' },
        { label: 'Volume entregue', value: formatNumber(com.totalEntregue, 0) + ' sc', hint: '', tone: 'positive' },
        { label: 'Saldo a entregar', value: formatNumber(com.totalPendente, 0) + ' sc', hint: '', tone: com.totalPendente > 0 ? 'warn' : 'positive' },
        { label: '% entregue', value: formatPct(pctEntregue), hint: '' },
        moneyKpi('Valor contratado', com.totalValor, 'Soma por cultura na safra demonstrativa')
    ]);

    renderInsightCards(el('insights-comercial'), buildCommercialInsights(com));
    renderCommercialTable(el('comercial-table'), store.comercial, openCommercialCultureDrilldown);

    if (!drawChart) return;

    const rows = com.rows.filter(r => Number(r.volume_contratado_sc) > 0);
    if (!rows.length) return;

    const cats = rows.map(r => r.cultura_nome);
    setChart('chart-comercial-stack', stackedBarOption(cats, [
        { name: 'Entregue', data: cats.map(n => rows.find(r => r.cultura_nome === n)?.volume_entregue_sc || 0) },
        { name: 'Saldo a entregar', data: cats.map(n => rows.find(r => r.cultura_nome === n)?.volume_pendente_sc || 0) }
    ]));
    charts['chart-comercial-stack']?.off('click');
    charts['chart-comercial-stack']?.on('click', params => {
        if (params.name) openCommercialCultureDrilldown(params.name);
    });

    const pending = [...rows]
        .filter(r => r.volume_pendente_sc > 0)
        .sort((a, b) => b.volume_pendente_sc - a.volume_pendente_sc)
        .slice(0, 8);
    if (pending.length) {
        const names = pending.map(r => r.cultura_nome);
        setChart('chart-comercial-ranking', horizontalBarOption(
            names,
            pending.map(r => r.volume_pendente_sc),
            { color: CHART_COLORS.gold, formatter: v => formatNumber(v, 0) + ' sc' }
        ));
        charts['chart-comercial-ranking']?.off('click');
        charts['chart-comercial-ranking']?.on('click', params => {
            if (params.name) openCommercialCultureDrilldown(params.name);
        });
    }
}

function setupCashMobile(months) {
    const select = el('cash-month-select');
    if (!select) return;

    if (!selectedCashMonthKey || !months.find(m => m.monthKey === selectedCashMonthKey)) {
        selectedCashMonthKey = months[0]?.monthKey || null;
    }

    select.innerHTML = months.map(m =>
        `<option value="${m.monthKey}"${m.monthKey === selectedCashMonthKey ? ' selected' : ''}>${m.monthLabel}</option>`
    ).join('');

    select.onchange = () => {
        selectedCashMonthKey = select.value;
        renderCashMobilePanel(el('cash-mobile-cards'), months, selectedCashMonthKey);
    };

    renderCashMobilePanel(el('cash-mobile-cards'), months, selectedCashMonthKey);
}

function renderCaixa(drawChart = false) {
    const months = aggregateCashByMonth(store.fluxo);
    const totalEntradas = months.reduce((s, m) => s + m.entradas, 0);
    const totalSaidas = months.reduce((s, m) => s + m.saidas, 0);
    const saldoFinal = months.length ? months[months.length - 1].saldoAcumulado : 0;
    const maxPressao = months.length
        ? [...months].sort((a, b) => b.pressao - a.pressao)[0]
        : null;
    const maxEntrada = months.length
        ? [...months].sort((a, b) => b.entradas - a.entradas)[0]
        : null;

    renderKpis('kpi-caixa', [
        moneyKpi('Total de entradas', totalEntradas, 'Fluxo realizado agregado', 'positive'),
        moneyKpi('Total de saídas', totalSaidas, 'Desembolsos do período', 'warn'),
        moneyKpi('Saldo final', saldoFinal, 'Saldo acumulado no fim do período', saldoFinal >= 0 ? 'positive' : 'critical'),
        { label: 'Mês de maior pressão', value: maxPressao?.monthLabel || '—', hint: maxPressao ? formatCurrencyCompact(maxPressao.pressao) + ' de pressão' : '', tone: 'warn' },
        { label: 'Maior entrada mensal', value: maxEntrada?.monthLabel || '—', hint: maxEntrada ? formatCurrencyCompact(maxEntrada.entradas) : '', tone: 'positive' }
    ]);

    renderInsightCards(el('insights-caixa'), buildCashInsights(months));
    renderCashMatrix(el('cash-matrix'), store.fluxo, openCashMonthDrilldown);
    setupCashMobile(months);

    if (!drawChart || !months.length) return;

    setChart('chart-caixa-saldo', lineAreaOption(
        months.map(m => m.monthLabel),
        months.map(m => m.saldoAcumulado),
        { rotate: months.length > 6 ? 28 : 0, interval: Math.max(0, Math.floor(months.length / 6)) }
    ));
}

/* ─── Visão Geral ─── */

function renderOverview(dre, margem, custoHa, comercial, producao, insumos, drawChart = false) {
    const byCulture = aggregateDreByCulture(dre);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const custoVar = sumField(byCulture, 'custos_variaveis');
    const custoFix = sumField(byCulture, 'custos_fixos');
    const custoTotal = custoVar + custoFix;
    const resultado = sumField(byCulture, 'resultado');
    const margemPct = receitaTotal ? (resultado / receitaTotal) * 100 : 0;
    const areaTotal = custoHa.reduce((s, r) => s + Number(r.area_total_ha || 0), 0);
    const estoqueSc = sumField(producao, 'quantidade_atual_sc');
    const estoqueValor = sumField(insumos, 'valor_estoque');
    const resultadoSt = statusFromMargin(margemPct);

    renderKpis('kpi-overview', [
        moneyKpi('Receita total', receitaTotal, 'Faturamento bruto consolidado', 'positive'),
        moneyKpi('Custo total', custoTotal, 'Variáveis + fixos da safra', 'warn'),
        moneyKpi('Resultado', resultado, resultado >= 0 ? 'Margem saudável na operação simulada' : 'Resultado negativo — atenção', resultadoSt.tone, resultado >= 0 ? 'kpi-value--positive' : 'kpi-value--negative'),
        { label: 'Margem líquida', value: formatPct(margemPct), hint: resultadoSt.label, tone: resultadoSt.tone },
        { label: 'Área total', value: formatNumber(areaTotal, 0) + ' ha', hint: `${formatNumber(comercial.length || byCulture.length)} culturas` },
        moneyKpi('Estoque insumos', estoqueValor, formatNumber(estoqueSc, 0) + ' sc de produção armazenada')
    ]);

    renderInsightCards(el('insights-overview'), buildExecutiveInsights(store));

    if (!drawChart) return;

    setChart('chart-waterfall-exec', waterfallOption([
        { label: 'Receita bruta', value: receitaTotal, type: 'add' },
        { label: 'Custos var.', value: -custoVar, type: 'subtract' },
        { label: 'Custos fixos', value: -custoFix, type: 'subtract' },
        { label: 'Resultado', value: resultado, type: 'total' }
    ]));

    const treemapSource = sortCultures(byCulture.map(c => c.cultura_nome)).map(name => {
        const c = byCulture.find(r => r.cultura_nome === name);
        const val = Number(c.resultado) > 0 ? Number(c.resultado) : Number(c.receita_bruta);
        return { name, value: val, pct: pctShare(val, resultado > 0 ? resultado : receitaTotal) };
    }).filter(i => i.value > 0);

    if (treemapSource.length) {
        setChart('chart-treemap-cultura', treemapOption(treemapSource));
    }
}

/* ─── Culturas ─── */

function renderCulturas(resultado, margem, produtividade, dre, drawChart = false) {
    const prodMap = avgProdutividadeByCulture(produtividade);
    const margemMap = new Map(margem.map(m => [m.cultura_nome, m]));
    const byCulture = aggregateDreByCulture(dre);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const culturas = sortCultures([...new Set([
        ...resultado.map(r => r.cultura_nome),
        ...margem.map(m => m.cultura_nome)
    ])].filter(Boolean));

    const container = el('culture-cards');
    if (container) {
        const rows = culturas.map(nome => {
            const res = resultado.find(r => r.cultura_nome === nome) || {};
            const dreRow = byCulture.find(c => c.cultura_nome === nome) || {};
            const mar = margemMap.get(nome) || {};
            const prod = prodMap.get(nome);
            const receita = Number(res.receita_bruta ?? mar.receita_bruta ?? dreRow.receita_bruta ?? 0);
            const custo = Number(res.custos_variaveis || dreRow.custos_variaveis || 0) + Number(res.custos_fixos || dreRow.custos_fixos || 0);
            const resultadoVal = Number(res.resultado ?? dreRow.resultado ?? mar.margem_bruta ?? 0);
            const margemPct = receita ? (resultadoVal / receita) * 100 : 0;
            const st = statusFromMargin(margemPct);
            const share = formatPct(pctShare(receita, receitaTotal));
            return `
                <tr data-culture="${nome}">
                    <td class="cell-name">${nome}</td>
                    <td title="${formatCurrency(receita)}">${formatCurrencyCompact(receita)}</td>
                    <td title="${formatCurrency(custo)}">${formatCurrencyCompact(custo)}</td>
                    <td title="${formatCurrency(resultadoVal)}">${formatCurrencyCompact(resultadoVal)}</td>
                    <td>${prod != null ? formatNumber(prod, 1) : '—'}</td>
                    <td>${share}</td>
                    <td><span class="status-pill status-pill--${st.status}">${st.label}</span></td>
                    <td class="cell-actions"><button type="button" class="btn-analyze" data-analyze="${nome}">Analisar</button></td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <table class="compact-table">
                <thead>
                    <tr>
                        <th>Cultura</th>
                        <th>Receita</th>
                        <th>Custo</th>
                        <th>Margem</th>
                        <th>sc/ha</th>
                        <th>Part.</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    if (!drawChart) return;

    const points = culturas.map(nome => {
        const res = resultado.find(r => r.cultura_nome === nome) || {};
        const dreRow = byCulture.find(c => c.cultura_nome === nome) || {};
        const receita = Number(res.receita_bruta ?? dreRow.receita_bruta ?? 0);
        const resultadoVal = Number(res.resultado ?? dreRow.resultado ?? 0);
        const margemPct = receita ? (resultadoVal / receita) * 100 : 0;
        const prod = prodMap.get(nome) || 0;
        const st = statusFromMargin(margemPct);
        const color = st.tone === 'positive' ? CHART_COLORS.positive : st.tone === 'warn' ? CHART_COLORS.warn : CHART_COLORS.negative;
        return { name: nome, x: prod, y: margemPct, size: receita, receita, color };
    }).filter(p => p.x > 0 || p.receita > 0);

    if (points.length) {
        setChart('chart-scatter-cultura', scatterBubbleOption(points));
    }

    const sorted = [...culturas].sort((a, b) => {
        const ra = byCulture.find(c => c.cultura_nome === a);
        const rb = byCulture.find(c => c.cultura_nome === b);
        const ma = ra?.receita_bruta ? (ra.resultado / ra.receita_bruta) * 100 : 0;
        const mb = rb?.receita_bruta ? (rb.resultado / rb.receita_bruta) * 100 : 0;
        return ma - mb;
    });

    setChart('chart-margem-cultura', horizontalBarOption(
        sorted,
        sorted.map(n => {
            const r = byCulture.find(c => c.cultura_nome === n);
            return r?.receita_bruta ? (r.resultado / r.receita_bruta) * 100 : 0;
        }),
        { color: CHART_COLORS.primary, formatter: v => formatPct(v), xFormatter: v => v + '%' }
    ));
}

/* ─── Estoques ─── */

function renderEstoques(insumos, producao, drawChart = false) {
    const valorInsumos = sumField(insumos, 'valor_estoque');
    const volumeProd = sumField(producao, 'quantidade_atual_sc');
    const topInsumo = [...insumos].sort((a, b) => Number(b.valor_estoque) - Number(a.valor_estoque))[0];

    renderKpis('kpi-estoques', [
        { label: 'Produção armazenada', value: formatNumber(volumeProd, 0) + ' sc', hint: 'Grãos e café em estoque' },
        moneyKpi('Valor produção est.', volumeProd * 85, 'Estimativa ilustrativa', 'positive'),
        moneyKpi('Valor insumos', valorInsumos, `${insumos.length} itens monitorados`),
        { label: 'Item crítico', value: topInsumo?.insumo_nome?.slice(0, 18) || '—', hint: topInsumo ? formatCurrencyCompact(topInsumo.valor_estoque) : '', tone: 'warn' }
    ]);

    renderInsightCards(el('insights-estoques'), buildStockPanelInsights(store));

    const byCulture = new Map();
    producao.forEach(p => {
        const c = p.cultura_nome;
        byCulture.set(c, (byCulture.get(c) || 0) + Number(p.quantidade_atual_sc || 0));
    });
    const cultNames = sortCultures([...byCulture.keys()]);

    const rankingEl = el('ranking-insumos');
    if (rankingEl) {
        const top5 = [...insumos]
            .sort((a, b) => Number(b.valor_estoque) - Number(a.valor_estoque))
            .slice(0, 5);
        rankingEl.innerHTML = top5.map((item, i) => `
            <div class="ranking-row" data-insumo="${item.insumo_nome}">
                <span class="ranking-pos">${i + 1}</span>
                <div class="ranking-info">
                    <div class="ranking-name">${item.insumo_nome}</div>
                    <div class="ranking-meta">${item.categoria} · ${formatNumber(item.quantidade_atual, 1)} ${item.unidade || ''}</div>
                </div>
                <span class="ranking-value">${formatCurrencyCompact(item.valor_estoque)}</span>
            </div>
        `).join('');
    }

    if (!drawChart) return;

    if (cultNames.length) {
        setChart('chart-estoque-prod', horizontalBarOption(
            cultNames,
            cultNames.map(c => byCulture.get(c)),
            { color: CHART_COLORS.light, formatter: v => formatNumber(v, 0) + ' sc' }
        ));
    }

    const treemapIns = [...insumos]
        .sort((a, b) => Number(b.valor_estoque) - Number(a.valor_estoque))
        .slice(0, 12)
        .map(i => ({
            name: i.insumo_nome,
            value: Number(i.valor_estoque),
            pct: pctShare(i.valor_estoque, valorInsumos)
        }));

    if (treemapIns.length) {
        setChart('chart-treemap-insumos', treemapOption(treemapIns));
    }
}

/* ─── Financeiro ─── */

function buildFinanceiroPanelInsights(dre) {
    const byCulture = aggregateDreByCulture(dre);
    const receita = sumField(byCulture, 'receita_bruta');
    const resultado = sumField(byCulture, 'resultado');
    const margemPct = receita ? (resultado / receita) * 100 : 0;
    const top = [...byCulture].sort((a, b) => b.resultado - a.resultado)[0];
    const low = [...byCulture].sort((a, b) => a.resultado - b.resultado)[0];
    const insights = [{
        title: 'Resultado consolidado',
        text: `A safra demonstrativa encerra com resultado de ${formatCurrencyCompact(resultado)} e margem de ${formatPct(margemPct)}.`,
        tone: resultado >= 0 ? 'positive' : 'critical'
    }];
    if (top) {
        insights.push({
            title: 'Maior contribuidor',
            text: `${top.cultura_nome} lidera o resultado com ${formatCurrencyCompact(top.resultado)}.`,
            tone: 'positive'
        });
    }
    if (low && low.cultura_nome !== top?.cultura_nome) {
        insights.push({
            title: 'Cultura a monitorar',
            text: `${low.cultura_nome} apresenta menor resultado relativo (${formatCurrencyCompact(low.resultado)}).`,
            tone: 'warn'
        });
    }
    return insights;
}

function renderFinanceiro(dre, _fluxo, drawChart = false) {
    const byCulture = aggregateDreByCulture(dre);
    const receita = sumField(byCulture, 'receita_bruta');
    const custosVar = sumField(byCulture, 'custos_variaveis');
    const despesas = sumField(byCulture, 'custos_fixos');
    const resultado = sumField(byCulture, 'resultado');
    const margemPct = receita ? (resultado / receita) * 100 : 0;
    const resultadoClass = resultado >= 0 ? 'kpi-value--positive' : 'kpi-value--negative';

    renderKpis('kpi-financeiro', [
        moneyKpi('Receita', receita, 'Entradas consolidadas', 'positive'),
        moneyKpi('Custos variáveis', custosVar),
        moneyKpi('Despesas / fixos', despesas),
        moneyKpi('Resultado', resultado, `Margem ${formatPct(margemPct)}`, resultado >= 0 ? 'positive' : 'critical', resultadoClass)
    ]);

    renderInsightCards(el('insights-financeiro'), buildFinanceiroPanelInsights(dre));

    const dreContainer = el('cards-dre');
    if (dreContainer) {
        const rows = sortCultures(byCulture.map(d => d.cultura_nome)).map(name => {
            const d = byCulture.find(r => r.cultura_nome === name);
            const mp = d.receita_bruta ? (d.resultado / d.receita_bruta) * 100 : 0;
            const st = statusFromMargin(mp);
            return `
                <tr data-dre-culture="${name}">
                    <td class="cell-name">${name}</td>
                    <td>${formatCurrencyCompact(d.receita_bruta)}</td>
                    <td>${formatCurrencyCompact(d.custos_variaveis)}</td>
                    <td>${formatCurrencyCompact(d.custos_fixos)}</td>
                    <td>${formatCurrencyCompact(d.resultado)}</td>
                    <td><span class="status-pill status-pill--${st.status}">${formatPct(mp)}</span></td>
                </tr>
            `;
        }).join('');

        dreContainer.innerHTML = `
            <table class="compact-table">
                <thead>
                    <tr>
                        <th>Cultura</th>
                        <th>Receita</th>
                        <th>Custos var.</th>
                        <th>Despesas</th>
                        <th>Resultado</th>
                        <th>Margem</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    if (!drawChart) return;

    setChart('chart-waterfall-dre', waterfallOption([
        { label: 'Receita', value: receita, type: 'add' },
        { label: 'Custos var.', value: -custosVar, type: 'subtract' },
        { label: 'Despesas', value: -despesas, type: 'subtract' },
        { label: 'Resultado', value: resultado, type: 'total' }
    ]));

    const cats = sortCultures(byCulture.map(c => c.cultura_nome));
    setChart('chart-custos-stack', stackedBarOption(cats, [
        { name: 'Variáveis', data: cats.map(n => byCulture.find(c => c.cultura_nome === n)?.custos_variaveis || 0) },
        { name: 'Fixos', data: cats.map(n => byCulture.find(c => c.cultura_nome === n)?.custos_fixos || 0) }
    ]));
}

/* ─── Operações ─── */

function renderOperacoes(talhoes, maquinas, _maoObra, drawChart = false) {
    const sortedTalhoes = [...talhoes].sort((a, b) => Number(b.custo_total) - Number(a.custo_total));

    if (!drawChart) return;

    const paretoSlice = sortedTalhoes.slice(0, 8);
    const paretoCodes = paretoSlice.map(t => t.talhao_codigo);
    if (paretoSlice.length) {
        setChart('chart-pareto-talhao', paretoOption(paretoCodes, paretoSlice.map(t => Number(t.custo_total))));
        bindTalhaoChartClick('chart-pareto-talhao', paretoCodes);
    }

    const culturas = sortCultures([...new Set(talhoes.map(t => t.cultura_nome))]);
    const talhaoCodes = [...new Set(talhoes.map(t => t.talhao_codigo))].slice(0, 8);
    const heatMatrix = talhaoCodes.map(tc =>
        culturas.map(cult => {
            const row = talhoes.find(t => t.talhao_codigo === tc && t.cultura_nome === cult);
            return row ? Number(row.custo_total) : 0;
        })
    );

    if (talhaoCodes.length && culturas.length) {
        setChart('chart-heatmap-talhao', heatmapOption(culturas, talhaoCodes, heatMatrix));
    }

    const byResult = [...talhoes].sort((a, b) => Number(b.resultado_estimado) - Number(a.resultado_estimado)).slice(0, 8);
    const resultCodes = byResult.map(t => t.talhao_codigo);
    if (byResult.length) {
        setChart('chart-ranking-talhao', horizontalBarOption(
            resultCodes,
            byResult.map(t => Number(t.resultado_estimado)),
            { color: CHART_COLORS.light, formatter: v => formatCurrency(v) }
        ));
        bindTalhaoChartClick('chart-ranking-talhao', resultCodes);
    }

    const maqSorted = [...maquinas].sort((a, b) => Number(b.horas_totais) - Number(a.horas_totais)).slice(0, 8);
    if (maqSorted.length) {
        setChart('chart-maquinas', comboBarLineOption(
            maqSorted.map(m => m.equipamento_nome),
            [{ name: 'Custo (R$)', data: maqSorted.map(m => Number(m.custo_total)) }],
            [{ name: 'Horas', data: maqSorted.map(m => Number(m.horas_totais)) }]
        ));

        charts['chart-maquinas']?.off('click');
        charts['chart-maquinas']?.on('click', params => {
            if (params.name) openMachineDrilldown(params.name);
        });
    }
}

/* ─── Tab / load ─── */

function refreshChartsForTab(tabId) {
    if (chartsReady.has(tabId)) {
        requestAnimationFrame(() => {
            resizeVisibleCharts();
            requestAnimationFrame(resizeVisibleCharts);
        });
        return;
    }
    try {
        switch (tabId) {
            case 'visao-geral':
                renderOverview(store.dre, store.margem, store.custoHa, store.comercial, store.producao, store.insumos, true);
                break;
            case 'culturas':
                renderCulturas(store.resultado, store.margem, store.produtividade, store.dre, true);
                break;
            case 'estoques':
                renderEstoques(store.insumos, store.producao, true);
                break;
            case 'financeiro':
                renderFinanceiro(store.dre, store.fluxo, true);
                break;
            case 'comercializacao':
                renderComercializacao(true);
                break;
            case 'caixa':
                renderCaixa(true);
                break;
            case 'operacoes':
                renderOperacoes(store.talhoes, store.maquinas, store.maoObra, true);
                break;
            case 'perguntas':
                renderPerguntas();
                break;
            default:
                break;
        }
        chartsReady.add(tabId);
        requestAnimationFrame(() => {
            resizeVisibleCharts();
            requestAnimationFrame(resizeVisibleCharts);
        });
    } catch (err) {
        console.error('Erro ao renderizar gráficos:', tabId, err);
    }
}

function switchTab(tabId, pushHash = true) {
    if (!TABS.includes(tabId)) tabId = 'visao-geral';

    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.view === tabId);
    });

    const activePanel = document.querySelector(`.view-panel[data-view="${tabId}"]`);
    if (activePanel) activePanel.scrollTop = 0;

    if (pushHash && location.hash !== `#${tabId}`) {
        history.replaceState(null, '', `#${tabId}`);
    }

    requestAnimationFrame(() => refreshChartsForTab(tabId));
}

function setupTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const hash = location.hash.replace('#', '');
    switchTab(TABS.includes(hash) ? hash : 'visao-geral', false);

    window.addEventListener('hashchange', () => {
        const h = location.hash.replace('#', '');
        if (TABS.includes(h)) switchTab(h, false);
    });
}

async function fetchAllViews(onProgress) {
    const tasks = [
        ['dre', () => fetchView('vw_dre_gerencial')],
        ['margem', () => fetchView('vw_margem_bruta_cultura')],
        ['resultado', () => fetchView('vw_resultado_gerencial_cultura')],
        ['custoHa', () => fetchView('vw_custo_hectare_cultura_safra')],
        ['comercial', () => fetchView('vw_comercializacao_cultura')],
        ['produtividade', () => fetchView('vw_produtividade_talhao', { limit: '200' })],
        ['insumos', () => fetchView('vw_estoque_insumos_atual')],
        ['producao', () => fetchView('vw_estoque_producao_atual', { limit: '20' })],
        ['fluxo', () => fetchView('vw_fluxo_caixa_realizado', { order: 'data_movimento', limit: '40' })],
        ['talhoes', () => fetchView('vw_resultado_talhao', { order: 'custo_total.desc', limit: '15' })],
        ['maquinas', () => fetchView('vw_uso_maquinas_safra')],
        ['maoObra', () => fetchView('vw_horas_mao_obra_safra', { limit: '100' })]
    ];

    const out = {};
    const errors = [];
    let done = 0;

    await Promise.all(tasks.map(async ([key, fn]) => {
        try {
            out[key] = await fn();
        } catch (err) {
            errors.push(key);
            out[key] = [];
            console.error(`Falha ao carregar ${key}:`, err);
        } finally {
            done += 1;
            onProgress?.(done, tasks.length);
        }
    }));

    return { data: out, errors };
}

function showLoadError(msg) {
    el('loading-state')?.classList.add('hidden');
    const errorText = el('error-text');
    if (errorText) errorText.textContent = msg;
    el('error-state')?.classList.remove('hidden');
}

function showDashboard() {
    el('loading-state')?.classList.add('hidden');
    el('error-state')?.classList.add('hidden');
    el('app-views')?.classList.remove('hidden');
}

async function loadDashboard() {
    const loadingText = el('loading-text');

    try {
        const { data, errors } = await fetchAllViews((done, total) => {
            if (loadingText) loadingText.textContent = `Carregando indicadores (${done}/${total})...`;
        });

        if (!data.dre?.length && errors.includes('dre')) {
            throw new Error('Não foi possível conectar à API de indicadores.');
        }

        store = data;

        renderOverview(data.dre, data.margem, data.custoHa, data.comercial, data.producao, data.insumos, false);
        renderCulturas(data.resultado, data.margem, data.produtividade, data.dre, false);
        renderEstoques(data.insumos, data.producao, false);
        renderFinanceiro(data.dre, data.fluxo, false);
        renderComercializacao(false);
        renderCaixa(false);
        renderOperacoes(data.talhoes, data.maquinas, data.maoObra, false);
        renderPerguntas();

        showDashboard();
        initDrilldown(() => {
            requestAnimationFrame(resizeVisibleCharts);
        });
        bindDrilldownClicks();
        bindDecisionClicks();
        setupChartResizeObserver();
        setupTabs();
        refreshChartsForTab('visao-geral');
    } catch (err) {
        console.error(err);
        showLoadError(err.message || 'Não foi possível carregar os indicadores. Tente novamente.');
    }
}

document.getElementById('btn-retry')?.addEventListener('click', () => {
    el('error-state')?.classList.add('hidden');
    el('loading-state')?.classList.remove('hidden');
    if (el('loading-text')) el('loading-text').textContent = 'Carregando indicadores...';
    chartsReady.clear();
    Object.values(charts).forEach(c => c?.dispose());
    loadDashboard();
});

window.addEventListener('resize', () => {
    requestAnimationFrame(resizeVisibleCharts);
});
document.addEventListener('DOMContentLoaded', loadDashboard);
