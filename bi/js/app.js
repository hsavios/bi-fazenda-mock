import {
    fetchView,
    formatNumber,
    formatCurrency,
    formatCurrencyCompact,
    formatPct,
    sumField
} from './api.js?v=5.10';
import {
    aggregateDreByCulture,
    buildExecutiveInsights,
    buildStockPanelInsights,
    renderInsightCards
} from './insights.js?v=5.10';
import {
    buildDecisionQuestions,
    buildCommercialSummary,
    buildCommercialInsights,
    renderDecisionCards,
    renderSelectedQuestionPanel,
    renderCommercialTable
} from './decisionQuestions.js?v=5.10';
import { initDrilldown, closeDrilldown } from './drilldown.js?v=5.10';
import { initDrilldownRegistry, openDrill, registerDrillCoverage } from './drilldownRegistry.js?v=5.10';
import { renderDreGerencial, initDreSubtabs } from './dreGerencial.js?v=5.10';
import { renderCaixaGerencial, initCaixaSubtabs, setupCashMobileSelect } from './caixaGerencial.js?v=5.10';
import { renderOperacoesGerencial, initOperacoesSubtabs, initMaquinasVizAccordion } from './operacoesGerencial.js?v=5.10';
import {
    registerBiChart,
    unregisterBiChart,
    isChartNodeVisible,
    syncChartDomSize,
    resizeVisibleCharts,
    scheduleChartResize,
    installChartDebugGlobals,
    observeChartNode,
    observeChartContainers,
    setupBiChartResizeObserver,
    setupViewportResizeListeners
} from './chartResize.js?v=5.10';
import { aggregateCashByMonth } from './cashFlow.js?v=5.10';
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
} from './charts.js?v=5.10';
import {
    initFilters,
    loadFilterState,
    createEmptyFilterState,
    clearFilterStorage,
    saveFilterState,
    getFilteredStore,
    getFilterContextLabel,
    tabHasPartialFilters,
    isStoreEmptyForTab,
    countActiveFilters
} from './filters.js?v=5.10';

const charts = {};
const chartsReady = new Set();
let decisionCards = [];
let selectedDecisionId = null;
let selectedCashMonthKey = null;
let selectedDreSubTab = 'demonstrativo';
let selectedCaixaSubTab = 'matriz';
let selectedOperacoesSubTab = 'talhoes';
const DEBUG_BI = location.hostname === 'localhost' || location.search.includes('debug=1');
const TABS = ['visao-geral', 'culturas', 'estoques', 'dre-gerencial', 'comercializacao', 'caixa', 'operacoes', 'perguntas', 'sobre'];
const CULTURE_ORDER = ['Café', 'Feijão', 'Milho', 'Soja', 'Sorgo'];

let store = {};
let filterState = loadFilterState();
let filterUI = null;

function getData() {
    return getFilteredStore(store, filterState);
}

function getCurrentTabId() {
    const hash = location.hash.replace('#', '');
    return TABS.includes(hash) ? hash : 'visao-geral';
}

function updateFilterBanners() {
    const tabId = getCurrentTabId();
    const data = getData();
    const emptyEl = el('filter-empty-state');
    const partialEl = el('filter-partial-warning');
    const isEmpty = tabId !== 'sobre' && countActiveFilters(filterState) > 0 && isStoreEmptyForTab(tabId, data);
    emptyEl?.classList.toggle('hidden', !isEmpty);
    partialEl?.classList.toggle('hidden', !tabHasPartialFilters(tabId, filterState));
}

function rerenderDashboard() {
    const data = getData();
    chartsReady.clear();
    renderOverview(data.dre, data.margem, data.custoHa, data.comercial, data.producao, data.insumos, false);
    renderCulturas(data.resultado, data.margem, data.produtividade, data.dre, false);
    renderEstoques(data.insumos, data.producao, false);
    renderDreGerencialTab(false);
    renderComercializacao(false);
    renderCaixaTab(false);
    renderOperacoesTab(false);
    renderPerguntas();
    updateFilterBanners();
    filterUI?.updateChrome(filterState);
    const tabId = getCurrentTabId();
    refreshChartsForTab(tabId);
    scheduleChartResize(resizeVisibleCharts);
}

