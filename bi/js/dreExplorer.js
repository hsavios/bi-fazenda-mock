/**
 * DRE Explorer — árvore expansível premium com data bars e modo zoom.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatPct,
    formatNumber
} from './api.js?v=5.2';
import { openDreLinePanel, openDreZoomView, closeDreZoomView } from './drePanels.js?v=5.2';

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

const CALCULATED_LINES = new Set([
    'Receita líquida', 'Margem bruta', 'Resultado atividade agrícola',
    'EBITDA', 'Resultado operacional', 'Resultado antes impostos', 'Resultado líquido gerencial'
]);

const DEFAULT_EXPANDED = new Set(['line-10', 'line-40']);

let expandedNodes = new Set(DEFAULT_EXPANDED);
let activeRowId = null;

function statusMeta(val, isTotal = false) {
    if (isTotal) {
        return val >= 0
            ? { label: 'Positivo', cls: 'dre-badge--ok' }
            : { label: 'Crítico', cls: 'dre-badge--critical' };
    }
    if (val >= 0) return { label: 'Positivo', cls: 'dre-badge--ok' };
    return { label: 'Atenção', cls: 'dre-badge--warn' };
}

function aggregateContabilByGrupo(contabilRows) {
    const map = new Map();
    (contabilRows || []).forEach(r => {
        const og = Number(r.ordem_grupo || 0);
        if (!map.has(og)) {
            map.set(og, {
                ordem: og,
                grupos: new Map()
            });
        }
        const bucket = map.get(og);
        const gKey = r.grupo_dre || 'Outros';
        if (!bucket.grupos.has(gKey)) {
            bucket.grupos.set(gKey, {
                grupo: gKey,
                ordem: r.ordem_grupo,
                valor: 0,
                pctSum: 0,
                pctCount: 0,
                haSum: 0,
                scSum: 0,
                accounts: new Map()
            });
        }
        const g = bucket.grupos.get(gKey);
        const v = Number(r.valor || 0);
        g.valor += v;
        if (r.percentual_receita_liquida != null) {
            g.pctSum += Number(r.percentual_receita_liquida);
            g.pctCount += 1;
        }
        if (r.valor_por_ha != null) g.haSum += Number(r.valor_por_ha);
        if (r.valor_por_sc != null) g.scSum += Number(r.valor_por_sc);

        const accKey = r.conta_codigo || r.conta_nome;
        if (!g.accounts.has(accKey)) {
            g.accounts.set(accKey, {
                id: `acc-${accKey}`,
                type: 'account',
                conta_codigo: r.conta_codigo,
                conta_nome: r.conta_nome,
                subgrupo: r.subgrupo_dre,
                ordem: r.ordem_subgrupo,
                grupo_dre: r.grupo_dre,
                valor: 0,
                valor_ha: r.valor_por_ha,
                valor_sc: r.valor_por_sc
            });
        }
        const acc = g.accounts.get(accKey);
        acc.valor += v;
    });
    return map;
}

export function buildExplorerModel(lines, contabilRows) {
    const byOrdem = aggregateContabilByGrupo(contabilRows);
    const maxAbs = Math.max(...(lines || []).map(l => Math.abs(Number(l.valor || 0))), 1);

    return (lines || []).map(line => {
        const ordemGrupo = LINHA_GRUPO_ORDEM[line.linha_dre];
        const isCalc = CALCULATED_LINES.has(line.linha_dre);
        const lineId = `line-${line.ordem || line.linha_dre}`;
        const valor = Number(line.valor || 0);
        const children = [];

        if (ordemGrupo && byOrdem.has(ordemGrupo)) {
            const bucket = byOrdem.get(ordemGrupo);
            [...bucket.grupos.values()]
                .sort((a, b) => a.grupo.localeCompare(b.grupo))
                .forEach(g => {
                    const groupId = `${lineId}-grp-${g.ordem}-${g.grupo}`;
                    const accounts = [...g.accounts.values()]
                        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                    children.push({
                        id: groupId,
                        type: 'group',
                        label: g.grupo,
                        grupo_dre: g.grupo,
                        ordem_grupo: g.ordem,
                        linha_dre: line.linha_dre,
                        valor: g.valor,
                        valor_ha: g.haSum || null,
                        valor_sc: g.scSum || null,
                        isCalc: false,
                        children: accounts.map(a => ({
                            ...a,
                            linha_dre: line.linha_dre,
                            pctRecLiq: null
                        }))
                    });
                });
        }

        return {
            id: lineId,
            type: 'synthetic',
            label: line.linha_dre,
            linha_dre: line.linha_dre,
            ordem: line.ordem,
            valor,
            isCalc,
            isTotal: line.linha_dre === 'Resultado líquido gerencial',
            children
        };
    }).map(node => ({ ...node, maxAbs }));
}

function pctRecLiq(val, receitaLiq) {
    if (!receitaLiq) return '—';
    return formatPct((val / receitaLiq) * 100);
}

function dataBarStyle(val, maxAbs) {
    const pct = Math.min(100, (Math.abs(val) / maxAbs) * 100);
    const positive = val >= 0;
    return `--bar-w:${pct}%;--bar-tone:${positive ? 'var(--positive)' : 'var(--negative)'}`;
}

function fmtHaSc(v) {
    if (v == null || v === 0 || Number.isNaN(v)) return '—';
    return formatCurrencyCompact(v);
}

function renderRow(node, ctx, depth = 0) {
    const { receitaLiq, maxAbs, data, filterContext, onDrill } = ctx;
    const pct = pctRecLiq(node.valor, receitaLiq);
    const st = statusMeta(node.valor, node.isTotal);
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isActive = activeRowId === node.id;
    const canExpand = hasChildren && !node.isCalc;
    const indent = depth * 1.15;

    const chevron = canExpand
        ? `<button type="button" class="dre-expander${isExpanded ? ' dre-expander--open' : ''}" data-expand="${node.id}" aria-expanded="${isExpanded}" aria-label="${isExpanded ? 'Recolher' : 'Expandir'} ${node.label}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg>
           </button>`
        : `<span class="dre-expander dre-expander--spacer" aria-hidden="true"></span>`;

    const zoomBtn = node.type === 'group' || (node.type === 'synthetic' && hasChildren)
        ? `<button type="button" class="dre-zoom-btn" data-zoom="${node.id}" title="Modo zoom analítico">⤢</button>`
        : '';

    const detailBtn = `<button type="button" class="dre-detail-btn" data-detail="${node.id}">Ver detalhe</button>`;

    let html = `
        <div class="dre-row dre-row--${node.type}${isActive ? ' dre-row--active' : ''}${node.isTotal ? ' dre-row--total' : ''}${node.isCalc ? ' dre-row--calc' : ''}"
             data-node-id="${node.id}" data-depth="${depth}" style="--row-indent:${indent}rem">
            <div class="dre-row-main" role="button" tabindex="0" data-open="${node.id}">
                ${chevron}
                <div class="dre-row-label">
                    <span class="dre-row-name">${node.label}</span>
                    ${node.type === 'account' ? `<span class="dre-row-meta">${node.conta_codigo || ''}</span>` : ''}
                    ${node.isCalc ? '<span class="dre-row-tag">Calculado</span>' : ''}
                </div>
                <div class="dre-row-val dre-col-val" style="${dataBarStyle(node.valor, maxAbs)}">
                    <span class="dre-val-text">${formatCurrencyCompact(node.valor)}</span>
                </div>
                <div class="dre-col-pct dre-col-hide-sm">${pct}</div>
                <div class="dre-col-ha dre-col-hide-sm">${fmtHaSc(node.valor_ha)}</div>
                <div class="dre-col-sc dre-col-hide-sm">${node.valor_sc != null ? formatCurrency(node.valor_sc) : '—'}</div>
                <div class="dre-col-status">${node.type !== 'account' ? `<span class="dre-badge ${st.cls}">${st.label}</span>` : ''}</div>
                <div class="dre-col-actions">${zoomBtn}${detailBtn}</div>
            </div>
        </div>
    `;

    if (canExpand && isExpanded) {
        html += `<div class="dre-children dre-children--open" data-parent="${node.id}">`;
        if (node.children.length) {
            node.children.forEach(child => {
                html += renderRow(child, ctx, depth + 1);
            });
        } else {
            html += `<div class="dre-empty-inline">Nenhuma conta analítica mapeada nesta linha.</div>`;
        }
        html += '</div>';
    } else if (canExpand && !isExpanded) {
        html += `<div class="dre-children" data-parent="${node.id}" hidden></div>`;
    }

    return html;
}

function findNode(model, id) {
    for (const n of model) {
        if (n.id === id) return n;
        for (const g of n.children || []) {
            if (g.id === id) return g;
            for (const a of g.children || []) {
                if (a.id === id) return a;
            }
        }
    }
    return null;
}

function bindExplorerEvents(container, model, ctx) {
    container.querySelectorAll('[data-expand]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = btn.dataset.expand;
            if (expandedNodes.has(id)) expandedNodes.delete(id);
            else expandedNodes.add(id);
            renderDreExplorer(container, model, ctx);
        });
    });

    const openDetail = id => {
        activeRowId = id;
        container.querySelectorAll('.dre-row').forEach(r => {
            r.classList.toggle('dre-row--active', r.dataset.nodeId === id);
        });
        const node = findNode(model, id);
        if (!node) return;
        openDreLinePanel(node, ctx.data, ctx.filterContext, ctx.onDrill);
    };

    container.querySelectorAll('[data-open]').forEach(row => {
        const handler = e => {
            if (e.target.closest('[data-expand]') || e.target.closest('[data-zoom]') || e.target.closest('.dre-detail-btn')) return;
            openDetail(row.dataset.open);
        };
        row.addEventListener('click', handler);
        row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(row.dataset.open); }
        });
    });

    container.querySelectorAll('[data-detail]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            openDetail(btn.dataset.detail);
        });
    });

    container.querySelectorAll('[data-zoom]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const node = findNode(model, btn.dataset.zoom);
            if (node) openDreZoomView(node, ctx.data, ctx.filterContext, ctx.onDrill);
        });
    });
}

export function renderDreExplorer(container, model, ctx) {
    if (!container) return;
    if (!model?.length) {
        container.innerHTML = `
            <div class="dre-empty-state">
                <div class="dre-empty-icon" aria-hidden="true">📊</div>
                <h4>Sem dados contábeis no recorte</h4>
                <p>Ajuste os filtros de safra, cultura ou período para visualizar a DRE gerencial.</p>
            </div>`;
        return;
    }

    const maxAbs = Math.max(...model.map(n => Math.abs(n.valor)), 1);
    const renderCtx = { ...ctx, maxAbs };

    container.innerHTML = `
        <div class="dre-grid-head">
            <div class="dre-col-label">Linha DRE</div>
            <div class="dre-col-val">Valor</div>
            <div class="dre-col-pct dre-col-hide-sm">% Rec. Líq.</div>
            <div class="dre-col-ha dre-col-hide-sm">R$/ha</div>
            <div class="dre-col-sc dre-col-hide-sm">R$/sc</div>
            <div class="dre-col-status">Status</div>
            <div class="dre-col-actions"></div>
        </div>
        <div class="dre-grid-body">
            ${model.map(n => renderRow(n, renderCtx, 0)).join('')}
        </div>
    `;

    bindExplorerEvents(container, model, ctx);
}

export function resetExplorerState() {
    expandedNodes = new Set(DEFAULT_EXPANDED);
    activeRowId = null;
    closeDreZoomView();
}

export { LINHA_GRUPO_ORDEM, CALCULATED_LINES };
