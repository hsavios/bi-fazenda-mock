/**
 * DRE Gerencial Contábil — renderização, filtros locais e insights.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct,
    sumField
} from './api.js?v=5.0';
import { renderInsightCards } from './insights.js?v=5.0';
import { openDrill } from './drilldownRegistry.js?v=5.0';

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

function buildDreTree(contabilRows) {
    const groups = new Map();
    (contabilRows || []).forEach(r => {
        const gKey = r.grupo_dre;
        if (!groups.has(gKey)) {
            groups.set(gKey, {
                grupo: gKey,
                ordem: r.ordem_grupo,
                valor: 0,
                children: new Map()
            });
        }
        const g = groups.get(gKey);
        g.valor += Number(r.valor || 0);
        const sKey = r.subgrupo_dre || r.conta_nome;
        if (!g.children.has(sKey)) {
            g.children.set(sKey, {
                label: sKey,
                ordem: r.ordem_subgrupo,
                valor: 0,
                conta_codigo: r.conta_codigo,
                grupo_dre: r.grupo_dre
            });
        }
        const c = g.children.get(sKey);
        c.valor += Number(r.valor || 0);
        if (!c.conta_codigo) c.conta_codigo = r.conta_codigo;
    });
    return [...groups.values()]
        .sort((a, b) => a.ordem - b.ordem)
        .map(g => ({
            ...g,
            children: [...g.children.values()].sort((a, b) => a.ordem - b.ordem)
        }));
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

function statusClass(val) {
    if (val >= 0) return 'status-pill--ok';
    return 'status-pill--attention';
}

function renderKpiRow(container, kpis, onDrill) {
    if (!container) return;
    const items = [
        { label: 'Receita líquida', value: formatCurrencyCompact(kpis.receitaLiq), drill: 'receita-liquida-contabil', tone: 'positive' },
        { label: 'Margem bruta', value: formatCurrencyCompact(kpis.margemBruta), hint: formatPct(kpis.margemBrutaPct), drill: 'margem-bruta-contabil' },
        { label: 'EBITDA', value: formatCurrencyCompact(kpis.ebitda), drill: 'ebitda-contabil', tone: 'positive' },
        { label: 'Resultado líquido', value: formatCurrencyCompact(kpis.resLiq), hint: formatPct(kpis.margemLiqPct), drill: 'resultado-liquido-contabil', tone: kpis.resLiq >= 0 ? 'positive' : 'critical' },
        { label: 'Margem líquida', value: formatPct(kpis.margemLiqPct), drill: 'margem-liquida-contabil' },
        { label: 'Resultado / ha', value: kpis.resHa ? formatCurrencyCompact(kpis.resHa) : '—', drill: 'resultado-ha-contabil' },
        { label: 'Resultado / sc', value: kpis.resSc ? formatCurrency(kpis.resSc) : '—', drill: 'resultado-sc-contabil' }
    ];
    container.innerHTML = items.map(it => `
        <div class="kpi-card kpi-card--${it.tone || 'default'} kpi-card--clickable"
             data-drill-kpi="${it.drill}" role="button" tabindex="0" aria-label="Detalhar ${it.label}">
            <div class="kpi-label">${it.label}</div>
            <div class="kpi-value">${it.value}</div>
            ${it.hint ? `<div class="kpi-hint">${it.hint}</div>` : ''}
            <span class="kpi-drill-hint" aria-hidden="true">Ver detalhe ↗</span>
        </div>
    `).join('');
    container.querySelectorAll('[data-drill-kpi]').forEach(node => {
        const open = () => onDrill?.('accountingKpi', { kpiId: node.dataset.drillKpi, lines: kpis });
        node.addEventListener('click', open);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

function renderWaterfall(container, lines, onDrill) {
    if (!container || typeof echarts === 'undefined') return;
    const pick = names => names.reduce((s, n) => s + (lines.find(l => l.linha_dre === n)?.valor || 0), 0);
    const receita = pick(['Receita bruta']);
    const ded = pick(['Deduções']);
    const custVar = pick(['Custos variáveis']);
    const custFix = pick(['Custos fixos']);
    const desp = pick(['Despesas comerciais', 'Despesas administrativas']);
    const dep = pick(['Depreciação/amortização']);
    const fin = pick(['Resultado financeiro']);
    const trib = pick(['Tributos']);
    const res = pick(['Resultado líquido gerencial']);

    const steps = [
        { label: 'Receita bruta', value: receita, type: 'add' },
        { label: 'Deduções', value: ded, type: 'subtract' },
        { label: 'Custos var.', value: custVar, type: 'subtract' },
        { label: 'Custos fixos', value: custFix, type: 'subtract' },
        { label: 'Despesas', value: desp, type: 'subtract' },
        { label: 'Depreciação', value: dep, type: 'subtract' },
        { label: 'Financeiro', value: fin, type: fin >= 0 ? 'add' : 'subtract' },
        { label: 'Tributos', value: trib, type: 'subtract' },
        { label: 'Resultado líquido', value: res, type: 'total' }
    ];

    const chart = echarts.getInstanceByDom(container) || echarts.init(container);
    chart.setOption({
        tooltip: {
            trigger: 'item',
            formatter: p => `${p.name}<br>${formatCurrency(p.value)}<br><span style="opacity:.7;font-size:10px">Clique para detalhar</span>`
        },
        grid: { left: 48, right: 16, top: 20, bottom: 36 },
        xAxis: { type: 'category', data: steps.map(s => s.label), axisLabel: { fontSize: 9, rotate: 25 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) } },
        series: [{
            type: 'bar',
            data: steps.map(s => ({
                value: Math.abs(s.value),
                itemStyle: { color: s.value >= 0 ? '#40916c' : '#c1121f' },
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

function renderHierarchy(container, tree, receitaLiq, onDrill) {
    if (!container) return;
    const pct = v => receitaLiq ? formatPct((v / receitaLiq) * 100) : '—';
    const rows = [];
    tree.forEach(g => {
        rows.push(`
            <tr class="dre-tree-group drill-row-clickable" data-dre-group="${g.grupo}" role="button" tabindex="0">
                <td class="cell-name"><strong>${g.grupo}</strong></td>
                <td>${formatCurrencyCompact(g.valor)}</td>
                <td>${pct(g.valor)}</td>
                <td>—</td>
                <td>—</td>
                <td><span class="status-pill ${statusClass(g.valor)}">${g.valor >= 0 ? 'Positivo' : 'Atenção'}</span></td>
                <td class="cell-actions"><span class="row-drill-hint">Ver detalhe</span></td>
            </tr>
        `);
        g.children.forEach(c => {
            rows.push(`
                <tr class="dre-tree-child drill-row-clickable" data-dre-account="${c.conta_codigo}" data-dre-group="${g.grupo}" role="button" tabindex="0">
                    <td class="cell-name dre-indent">${c.label}</td>
                    <td>${formatCurrencyCompact(c.valor)}</td>
                    <td>${pct(c.valor)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td></td>
                    <td></td>
                </tr>
            `);
        });
    });
    container.innerHTML = `
        <table class="compact-table dre-hierarchy-table">
            <thead>
                <tr>
                    <th>Grupo / Conta</th>
                    <th>Valor</th>
                    <th>% Rec. Líq.</th>
                    <th>R$/ha</th>
                    <th>R$/sc</th>
                    <th>Status</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
        </table>
    `;
    container.querySelectorAll('[data-dre-group]').forEach(row => {
        const open = () => onDrill?.('dreGroup', { grupo: row.dataset.dreGroup, conta: row.dataset.dreAccount });
        row.addEventListener('click', open);
        row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

function renderCulturaComp(container, rows, onDrill) {
    if (!container) return;
    const sorted = [...rows].sort((a, b) => Number(b.receita_liquida) - Number(a.receita_liquida));
    container.innerHTML = `
        <table class="compact-table">
            <thead>
                <tr>
                    <th>Cultura</th>
                    <th>Rec. líquida</th>
                    <th>Margem bruta</th>
                    <th>Resultado líq.</th>
                    <th>Margem %</th>
                    <th>R$/ha</th>
                    <th>R$/sc</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(r => `
                    <tr class="drill-row-clickable" data-dre-cultura="${r.cultura_nome}" role="button" tabindex="0">
                        <td class="cell-name">${r.cultura_nome}</td>
                        <td>${formatCurrencyCompact(r.receita_liquida)}</td>
                        <td>${formatCurrencyCompact(r.margem_bruta)}</td>
                        <td>${formatCurrencyCompact(r.resultado_liquido)}</td>
                        <td>${formatPct(r.margem_liquida_pct)}</td>
                        <td>${r.resultado_ha ? formatCurrencyCompact(r.resultado_ha) : '—'}</td>
                        <td>${r.resultado_sc ? formatCurrency(r.resultado_sc) : '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.querySelectorAll('[data-dre-cultura]').forEach(row => {
        const open = () => onDrill?.('cultureDre', { cultura: row.dataset.dreCultura });
        row.addEventListener('click', open);
    });
}

function renderBalancete(container, rows, onDrill) {
    if (!container) return;
    const sorted = [...rows].sort((a, b) => String(a.conta_codigo).localeCompare(String(b.conta_codigo)));
    container.innerHTML = `
        <table class="compact-table">
            <thead>
                <tr>
                    <th>Conta</th>
                    <th>Débitos</th>
                    <th>Créditos</th>
                    <th>Saldo final</th>
                    <th>Grupo DRE</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(r => `
                    <tr class="drill-row-clickable" data-bal-conta="${r.conta_codigo}" role="button" tabindex="0">
                        <td class="cell-name">${r.conta_codigo} · ${r.conta_nome}</td>
                        <td>${formatCurrencyCompact(r.debitos)}</td>
                        <td>${formatCurrencyCompact(r.creditos)}</td>
                        <td>${formatCurrencyCompact(r.saldo_final)}</td>
                        <td>${r.grupo_dre || '—'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.querySelectorAll('[data-bal-conta]').forEach(row => {
        const open = () => onDrill?.('accountingAccount', { conta: row.dataset.balConta });
        row.addEventListener('click', open);
    });
}

export function renderDreGerencial({
    store,
    filterState,
    charts,
    setChart,
    onDrill,
    subTab = 'dre',
    drawChart = false
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

    renderKpiRow(document.getElementById('kpi-dre-gerencial'), kpis, onDrill);
    renderInsightCards(document.getElementById('insights-dre-gerencial'), buildDreContabilInsights(lines, data.dreCulturaComp));

    const tree = buildDreTree(data.dreContabil);
    renderHierarchy(document.getElementById('dre-hierarchy'), tree, kpis.receitaLiq, onDrill);
    renderCulturaComp(document.getElementById('dre-cultura-comp'), data.dreCulturaComp, onDrill);
    renderBalancete(document.getElementById('dre-balancete'), data.balanceteGerencial, onDrill);

    document.querySelectorAll('.dre-subtab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dreSubtab === subTab);
    });
    document.querySelectorAll('.dre-subpanel').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.dreSubpanel !== subTab);
    });

    if (!drawChart) return;
    const wf = document.getElementById('chart-dre-waterfall');
    if (wf) {
        const chart = renderWaterfall(wf, lines, onDrill);
        if (chart) charts['chart-dre-waterfall'] = chart;
    }
}

export function initDreSubtabs(onChange) {
    document.querySelectorAll('.dre-subtab').forEach(btn => {
        btn.addEventListener('click', () => onChange(btn.dataset.dreSubtab));
    });
}

export { aggregateResumo, CONSOLIDADO };