function el(id) {
    return document.getElementById(id);
}

function initChart(id) {
    const node = el(id);
    if (!node || typeof echarts === 'undefined') return null;
    if (!isChartNodeVisible(node)) return charts[id] || null;

    if (charts[id]) {
        unregisterBiChart(charts[id]);
        charts[id].dispose();
        delete node.__echartsInstance__;
    }
    charts[id] = echarts.init(node);
    node.__echartsInstance__ = charts[id];
    registerBiChart(charts[id]);
    observeChartNode(node);
    return charts[id];
}

function setChart(id, option) {
    const node = el(id);
    if (!node) return null;

    const paint = () => {
        const chart = initChart(id);
        if (chart) {
            chart.setOption(option, true);
            syncChartDomSize(chart);
            scheduleChartResize(resizeVisibleCharts);
        }
    };

    if (!isChartNodeVisible(node)) {
        requestAnimationFrame(() => requestAnimationFrame(paint));
        return charts[id] || null;
    }

    paint();
    return charts[id] || null;
}

function bindChartDrill(chartId, handler, coverage) {
    const chart = charts[chartId];
    if (!chart) return;
    chart.off('click');
    chart.on('click', handler);
    if (coverage) {
        registerDrillCoverage(coverage.section, coverage.element, coverage.type, 'ok');
    }
}

function resizeCharts() {
    scheduleChartResize(resizeVisibleCharts);
}

