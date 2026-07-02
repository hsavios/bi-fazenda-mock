/**
 * DRE Gerencial Contábil — orquestração premium (explorer, KPIs, subtabs).
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatPct
} from './api.js?v=5.2';
import { renderInsightCards } from './insights.js?v=5.2';
import { buildExplorerModel, renderDreExplorer, resetExplorerState } from './dreExplorer.js?v=5.2';
import { renderPremiumBalancete, renderPremiumCultura } from './drePanels.js?v=5.2';

const CONSOLIDADO = 'Consolidado';

export function filterDreData(store, filterState) {
    const match = rows => (rows || []).filter(r => {
        if (filterState.safra && r.safra_codigo && r.safra_codigo !== filterState.safra) return false;
        if (filterState.culturas?.length && r.cultura_nome && r.cultura_nome !== CONSOLIDADO
            && !filterState.culturas.includes(r.cultura_nome)) return false;
        if (filterState.meses?.length && r.ano != null && r.mes != null) {
            const key = `${r.ano}-${String(r.mes).padStart(2, '0')}`;
            if (!filterState.meses.includes(key)) return false;
        }
        return true;
    });
    return {
        dreResumo: match(store.dreResumo),
        dreContabil: match(store.dreContabil),
        dreCulturaComp: match(store.dreCulturaComp),
        balanceteGerencial: match(store.balanceteGerencial),
        kpisContabeis: match(store.kpisContabeis),
        dreDrilldown: store.dreDrilldown || []
    };
}

function aggregateResumo(rows, cultura = CONSOLIDADO) {
    const filtered = rows.filter(r => (r.cultura_nome || CONSOLIDADO) === cultura);
    const map = new Map();
    filtered.forEach(r => {
        map.set(r.linha_dre, (map.get(r.linha_dre) || 0) + Number(r.valor || 0));
    });
    const order = [
        'Receita bruta', 'Deduções', 'Receita líquida', 'Custos variáveis', 'Margem bruta',
        'Custos fixos', 'Resultado atividade agrícola', 'Despesas comerciais', 'Despesas administrativas',
        'EBITDA', 'Depreciação/amortização', 'Resultado operacional', 'Resultado financeiro',
        'Resultado antes impostos', 'Tributos', 'Resultado líquido gerencial'
    ];
    return order.map((linha, i) => ({
        linha_dre: linha,
        ordem: (i + 1) * 10,
        valor: map.get(linha) || 0
    }));
}

function kpiFromResumo(lines) {
    const get = name => lines.find(l => l.linha_dre === name)?.valor || 0;
    const receitaLiq = get('Receita líquida');
    const margemBruta = get('Margem bruta');
    const ebitda = get('EBITDA');
    const resLiq = get('Resultado líquido gerencial');
    return {
        receitaLiq,
        margemBruta,
        ebitda,
        resLiq,
        margemBrutaPct: receitaLiq ? (margemBruta / receitaLiq) * 100 : 0,
        margemLiqPct: receitaLiq ? (resLiq / receitaLiq) * 100 : 0,
        resHa: 0,
        resSc: 0
    };
}

export function buildDreContabilInsights(lines, culturaComp) {
    const get = name => lines.find(l => l.linha_dre === name)?.valor || 0;
    const receitaLiq = get('Receita líquida');
    const custosVar = Math.abs(get('Custos variáveis'));
    const resLiq = get('Resultado líquido gerencial');
    const dep = Math.abs(get('Depreciação/amortização'));
    const despCom = Math.abs(get('Despesas comerciais'));
    const insights = [];

    if (receitaLiq > 0) {
        insights.push({
            title: 'Margem líquida gerencial',
            text: `O resultado líquido contábil representa ${formatPct((resLiq / receitaLiq) * 100)} da receita líquida no recorte.`,
            tone: resLiq >= 0 ? 'positive' : 'critical'
        });
    }
    if (custosVar > 0 && receitaLiq > 0) {
        insights.push({
            title: 'Peso dos custos variáveis',
            text: `Custos variáveis (CPV) correspondem a ${formatPct((custosVar / receitaLiq) * 100)} da receita líquida.`,
            tone: 'info'
        });
    }
    const top = [...(culturaComp || [])].sort((a, b) => Number(b.receita_liquida) - Number(a.receita_liquida))[0];
    if (top) {
        insights.push({
            title: 'Concentração por cultura',
            text: `${top.cultura_nome} lidera a receita líquida contábil com ${formatCurrencyCompact(top.receita_liquida)}.`,
            tone: 'positive'
        });
    }
    if (dep > 0) {
        insights.push({
            title: 'Depreciação',
            text: `Depreciação e amortização impactam o resultado operacional em ${formatCurrencyCompact(dep)} no período filtrado.`,
            tone: 'warn'
        });
    }
    if (despCom > 0 && receitaLiq > 0) {
        insights.push({
            title: 'Despesas comerciais',
            text: `Despesas comerciais reduzem a margem em ${formatPct((despCom / receitaLiq) * 100)} pontos percentuais sobre a receita líquida.`,
            tone: 'warn'
        });
    }
    return insights.slice(0, 4);
}

function renderFilterBreadcrumb(container, filterContext) {
    if (!container) return;
    if (!filterContext) {
        container.innerHTML = '<span class="dre-breadcrumb-item dre-breadcrumb-item--muted">Consolidado · Toda a fazenda</span>';
        return;
    }
    container.innerHTML = `<span class="dre-breadcrumb-item">${filterContext.replace('Recorte atual: ', '')}</span>`;
}

function renderPremiumKpis(container, kpis, onDrill) {
    if (!container) return;
    const items = [
        { label: 'Receita líquida', value: formatCurrencyCompact(kpis.receitaLiq), drill: 'receita-liquida-contabil', tone: 'positive', icon: '↗' },
        { label: 'Margem bruta', value: formatCurrencyCompact(kpis.margemBruta), hint: formatPct(kpis.margemBrutaPct), drill: 'margem-bruta-contabil', tone: 'default' },
        { label: 'EBITDA', value: formatCurrencyCompact(kpis.ebitda), drill: 'ebitda-contabil', tone: 'positive' },
        { label: 'Resultado líquido', value: formatCurrencyCompact(kpis.resLiq), hint: formatPct(kpis.margemLiqPct), drill: 'resultado-liquido-contabil', tone: kpis.resLiq >= 0 ? 'positive' : 'critical' },
        { label: 'Margem líquida', value: formatPct(kpis.margemLiqPct), drill: 'margem-liquida-contabil', tone: 'default' },
        { label: 'R$/ha', value: kpis.resHa ? formatCurrencyCompact(kpis.resHa) : '—', drill: 'resultado-ha-contabil', tone: 'default' },
        { label: 'R$/sc', value: kpis.resSc ? formatCurrency(kpis.resSc) : '—', drill: 'resultado-sc-contabil', tone: 'default' }
    ];
    container.innerHTML = items.map(it => `
        <div class="dre-kpi-card dre-kpi-card--${it.tone} dre-kpi-card--clickable"
             data-drill-kpi="${it.drill}" role="button" tabindex="0" aria-label="Detalhar ${it.label}">
            <span class="dre-kpi-label">${it.label}</span>
            <span class="dre-kpi-value">${it.value}</span>
            ${it.hint ? `<span class="dre-kpi-hint">${it.hint}</span>` : ''}
        </div>
    `).join('');
    container.querySelectorAll('[data-drill-kpi]').forEach(node => {
        const open = () => onDrill?.('accountingKpi', { kpiId: node.dataset.drillKpi });
        node.addEventListener('click', open);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

function renderWaterfall(container, lines, onDrill) {
    if (!container || typeof echarts === 'undefined') return;
    const pick = names => names.reduce((s, n) => s + (lines.find(l => l.linha_dre === n)?.valor || 0), 0);
    const steps = [
        { label: 'Receita bruta', value: pick(['Receita bruta']) },
        { label: 'Deduções', value: pick(['Deduções']) },
        { label: 'Custos var.', value: pick(['Custos variáveis']) },
        { label: 'Custos fixos', value: pick(['Custos fixos']) },
        { label: 'Despesas', value: pick(['Despesas comerciais', 'Despesas administrativas']) },
        { label: 'Depreciação', value: pick(['Depreciação/amortização']) },
        { label: 'Financeiro', value: pick(['Resultado financeiro']) },
        { label: 'Tributos', value: pick(['Tributos']) },
        { label: 'Resultado líquido', value: pick(['Resultado líquido gerencial']) }
    ];

    const chart = echarts.getInstanceByDom(container) || echarts.init(container);
    chart.setOption({
        tooltip: {
            trigger: 'item',
            formatter: p => `${p.name}<br>${formatCurrency(p.value)}<br><span style="opacity:.7;font-size:10px">Clique para detalhar</span>`
        },
        grid: { left: 48, right: 16, top: 16, bottom: 40 },
        xAxis: { type: 'category', data: steps.map(s => s.label), axisLabel: { fontSize: 9, rotate: 22, color: '#5a6b5e' } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v), color: '#5a6b5e' }, splitLine: { lineStyle: { color: '#e8efe9' } } },
        series: [{
            type: 'bar',
            barMaxWidth: 36,
            data: steps.map(s => ({
                value: Math.abs(s.value),
                itemStyle: {
                    color: s.value >= 0 ? '#2d6a4f' : '#c1121f',
                    borderRadius: [4, 4, 0, 0]
                },
                raw: s.value,
                label: s.label
            }))
        }]
    }, true);
    chart.off('click');
    chart.on('click', p => {
        if (p.name) onDrill?.('dreLine', { label: p.name, linha: p.name });
    });
    return chart;
}

export function renderDreGerencial({
    store,
    filterState,
    charts,
    setChart,
    onDrill,
    subTab = 'dre',
    drawChart = false,
    filterContext = ''
}) {
    const data = filterDreData(store, filterState);
    const lines = aggregateResumo(data.dreResumo, CONSOLIDADO);
    const kpis = kpiFromResumo(lines);
    const kpiRows = data.kpisContabeis || [];
    if (kpiRows.length) {
        const k = kpiRows[kpiRows.length - 1];
        kpis.resHa = Number(k.resultado_por_ha || 0);
        kpis.resSc = Number(k.resultado_por_sc || 0);
    }

    renderFilterBreadcrumb(document.getElementById('dre-filter-breadcrumb'), filterContext);
    renderPremiumKpis(document.getElementById('kpi-dre-gerencial'), kpis, onDrill);
    renderInsightCards(document.getElementById('insights-dre-gerencial'), buildDreContabilInsights(lines, data.dreCulturaComp));

    const explorerModel = buildExplorerModel(lines, data.dreContabil);
    const explorerCtx = {
        receitaLiq: kpis.receitaLiq,
        data,
        filterContext,
        onDrill
    };
    renderDreExplorer(document.getElementById('dre-explorer'), explorerModel, explorerCtx);

    renderPremiumBalancete(document.getElementById('dre-balancete'), data.balanceteGerencial, onDrill);
    renderPremiumCultura(document.getElementById('dre-cultura-comp'), data.dreCulturaComp, onDrill);

    document.querySelectorAll('.dre-segment').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dreSubtab === subTab);
        btn.setAttribute('aria-selected', btn.dataset.dreSubtab === subTab ? 'true' : 'false');
    });
    document.querySelectorAll('.dre-subpanel').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.dreSubpanel !== subTab);
    });

    const skeleton = document.getElementById('dre-explorer-skeleton');
    if (skeleton) skeleton.classList.add('hidden');

    if (!drawChart) return;
    const wf = document.getElementById('chart-dre-waterfall');
    if (wf) {
        const chart = renderWaterfall(wf, lines, onDrill);
        if (chart) charts['chart-dre-waterfall'] = chart;
    }
}

export function initDreSubtabs(onChange) {
    document.querySelectorAll('.dre-segment').forEach(btn => {
        btn.addEventListener('click', () => onChange(btn.dataset.dreSubtab));
    });
}

export function showDreLoading() {
    const sk = document.getElementById('dre-explorer-skeleton');
    const ex = document.getElementById('dre-explorer');
    if (sk) sk.classList.remove('hidden');
    if (ex) ex.innerHTML = '';
}

export { aggregateResumo, CONSOLIDADO, resetExplorerState };
