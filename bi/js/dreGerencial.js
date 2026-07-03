/**
 * DRE Gerencial Contábil — demonstrativo formal + subtabs.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatPct
} from './api.js?v=5.10';
import { buildExplorerModel, renderDreExplorer, resetExplorerState } from './dreExplorer.js?v=5.10';
import { renderPremiumBalancete, renderPremiumCultura } from './drePanels.js?v=5.10';
import { renderDreVisualizacoes } from './dreVisualizacoes.js?v=5.10';

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
        container.innerHTML = '<span class="dre-breadcrumb-item dre-breadcrumb-item--muted">Consolidado · Toda a fazenda · Safra completa</span>';
        return;
    }
    container.innerHTML = `<span class="dre-breadcrumb-item">${filterContext.replace('Recorte atual: ', '')}</span>`;
}

function renderPremiumKpis(container, kpis, onDrill) {
    if (!container) return;
    const items = [
        { label: 'Receita líquida', value: formatCurrencyCompact(kpis.receitaLiq), drill: 'receita-liquida-contabil', tone: 'positive' },
        { label: 'Margem bruta', value: formatCurrencyCompact(kpis.margemBruta), hint: formatPct(kpis.margemBrutaPct), drill: 'margem-bruta-contabil' },
        { label: 'EBITDA', value: formatCurrencyCompact(kpis.ebitda), drill: 'ebitda-contabil', tone: 'positive' },
        { label: 'Resultado líquido', value: formatCurrencyCompact(kpis.resLiq), hint: formatPct(kpis.margemLiqPct), drill: 'resultado-liquido-contabil', tone: kpis.resLiq >= 0 ? 'positive' : 'critical' },
        { label: 'Margem líquida', value: formatPct(kpis.margemLiqPct), drill: 'margem-liquida-contabil' },
        { label: 'R$/ha', value: kpis.resHa ? formatCurrencyCompact(kpis.resHa) : '—', drill: 'resultado-ha-contabil' },
        { label: 'R$/sc', value: kpis.resSc ? formatCurrency(kpis.resSc) : '—', drill: 'resultado-sc-contabil' }
    ];
    container.innerHTML = items.map(it => `
        <div class="dre-kpi-card dre-kpi-card--${it.tone || 'default'} dre-kpi-card--clickable"
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

export function renderDreGerencial({
    store,
    filterState,
    charts,
    setChart,
    onDrill,
    subTab = 'demonstrativo',
    drawChart = false,
    filterContext = '',
    onChartsReady = null
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

    document.querySelectorAll('.dre-segment').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dreSubtab === subTab);
        btn.setAttribute('aria-selected', btn.dataset.dreSubtab === subTab ? 'true' : 'false');
    });
    document.querySelectorAll('.dre-subpanel').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.dreSubpanel !== subTab);
    });

    renderFilterBreadcrumb(document.getElementById('dre-filter-breadcrumb'), filterContext);
    renderPremiumKpis(document.getElementById('kpi-dre-gerencial'), kpis, onDrill);

    const explorerModel = buildExplorerModel(lines, data.dreContabil);
    renderDreExplorer(document.getElementById('dre-explorer'), explorerModel, {
        receitaLiq: kpis.receitaLiq,
        data,
        filterContext,
        onDrill
    });

    renderPremiumBalancete(document.getElementById('dre-balancete'), data.balanceteGerencial, onDrill);
    renderPremiumCultura(document.getElementById('dre-cultura-comp'), data.dreCulturaComp, onDrill);

    const shouldDrawCharts = drawChart && subTab === 'visualizacoes';
    const paintCharts = () => {
        renderDreVisualizacoes({
            lines,
            data,
            charts,
            setChart,
            onDrill,
            drawChart: true
        });
        requestAnimationFrame(() => {
            onChartsReady?.();
            if (shouldDrawCharts) {
                setTimeout(() => onChartsReady?.(), 150);
            }
        });
    };

    if (shouldDrawCharts) {
        requestAnimationFrame(() => requestAnimationFrame(paintCharts));
    } else {
        renderDreVisualizacoes({
            lines,
            data,
            charts,
            setChart,
            onDrill,
            drawChart: false
        });
    }

    const skeleton = document.getElementById('dre-explorer-skeleton');
    if (skeleton) skeleton.classList.add('hidden');
}

export function initDreSubtabs(onChange) {
    document.querySelectorAll('.dre-segment').forEach(btn => {
        btn.addEventListener('click', () => onChange(btn.dataset.dreSubtab));
    });
}

export { aggregateResumo, CONSOLIDADO, resetExplorerState };