function setupChartResizeObserver() {
    setupBiChartResizeObserver(resizeVisibleCharts);
    observeChartContainers();
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

function kpiPremium(label, value, hint, tone = '', className = '', fullValue = '', drillKpi = '', drillExtra = {}) {
    const title = fullValue ? ` title="${fullValue.replace(/"/g, '&quot;')}"` : '';
    const toneClass = `kpi-card--${tone || 'default'}`;
    const clickableClass = drillKpi ? ' kpi-card--clickable' : '';
    const drillAttrs = drillKpi
        ? ` data-drill-kpi="${drillKpi}" role="button" tabindex="0" aria-label="Detalhar ${label.replace(/"/g, '&quot;')}"`
        : '';
    const extraAttrs = drillKpi && Object.keys(drillExtra).length
        ? ` data-drill-extra='${JSON.stringify(drillExtra).replace(/'/g, '&#39;')}'`
        : '';
    return `
        <div class="kpi-card ${toneClass}${clickableClass}"${drillAttrs}${extraAttrs}>
            <div class="kpi-label">${label}</div>
            <div class="kpi-value ${className}"${title}>${value}</div>
            ${hint ? `<div class="kpi-hint">${hint}</div>` : ''}
            ${drillKpi ? '<span class="kpi-drill-hint" aria-hidden="true">Ver detalhe ↗</span>' : ''}
        </div>
    `;
}

function renderKpis(containerId, items, coverageSection = '') {
    const container = el(containerId);
    if (!container) return;
    container.innerHTML = items.map(item => {
        if (item.drillKpi) {
            return kpiPremium(
                item.label, item.value, item.hint || '', item.tone || '', item.className || '',
                item.full || '', item.drillKpi, item.drillExtra || {}
            );
        }
        return kpiPremium(item.label, item.value, item.hint || '', item.tone || '', item.className || '', item.full || '');
    }).join('');

    container.querySelectorAll('[data-drill-kpi]').forEach(node => {
        const open = () => {
            let extra = {};
            try {
                extra = JSON.parse(node.dataset.drillExtra || '{}');
            } catch (_) { /* ignore */ }
            openDrill('kpi', { kpiId: node.dataset.drillKpi, ...extra });
        };
        node.addEventListener('click', open);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
        if (coverageSection) {
            registerDrillCoverage(coverageSection, node.dataset.drillKpi, 'kpi', 'ok');
        }
    });
}

function moneyKpi(label, n, hint = '', tone = '', className = '', drillKpi = '', drillExtra = {}) {
    return {
        label,
        value: formatCurrencyCompact(n),
        full: formatCurrency(n),
        hint,
        tone,
        className,
        drillKpi,
        drillExtra
    };
}

/* ─── Drill-down (registry central) ─── */

function openCultureDrilldown(nome) {
    openDrill('culture', { cultura: nome });
}

function openTalhaoDrilldown(talhaoCodigo) {
    openDrill('talhao', { talhaoCodigo });
}

function openStockDrilldown(insumoNome) {
    openDrill('stockItem', { insumo: insumoNome });
}

function openFinancialDrilldown(culturaNome) {
    openDrill('financial', { cultura: culturaNome });
}

function openMachineDrilldown(equipamentoNome) {
    openDrill('machine', { equipamento: equipamentoNome });
}

function registerStaticDrillCoverage() {
    registerDrillCoverage('culturas', 'culture-cards', 'culture', 'ok');
    registerDrillCoverage('estoques', 'ranking-insumos', 'stockItem', 'ok');
    registerDrillCoverage('dre-gerencial', 'dre-explorer', 'dreGroup', 'ok');
    registerDrillCoverage('dre-gerencial', 'dre-balancete', 'accountingAccount', 'ok');
    registerDrillCoverage('dre-gerencial', 'dre-cultura-comp', 'cultureDre', 'ok');
    registerDrillCoverage('comercializacao', 'comercial-table', 'commercialCulture', 'ok');
    registerDrillCoverage('caixa', 'cash-matrix', 'cashMatrixCell', 'ok');
    registerDrillCoverage('caixa', 'cash-movements', 'cashMovement', 'ok');
    registerDrillCoverage('perguntas', 'decision-cards', 'question', 'ok');
    registerDrillCoverage('perguntas', 'selected-question-panel', 'question', 'ok');
}

function bindDrilldownClicks() {
    document.getElementById('culture-cards')?.addEventListener('click', e => {
        const row = e.target.closest('[data-culture]');
        const btn = e.target.closest('[data-analyze]');
        const nome = row?.dataset.culture || btn?.dataset.analyze;
        if (nome) openCultureDrilldown(nome);
    });
    document.getElementById('culture-cards')?.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target.closest('[data-culture]');
        if (!row) return;
        e.preventDefault();
        openCultureDrilldown(row.dataset.culture);
    });

    document.getElementById('ranking-insumos')?.addEventListener('click', e => {
        const row = e.target.closest('[data-insumo]');
        if (row) openStockDrilldown(row.dataset.insumo);
    });
    document.getElementById('ranking-insumos')?.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target.closest('[data-insumo]');
        if (!row) return;
        e.preventDefault();
        openStockDrilldown(row.dataset.insumo);
    });
}

function bindTalhaoChartClick(chartId, talhaoCodes, coverageElement) {
    bindChartDrill(chartId, params => {
        if (params.seriesName === 'Acumulado') {
            openDrill('costConcentration', { talhaoCodes, dataIndex: params.dataIndex });
            return;
        }
        const code = params.name || talhaoCodes[params.dataIndex];
        if (code) openTalhaoDrilldown(code);
    }, {
        section: 'operacoes',
        element: coverageElement || chartId.replace('chart-', ''),
        type: 'talhao'
    });
}

function openDecisionById(id) {
    const card = decisionCards.find(c => c.id === id);
    if (!card) return;
    openDrill('question', { card });
}

function openCommercialCultureDrilldown(cultura) {
    openDrill('commercialCulture', { cultura });
}

function openCashMonthDrilldown(month) {
    openDrill('cashMatrixCell', {
        monthKey: month.monthKey,
        monthLabel: month.monthLabel,
        indicator: 'saldo_mes'
    });
}

