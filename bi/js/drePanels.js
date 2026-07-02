/**
 * Painéis contextuais da DRE — drawer enriquecido e modo zoom analítico.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatPct,
    formatNumber
} from './api.js?v=5.3.1';
import { openDrilldown } from './drilldown.js?v=5.3.1';
import { horizontalBarOption } from './charts.js?v=5.3.1';

const LINHA_GRUPO_ORDEM = {
    'Receita bruta': 10,
    'Deduções': 20,
    'Custos variáveis': 40,
    'Custos fixos': 60,
    'Despesas comerciais': 80,
    'Despesas administrativas': 90,
    'Depreciação/amortização': 110,
    'Resultado financeiro': 120,
    'Tributos': 140
};

let zoomEl = null;
let zoomChart = null;

function pctRecLiq(val, receitaLiq) {
    if (!receitaLiq) return '—';
    return formatPct((val / receitaLiq) * 100);
}

function buildInsight(node, receitaLiq) {
    const v = Number(node.valor || 0);
    const pct = receitaLiq ? (Math.abs(v) / receitaLiq) * 100 : 0;
    const tone = v >= 0 ? 'positive' : 'warn';
    let text = '';
    if (node.type === 'account') {
        text = `A conta ${node.conta_codigo} · ${node.conta_nome || node.label} impacta a DRE em ${formatCurrencyCompact(v)} no recorte filtrado.`;
    } else if (node.type === 'group') {
        text = `O grupo "${node.label}" concentra ${formatCurrencyCompact(v)} (${formatPct(pct)} da receita líquida) em contas analíticas do razão demonstrativo.`;
    } else if (node.isCalc) {
        text = `"${node.label}" é linha sintética calculada a partir das demais linhas da DRE gerencial.`;
    } else {
        text = `"${node.label}" totaliza ${formatCurrencyCompact(v)} (${formatPct(pct)} da receita líquida) no período.`;
    }
    return {
        title: 'Leitura gerencial',
        text,
        tone: node.isTotal && v < 0 ? 'critical' : tone
    };
}

function nextAction(node) {
    if (node.type === 'account') {
        return 'Revise os lançamentos contábeis vinculados e confronte com o balancete gerencial.';
    }
    if (node.type === 'group') {
        return 'Use o modo zoom para comparar composição por conta, cultura e centro de custo.';
    }
    if (node.isCalc) {
        return 'Expanda as linhas componentes para investigar os drivers deste subtotal.';
    }
    return 'Compare culturas e centros de custo para identificar concentrações.';
}

function cultureBreakdown(node, data) {
    const culturaComp = data.dreCulturaComp || [];
    if (!culturaComp.length) return [];

    const fieldMap = {
        'Receita bruta': 'receita_bruta',
        'Receita líquida': 'receita_liquida',
        'Margem bruta': 'margem_bruta',
        'EBITDA': 'ebitda',
        'Resultado líquido gerencial': 'resultado_liquido'
    };
    const field = fieldMap[node.linha_dre];
    if (field) {
        return culturaComp
            .map(c => ({ label: c.cultura_nome, value: Number(c[field] || 0) }))
            .filter(r => r.value !== 0)
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    }

    if (node.type === 'group' || node.type === 'account') {
        const rows = (data.dreContabil || []).filter(r => {
            if (node.type === 'group') return r.grupo_dre === node.grupo_dre || r.grupo_dre === node.label;
            return r.conta_codigo === node.conta_codigo;
        });
        const byCult = new Map();
        rows.forEach(r => {
            const c = r.cultura_nome || 'Sem cultura';
            byCult.set(c, (byCult.get(c) || 0) + Number(r.valor || 0));
        });
        return [...byCult.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    }
    return [];
}

function centroBreakdown(node, data) {
    const rows = (data.dreContabil || []).filter(r => {
        if (node.type === 'account') return r.conta_codigo === node.conta_codigo;
        if (node.type === 'group') return r.grupo_dre === (node.grupo_dre || node.label);
        const og = node.ordem_grupo;
        return og ? Number(r.ordem_grupo) === og : false;
    });
    const byCc = new Map();
    rows.forEach(r => {
        const c = r.centro_custo_nome || 'Sem centro';
        byCc.set(c, (byCc.get(c) || 0) + Number(r.valor || 0));
    });
    return [...byCc.entries()]
        .map(([label, value]) => ({ label, value: formatCurrencyCompact(value) }))
        .slice(0, 6);
}

function entriesForNode(node, data) {
    let rows;
    if (node.type === 'account') {
        rows = (data.dreDrilldown || []).filter(r => r.conta_codigo === node.conta_codigo);
    } else if (node.type === 'group') {
        rows = (data.dreDrilldown || []).filter(r => r.grupo_dre === (node.grupo_dre || node.label));
    } else {
        const og = LINHA_GRUPO_ORDEM[node.linha_dre];
        const grupos = new Set(
            (data.dreContabil || [])
                .filter(r => og && Number(r.ordem_grupo) === og)
                .map(r => r.grupo_dre)
        );
        rows = (data.dreDrilldown || []).filter(r => grupos.has(r.grupo_dre));
    }
    rows = rows.slice(0, 8);
    return rows.map(e => ({
        label: e.data_lancamento || '—',
        value: formatCurrencyCompact(e.valor_dre),
        meta: (e.historico || e.documento_origem || '').slice(0, 55)
    }));
}

function accountsForNode(node, data) {
    const rows = (data.dreContabil || []).filter(r => {
        if (node.type === 'group') return r.grupo_dre === (node.grupo_dre || node.label);
        const og = LINHA_GRUPO_ORDEM[node.linha_dre];
        return og ? Number(r.ordem_grupo) === og : false;
    });
    const byAcc = new Map();
    rows.forEach(r => {
        const k = r.conta_codigo;
        if (!byAcc.has(k)) byAcc.set(k, { label: `${k} · ${r.conta_nome}`, value: 0 });
        byAcc.get(k).value += Number(r.valor || 0);
    });
    return [...byAcc.values()]
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .map(r => ({ label: r.label.split(' · ').pop() || r.label, value: r.value }));
}

function periodEvolution(node, data) {
    const rows = (data.dreContabil || []).filter(r => {
        if (node.type === 'account') return r.conta_codigo === node.conta_codigo;
        if (node.type === 'group') return r.grupo_dre === (node.grupo_dre || node.label);
        return false;
    });
    const byPeriod = new Map();
    rows.forEach(r => {
        const k = r.periodo_label || `${r.mes}/${r.ano}`;
        byPeriod.set(k, (byPeriod.get(k) || 0) + Number(r.valor || 0));
    });
    return [...byPeriod.entries()]
        .map(([label, value]) => ({ label, value: Math.abs(value) }))
        .slice(0, 8);
}

function initPanelChart(chartId, items) {
    if (typeof echarts === 'undefined' || !items.length) return;
    const el = document.getElementById(chartId);
    if (!el) return;
    const chart = echarts.getInstanceByDom(el) || echarts.init(el);
    chart.setOption(horizontalBarOption(
        items.map(i => i.label),
        items.map(i => Math.abs(i.value)),
        { color: '#40916c', formatter: v => formatCurrencyCompact(v) }
    ), true);
    return chart;
}

function buildPanelHtml(node, data, receitaLiq) {
    const cult = cultureBreakdown(node, data);
    const centros = centroBreakdown(node, data);
    const entries = entriesForNode(node, data);
    const accounts = node.type === 'synthetic' ? accountsForNode(node, data) : [];
    const chartId = `dre-panel-chart-${Date.now()}`;
    const chartItems = cult.length ? cult : accounts;

    return {
        html: `
            <div class="dre-panel-hero">
                <span class="dre-panel-hero-value">${formatCurrency(node.valor)}</span>
                <span class="dre-panel-hero-pct">${pctRecLiq(node.valor, receitaLiq)} da receita líquida</span>
            </div>
            <div class="dre-panel-kpis">
                <div class="dre-panel-kpi"><span>R$/ha</span><strong>${node.valor_ha ? formatCurrencyCompact(node.valor_ha) : '—'}</strong></div>
                <div class="dre-panel-kpi"><span>R$/sc</span><strong>${node.valor_sc != null ? formatCurrency(node.valor_sc) : '—'}</strong></div>
                <div class="dre-panel-kpi"><span>Tipo</span><strong>${node.type === 'account' ? 'Conta' : node.type === 'group' ? 'Grupo' : 'Linha DRE'}</strong></div>
            </div>
            ${chartItems.length ? `<div class="dre-panel-chart-wrap"><div id="${chartId}" class="dre-panel-chart"></div></div>` : ''}
            ${cult.length ? `<div class="dre-panel-section"><h4>Por cultura</h4>${cult.slice(0, 5).map(c => `
                <div class="dre-panel-row"><span>${c.label}</span><strong>${formatCurrencyCompact(c.value)}</strong></div>`).join('')}</div>` : ''}
            ${centros.length ? `<div class="dre-panel-section"><h4>Centros de custo</h4>${centros.map(c => `
                <div class="dre-panel-row"><span>${c.label}</span><strong>${c.value}</strong></div>`).join('')}</div>` : ''}
            ${entries.length ? `<div class="dre-panel-section"><h4>Lançamentos</h4>${entries.map(e => `
                <div class="dre-panel-row dre-panel-row--entry"><span>${e.label}</span><strong>${e.value}</strong><small>${e.meta}</small></div>`).join('')}</div>` : ''}
            ${!chartItems.length && !entries.length && node.isCalc ? `<p class="dre-panel-fallback">Linha calculada — expanda componentes na árvore para ver contas analíticas.</p>` : ''}
            ${!chartItems.length && !entries.length && !node.isCalc ? `<p class="dre-panel-fallback">Sem detalhamento adicional no recorte atual. Ajuste filtros ou consulte o balancete.</p>` : ''}
        `,
        chartId,
        chartItems
    };
}

export function openDreLinePanel(node, data, filterContext, onDrill) {
    const receitaLiq = (data.dreResumo || [])
        .filter(r => r.linha_dre === 'Receita líquida' && (r.cultura_nome || 'Consolidado') === 'Consolidado')
        .reduce((s, r) => s + Number(r.valor || 0), 0);

    const panel = buildPanelHtml(node, data, receitaLiq);
    const st = Number(node.valor || 0) >= 0 ? 'ok' : 'attention';
    const stLabel = node.isTotal && node.valor < 0 ? 'Crítico' : Number(node.valor || 0) >= 0 ? 'Positivo' : 'Atenção';

    openDrilldown({
        title: node.label,
        subtitle: node.type === 'account' ? `${node.conta_codigo} · ${node.conta_nome || ''}` : 'DRE gerencial contábil',
        status: st,
        statusLabel: stLabel,
        contentHtml: panel.html,
        insight: buildInsight(node, receitaLiq),
        nextAction: nextAction(node),
        source: 'vw_dre_gerencial_contabil · vw_dre_conta_drilldown',
        filterContext: filterContext
            ? `${filterContext} · Exibindo detalhes dentro do recorte filtrado.`
            : 'Visão consolidada · Toda a fazenda.',
        onOpen: () => initPanelChart(panel.chartId, panel.chartItems),
        onAction: node.type === 'account' && node.conta_codigo
            ? () => onDrill?.('accountingAccount', { conta: node.conta_codigo })
            : null,
        actionLabel: node.type === 'account' ? 'Ver todos os lançamentos' : null
    });
}

export function openDreZoomView(node, data, filterContext, onDrill) {
    zoomEl = document.getElementById('dre-zoom-overlay');
    if (!zoomEl) return;

    const receitaLiq = (data.dreResumo || [])
        .filter(r => r.linha_dre === 'Receita líquida' && (r.cultura_nome || 'Consolidado') === 'Consolidado')
        .reduce((s, r) => s + Number(r.valor || 0), 0);

    const accounts = accountsForNode(node, data);
    const cult = cultureBreakdown(node, data);
    const entries = entriesForNode(node, data);
    const periods = periodEvolution(node, data);
    const insight = buildInsight(node, receitaLiq);
    const chartId = 'dre-zoom-chart';

    zoomEl.innerHTML = `
        <div class="dre-zoom-panel">
            <header class="dre-zoom-head">
                <div>
                    <p class="dre-zoom-eyebrow">Modo zoom analítico</p>
                    <h3>${node.label}</h3>
                    <p class="dre-zoom-sub">${formatCurrency(node.valor)} · ${pctRecLiq(node.valor, receitaLiq)} da receita líquida</p>
                </div>
                <button type="button" class="dre-zoom-close" id="dre-zoom-close" aria-label="Voltar ao consolidado">← Consolidado</button>
            </header>
            <div class="dre-zoom-body">
                <div class="dre-zoom-grid">
                    <div class="dre-zoom-card">
                        <h4>Composição por conta</h4>
                        <div id="${chartId}" class="dre-zoom-chart"></div>
                        ${!accounts.length ? '<p class="dre-panel-fallback">Sem contas no recorte.</p>' : ''}
                    </div>
                    <div class="dre-zoom-card">
                        <h4>Por cultura</h4>
                        ${cult.length ? cult.slice(0, 6).map(c => `
                            <div class="dre-panel-row"><span>${c.label}</span><strong>${formatCurrencyCompact(c.value)}</strong></div>
                        `).join('') : '<p class="dre-panel-fallback">Cultura não disponível para esta linha.</p>'}
                    </div>
                    <div class="dre-zoom-card">
                        <h4>Evolução por período</h4>
                        ${periods.length ? periods.map(p => `
                            <div class="dre-panel-row"><span>${p.label}</span><strong>${formatCurrencyCompact(p.value)}</strong></div>
                        `).join('') : '<p class="dre-panel-fallback">Período único no recorte filtrado.</p>'}
                    </div>
                    <div class="dre-zoom-card">
                        <h4>Principais lançamentos</h4>
                        ${entries.length ? entries.map(e => `
                            <div class="dre-panel-row dre-panel-row--entry"><span>${e.label}</span><strong>${e.value}</strong><small>${e.meta}</small></div>
                        `).join('') : '<p class="dre-panel-fallback">Expanda contas analíticas ou selecione uma conta específica.</p>'}
                    </div>
                </div>
                <aside class="dre-zoom-insight">
                    <h4>${insight.title}</h4>
                    <p>${insight.text}</p>
                    <button type="button" class="dre-zoom-detail-btn" id="dre-zoom-detail">Abrir painel contextual</button>
                </aside>
            </div>
        </div>
    `;

    zoomEl.classList.remove('hidden');
    zoomEl.setAttribute('aria-hidden', 'false');

    const onEsc = e => {
        if (e.key === 'Escape') {
            closeDreZoomView();
            document.removeEventListener('keydown', onEsc);
        }
    };
    document.addEventListener('keydown', onEsc);

    document.getElementById('dre-zoom-close')?.addEventListener('click', closeDreZoomView);
    document.getElementById('dre-zoom-detail')?.addEventListener('click', () => {
        openDreLinePanel(node, data, filterContext, onDrill);
    });

    requestAnimationFrame(() => {
        const chartData = accounts.length ? accounts : cult;
        if (chartData.length) zoomChart = initPanelChart(chartId, chartData);
    });
}

export function closeDreZoomView() {
    if (zoomChart) {
        zoomChart.dispose?.();
        zoomChart = null;
    }
    if (zoomEl) {
        zoomEl.classList.add('hidden');
        zoomEl.setAttribute('aria-hidden', 'true');
        zoomEl.innerHTML = '';
    }
}

export function renderPremiumBalancete(container, rows, onDrill) {
    if (!container) return;
    const sorted = [...rows].sort((a, b) => String(a.conta_codigo).localeCompare(String(b.conta_codigo)));
    if (!sorted.length) {
        container.innerHTML = '<div class="dre-empty-state"><p>Balancete vazio no recorte filtrado.</p></div>';
        return;
    }
    const maxDeb = Math.max(...sorted.map(r => Number(r.debitos || 0)), 1);
    container.innerHTML = `
        <div class="dre-table-premium">
            <div class="dre-grid-head dre-grid-head--bal">
                <div>Conta</div><div>Débitos</div><div>Créditos</div><div>Saldo</div><div>Grupo DRE</div>
            </div>
            ${sorted.map(r => `
                <div class="dre-row dre-row--bal drill-row-clickable" data-bal-conta="${r.conta_codigo}" role="button" tabindex="0">
                    <div class="dre-row-label"><span class="dre-row-name">${r.conta_codigo}</span><span class="dre-row-meta">${r.conta_nome}</span></div>
                    <div class="dre-row-val" style="--bar-w:${(Number(r.debitos)/maxDeb)*100}%;--bar-tone:var(--negative)"><span>${formatCurrencyCompact(r.debitos)}</span></div>
                    <div>${formatCurrencyCompact(r.creditos)}</div>
                    <div><strong>${formatCurrencyCompact(r.saldo_final)}</strong></div>
                    <div class="dre-row-meta">${r.grupo_dre || '—'}</div>
                </div>
            `).join('')}
        </div>`;
    container.querySelectorAll('[data-bal-conta]').forEach(row => {
        const open = () => onDrill?.('accountingAccount', { conta: row.dataset.balConta });
        row.addEventListener('click', open);
        row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
}

export function renderPremiumCultura(container, rows, onDrill) {
    if (!container) return;
    const sorted = [...rows].sort((a, b) => Number(b.receita_liquida) - Number(a.receita_liquida));
    if (!sorted.length) {
        container.innerHTML = '<div class="dre-empty-state"><p>Comparativo por cultura indisponível no recorte.</p></div>';
        return;
    }
    const maxRec = Math.max(...sorted.map(r => Number(r.receita_liquida || 0)), 1);
    container.innerHTML = `
        <div class="dre-table-premium">
            <div class="dre-grid-head dre-grid-head--cult">
                <div>Cultura</div><div>Rec. líq.</div><div>Margem bruta</div><div>Resultado</div><div>Margem %</div><div>R$/ha</div>
            </div>
            ${sorted.map(r => `
                <div class="dre-row dre-row--cult drill-row-clickable" data-dre-cultura="${r.cultura_nome}" role="button" tabindex="0">
                    <div class="dre-row-label"><span class="dre-row-name">${r.cultura_nome}</span></div>
                    <div class="dre-row-val" style="--bar-w:${(Math.abs(Number(r.receita_liquida))/maxRec)*100}%;--bar-tone:var(--positive)"><span>${formatCurrencyCompact(r.receita_liquida)}</span></div>
                    <div>${formatCurrencyCompact(r.margem_bruta)}</div>
                    <div>${formatCurrencyCompact(r.resultado_liquido)}</div>
                    <div>${formatPct(r.margem_liquida_pct)}</div>
                    <div>${r.resultado_ha ? formatCurrencyCompact(r.resultado_ha) : '—'}</div>
                </div>
            `).join('')}
        </div>`;
    container.querySelectorAll('[data-dre-cultura]').forEach(row => {
        const open = () => onDrill?.('cultureDre', { cultura: row.dataset.dreCultura });
        row.addEventListener('click', open);
    });
}