function selectDecision(id) {
    if (!decisionCards.find(c => c.id === id)) return;
    selectedDecisionId = id;
    renderDecisionCards(el('decision-cards'), decisionCards, selectedDecisionId);
    renderSelectedQuestionPanel(
        el('selected-question-panel'),
        decisionCards.find(c => c.id === id),
        getData()
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
    const data = getData();
    decisionCards = buildDecisionQuestions(data);
    if (!selectedDecisionId || !decisionCards.find(c => c.id === selectedDecisionId)) {
        selectedDecisionId = decisionCards[0]?.id || null;
    }

    renderDecisionCards(el('decision-cards'), decisionCards, selectedDecisionId);
    renderSelectedQuestionPanel(
        el('selected-question-panel'),
        decisionCards.find(c => c.id === selectedDecisionId),
        data
    );
}

function renderComercializacao(drawChart = false) {
    const data = getData();
    const com = buildCommercialSummary(data.comercial || []);
    const pctEntregue = com.totalContratado
        ? (com.totalEntregue / com.totalContratado) * 100
        : 0;

    renderKpis('kpi-comercial', [
        { label: 'Volume contratado', value: formatNumber(com.totalContratado, 0) + ' sc', hint: '', drillKpi: 'contratado' },
        { label: 'Volume entregue', value: formatNumber(com.totalEntregue, 0) + ' sc', hint: '', tone: 'positive', drillKpi: 'entregue' },
        { label: 'Saldo a entregar', value: formatNumber(com.totalPendente, 0) + ' sc', hint: '', tone: com.totalPendente > 0 ? 'warn' : 'positive', drillKpi: 'saldo-entregar' },
        { label: '% entregue', value: formatPct(pctEntregue), hint: '', drillKpi: 'pct-entregue' },
        moneyKpi('Valor contratado', com.totalValor, 'Soma por cultura na safra demonstrativa', '', '', 'valor-contratado')
    ], 'comercializacao');

    renderInsightCards(el('insights-comercial'), buildCommercialInsights(com));
    renderCommercialTable(el('comercial-table'), data.comercial, openCommercialCultureDrilldown);

    if (!drawChart) return;

    const rows = com.rows.filter(r => Number(r.volume_contratado_sc) > 0);
    if (!rows.length) return;

    const cats = rows.map(r => r.cultura_nome);
    setChart('chart-comercial-stack', stackedBarOption(cats, [
        { name: 'Entregue', data: cats.map(n => rows.find(r => r.cultura_nome === n)?.volume_entregue_sc || 0) },
        { name: 'Saldo a entregar', data: cats.map(n => rows.find(r => r.cultura_nome === n)?.volume_pendente_sc || 0) }
    ]));
    bindChartDrill('chart-comercial-stack', params => {
        if (params.name) openCommercialCultureDrilldown(params.name);
    }, { section: 'comercializacao', element: 'chart-stack', type: 'commercialCulture' });

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
        bindChartDrill('chart-comercial-ranking', params => {
            if (params.name) openCommercialCultureDrilldown(params.name);
        }, { section: 'comercializacao', element: 'chart-ranking', type: 'commercialCulture' });
    }
}

function renderCaixaTab(drawChart = false) {
    const data = getData();
    const months = aggregateCashByMonth(data.fluxo);
    if (!selectedCashMonthKey && months.length) selectedCashMonthKey = months[0].monthKey;

    setupCashMobileSelect(months, selectedCashMonthKey, key => {
        selectedCashMonthKey = key;
        renderCaixaGerencial({
            store: data,
            charts,
            setChart,
            onDrill: openDrill,
            subTab: selectedCaixaSubTab,
            drawChart: false,
            filterContext: getFilterContextLabel(filterState),
            selectedMonthKey: selectedCashMonthKey
        });
    });

    renderCaixaGerencial({
        store: data,
        charts,
        setChart,
        onDrill: openDrill,
        subTab: selectedCaixaSubTab,
        drawChart,
        filterContext: getFilterContextLabel(filterState),
        selectedMonthKey: selectedCashMonthKey,
        onChartsReady: () => {
            scheduleChartResize(resizeVisibleCharts);
            setTimeout(() => scheduleChartResize(resizeVisibleCharts), 150);
        }
    });
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
        moneyKpi('Receita total', receitaTotal, 'Faturamento bruto consolidado', 'positive', '', 'receita-total'),
        moneyKpi('Custo total', custoTotal, 'Variáveis + fixos da safra', 'warn', '', 'custo-total'),
        moneyKpi('Resultado', resultado, resultado >= 0 ? 'Margem saudável na operação simulada' : 'Resultado negativo — atenção', resultadoSt.tone, resultado >= 0 ? 'kpi-value--positive' : 'kpi-value--negative', 'resultado'),
        { label: 'Margem líquida', value: formatPct(margemPct), hint: resultadoSt.label, tone: resultadoSt.tone, drillKpi: 'margem' },
        { label: 'Área total', value: formatNumber(areaTotal, 0) + ' ha', hint: `${formatNumber(comercial.length || byCulture.length)} culturas` },
        moneyKpi('Estoque insumos', estoqueValor, formatNumber(estoqueSc, 0) + ' sc de produção armazenada', '', '', 'estoque-insumos')
    ], 'visao-geral');

    renderInsightCards(el('insights-overview'), buildExecutiveInsights(getData()));

    if (!drawChart) return;

    setChart('chart-waterfall-exec', waterfallOption([
        { label: 'Receita bruta', value: receitaTotal, type: 'add' },
        { label: 'Custos var.', value: -custoVar, type: 'subtract' },
        { label: 'Custos fixos', value: -custoFix, type: 'subtract' },
        { label: 'Resultado', value: resultado, type: 'total' }
    ]));
    bindChartDrill('chart-waterfall-exec', params => {
        const label = params.name || params.seriesName;
        if (label) openDrill('waterfallStep', { label });
    }, { section: 'visao-geral', element: 'waterfall-exec', type: 'waterfallStep' });

    const treemapSource = sortCultures(byCulture.map(c => c.cultura_nome)).map(name => {
        const c = byCulture.find(r => r.cultura_nome === name);
        const val = Number(c.resultado) > 0 ? Number(c.resultado) : Number(c.receita_bruta);
        return { name, value: val, pct: pctShare(val, resultado > 0 ? resultado : receitaTotal) };
    }).filter(i => i.value > 0);

    if (treemapSource.length) {
        setChart('chart-treemap-cultura', treemapOption(treemapSource));
        bindChartDrill('chart-treemap-cultura', params => {
            if (params.name) openCultureDrilldown(params.name);
        }, { section: 'visao-geral', element: 'treemap-cultura', type: 'culture' });
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
                <tr data-culture="${nome}" class="drill-row-clickable" role="button" tabindex="0" aria-label="Detalhar cultura ${nome}">
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
        bindChartDrill('chart-scatter-cultura', params => {
            const nome = params.data?.name || params.name;
            if (nome) openCultureDrilldown(nome);
        }, { section: 'culturas', element: 'scatter', type: 'culture' });
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
    bindChartDrill('chart-margem-cultura', params => {
        if (params.name) openCultureDrilldown(params.name);
    }, { section: 'culturas', element: 'ranking-margem', type: 'culture' });
}

/* ─── Estoques ─── */

function renderEstoques(insumos, producao, drawChart = false) {
    const valorInsumos = sumField(insumos, 'valor_estoque');
    const volumeProd = sumField(producao, 'quantidade_atual_sc');
    const topInsumo = [...insumos].sort((a, b) => Number(b.valor_estoque) - Number(a.valor_estoque))[0];

    renderKpis('kpi-estoques', [
        { label: 'Produção armazenada', value: formatNumber(volumeProd, 0) + ' sc', hint: 'Grãos e café em estoque', drillKpi: 'producao-armazenada' },
        moneyKpi('Valor produção est.', volumeProd * 85, 'Estimativa ilustrativa', 'positive', '', 'valor-producao'),
        moneyKpi('Valor insumos', valorInsumos, `${insumos.length} itens monitorados`, '', '', 'valor-insumos'),
        {
            label: 'Item crítico',
            value: topInsumo?.insumo_nome?.slice(0, 18) || '—',
            hint: topInsumo ? formatCurrencyCompact(topInsumo.valor_estoque) : '',
            tone: 'warn',
            drillKpi: topInsumo ? 'item-critico' : '',
            drillExtra: topInsumo ? { insumo: topInsumo.insumo_nome } : {}
        }
    ], 'estoques');

    renderInsightCards(el('insights-estoques'), buildStockPanelInsights(getData()));

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
            <div class="ranking-row drill-row-clickable" data-insumo="${item.insumo_nome}" role="button" tabindex="0" aria-label="Detalhar ${item.insumo_nome}">
                <span class="ranking-pos">${i + 1}</span>
                <div class="ranking-info">
                    <div class="ranking-name">${item.insumo_nome}</div>
                    <div class="ranking-meta">${item.categoria} · ${formatNumber(item.quantidade_atual, 1)} ${item.unidade || ''} · <span class="row-drill-hint">Ver detalhe</span></div>
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
        bindChartDrill('chart-estoque-prod', params => {
            if (params.name) openDrill('stockProduction', { cultura: params.name });
        }, { section: 'estoques', element: 'chart-estoque-prod', type: 'stockProduction' });
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
        bindChartDrill('chart-treemap-insumos', params => {
            if (params.name) openStockDrilldown(params.name);
        }, { section: 'estoques', element: 'treemap-insumos', type: 'stockItem' });
    }
}

/* ─── DRE Gerencial ─── */

function renderDreGerencialTab(drawChart = false) {
    renderDreGerencial({
        store: getData(),
        filterState,
        charts,
        setChart,
        onDrill: (type, context) => openDrill(type, context),
        subTab: selectedDreSubTab,
        drawChart,
        filterContext: getFilterContextLabel(filterState),
        onChartsReady: () => {
            scheduleChartResize(resizeVisibleCharts);
            setTimeout(() => scheduleChartResize(resizeVisibleCharts), 150);
        }
    });
}

/* ─── Operações ─── */

function renderOperacoesTab(drawChart = false) {
    renderOperacoesGerencial({
        store: getData(),
        charts,
        setChart,
        onDrill: openDrill,
        subTab: selectedOperacoesSubTab,
        drawChart,
        filterContext: getFilterContextLabel(filterState),
        onChartsReady: () => {
            scheduleChartResize(resizeVisibleCharts);
            observeChartContainers();
        }
    });
    observeChartContainers();
}

/* ─── Tab / load ─── */

function refreshChartsForTab(tabId) {
    if (chartsReady.has(tabId)) {
        scheduleChartResize(resizeVisibleCharts);
        return;
    }
    try {
        switch (tabId) {
            case 'visao-geral': {
                const data = getData();
                renderOverview(data.dre, data.margem, data.custoHa, data.comercial, data.producao, data.insumos, true);
                break;
            }
            case 'culturas': {
                const data = getData();
                renderCulturas(data.resultado, data.margem, data.produtividade, data.dre, true);
                break;
            }
            case 'estoques': {
                const data = getData();
                renderEstoques(data.insumos, data.producao, true);
                break;
            }
            case 'dre-gerencial':
                renderDreGerencialTab(selectedDreSubTab === 'visualizacoes');
                break;
            case 'comercializacao':
                renderComercializacao(true);
                break;
            case 'caixa':
                renderCaixaTab(selectedCaixaSubTab === 'visualizacoes');
                break;
            case 'operacoes': {
                const maqOpen = document.getElementById('field-maquinas-viz-accordion')?.open;
                renderOperacoesTab(selectedOperacoesSubTab === 'visualizacoes' || (selectedOperacoesSubTab === 'maquinas' && maqOpen));
                break;
            }
            case 'perguntas':
                renderPerguntas();
                break;
            default:
                break;
        }
        chartsReady.add(tabId);
        observeChartContainers();
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
    updateFilterBanners();
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
        ['dreDrilldown', () => fetchView('vw_dre_conta_drilldown', { limit: '300' })],
        ['dreResumo', () => fetchView('vw_dre_gerencial_resumo', { limit: '500' })],
        ['dreContabil', () => fetchView('vw_dre_gerencial_contabil', { limit: '500' })],
        ['dreCulturaComp', () => fetchView('vw_dre_cultura_comparativo', { limit: '50' })],
        ['balanceteGerencial', () => fetchView('vw_balancete_gerencial', { limit: '500' })],
        ['kpisContabeis', () => fetchView('vw_kpis_contabeis', { limit: '100' })],
        ['dre', () => fetchView('vw_dre_gerencial')],
        ['margem', () => fetchView('vw_margem_bruta_cultura')],
        ['resultado', () => fetchView('vw_resultado_gerencial_cultura')],
        ['custoHa', () => fetchView('vw_custo_hectare_cultura_safra')],
        ['comercial', () => fetchView('vw_comercializacao_cultura')],
        ['produtividade', () => fetchView('vw_produtividade_talhao', { limit: '200' })],
        ['insumos', () => fetchView('vw_estoque_insumos_atual')],
        ['producao', () => fetchView('vw_estoque_producao_atual', { limit: '20' })],
        ['fluxo', () => fetchView('vw_fluxo_caixa_realizado', { order: 'data_movimento', limit: '40' })],
        ['talhoes', () => fetchView('vw_resultado_talhao', { order: 'custo_total.desc', limit: '200' })],
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

        filterUI = initFilters({
            getStore: () => store,
            getFilterState: () => filterState,
            setFilterState: state => { filterState = state; },
            onApply: () => {
                closeDrilldown();
                rerenderDashboard();
            },
            onClear: () => {
                closeDrilldown();
                filterState = createEmptyFilterState();
                clearFilterStorage();
                rerenderDashboard();
            },
            getActiveTab: getCurrentTabId,
            switchTab,
            onPanelOpen: () => scheduleChartResize(resizeVisibleCharts),
            onPanelClose: () => scheduleChartResize(resizeVisibleCharts)
        });

        document.getElementById('filter-clear-inline')?.addEventListener('click', () => {
            filterState = createEmptyFilterState();
            clearFilterStorage();
            filterUI?.updateChrome(filterState);
            closeDrilldown();
            rerenderDashboard();
            filterUI?.showToast('Filtros limpos');
        });

        rerenderDashboard();

        showDashboard();
        initDrilldownRegistry({
            getData,
            getFilterContext: () => getFilterContextLabel(filterState)
        });
        initDrilldown(() => {
            scheduleChartResize(resizeVisibleCharts);
        });
        installChartDebugGlobals();
        registerStaticDrillCoverage();
        bindDrilldownClicks();
        bindDecisionClicks();
        initDreSubtabs(tab => {
            selectedDreSubTab = tab;
            const onDreTab = getCurrentTabId() === 'dre-gerencial';
            renderDreGerencialTab(tab === 'visualizacoes');
            if (onDreTab) scheduleChartResize(resizeVisibleCharts);
        });
        initCaixaSubtabs(tab => {
            selectedCaixaSubTab = tab;
            const onCaixaTab = getCurrentTabId() === 'caixa';
            renderCaixaTab(tab === 'visualizacoes');
            if (onCaixaTab) scheduleChartResize(resizeVisibleCharts);
        });
        initOperacoesSubtabs(tab => {
            selectedOperacoesSubTab = tab;
            const onOpTab = getCurrentTabId() === 'operacoes';
            const maqOpen = document.getElementById('field-maquinas-viz-accordion')?.open;
            const needsCharts = tab === 'visualizacoes' || (tab === 'maquinas' && maqOpen);
            renderOperacoesTab(needsCharts);
            if (onOpTab) scheduleChartResize(resizeVisibleCharts);
        });
        initMaquinasVizAccordion(() => {
            if (getCurrentTabId() === 'operacoes' && selectedOperacoesSubTab === 'maquinas') {
                renderOperacoesTab(true);
                scheduleChartResize(resizeVisibleCharts);
                setTimeout(() => scheduleChartResize(resizeVisibleCharts), 150);
                setTimeout(() => scheduleChartResize(resizeVisibleCharts), 300);
            }
        });
        setupChartResizeObserver();
        setupViewportResizeListeners(resizeVisibleCharts);
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
    scheduleChartResize(resizeVisibleCharts);
});
document.addEventListener('DOMContentLoaded', loadDashboard);
