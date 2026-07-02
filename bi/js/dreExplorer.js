/**
 * DRE Explorer — árvore expansível premium com data bars e modo zoom.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatPct,
    formatNumber
} from './api.js?v=5.3';
import { openDreLinePanel, openDreZoomView, closeDreZoomView } from './drePanels.js?v=5.3';

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

const DEFAULT_EXPANDED = new Set();

const SUBTOTAL_LINES = new Set([
    'Receita líquida', 'Margem bruta', 'Resultado atividade agrícola',
    'EBITDA', 'Resultado operacional', 'Resultado antes impostos', 'Resultado líquido gerencial'
]);

const DEDUCTION_LINES = new Set([
    'Deduções', 'Custos variáveis', 'Custos fixos', 'Despesas comerciais',
    'Despesas administrativas', 'Depreciação/amortização', 'Tributos'
]);

function linePrefix(node) {
    if (node.isTotal || node.linha_dre === 'Resultado líquido gerencial') return '(=)';
    if (SUBTOTAL_LINES.has(node.linha_dre)) return '(=)';
    if (DEDUCTION_LINES.has(node.linha_dre)) return '(-)';
    if (node.type === 'group' && Number(node.valor) < 0) return '(-)';
    return '';
}

function rowClass(node) {
    const parts = ['dre-row', `dre-row--${node.type}`];
    if (node.isTotal) parts.push('dre-row--result');
    else if (SUBTOTAL_LINES.has(node.linha_dre)) parts.push('dre-row--subtotal');
    if (node.isCalc) parts.push('dre-row--calc');
    if (Number(node.valor) < 0) parts.push('dre-negative');
    else if (Number(node.valor) > 0 && node.type === 'synthetic') parts.push('dre-positive');
    return parts.join(' ');
}

function fmtVal(v) {
    const n = Number(v || 0);
    const abs = formatCurrencyCompact(Math.abs(n));
    return n < 0 ? `-${abs}` : abs;
}
let activeRowId = null;
let expandedNodes = new Set(DEFAULT_EXPANDED);
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
    const { receitaLiq, maxAbs } = ctx;
    const pct = pctRecLiq(node.valor, receitaLiq);
    const hasChildren = node.children?.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isActive = activeRowId === node.id;
    const canExpand = hasChildren && !node.isCalc;
    const indent = depth * 1.25;
    const prefix = linePrefix(node);
    const displayLabel = prefix ? `${prefix} ${node.label}` : node.label;

    const chevron = canExpand
        ? `<button type="button" class="dre-expand-button${isExpanded ? ' dre-expand-button--open' : ''}" data-expand="${node.id}" aria-expanded="${isExpanded}" aria-label="${isExpanded ? 'Recolher' : 'Expandir'} ${node.label}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg>
           </button>`
        : `<span class="dre-expand-button dre-expand-button--spacer" aria-hidden="true"></span>`;

    const zoomBtn = (node.type === 'group' || (node.type === 'synthetic' && hasChildren))
        ? `<button type="button" class="dre-zoom-btn" data-zoom="${node.id}" title="Zoom analítico" aria-label="Zoom analítico">⤢</button>`
        : '';

    let html = `
        <div class="${rowClass(node)}${isActive ? ' dre-row--active' : ''}${isExpanded ? ' dre-row--expanded' : ''}"
             data-node-id="${node.id}" data-depth="${depth}" style="--row-indent:${indent}rem">
            <div class="dre-row-main" role="button" tabindex="0" data-open="${node.id}" title="Clique para detalhar">
                ${chevron}
                <div class="dre-row-label">
                    <span class="dre-row-name">${displayLabel}</span>
                    ${node.type === 'account' ? `<span class="dre-row-meta">${node.conta_codigo || ''}</span>` : ''}
                </div>
                <div class="dre-value-cell dre-col-val" style="${dataBarStyle(node.valor, maxAbs)}">
                    <span class="dre-value-bar" aria-hidden="true"></span>
                    <span class="dre-val-text">${fmtVal(node.valor)}</span>
                </div>
                <div class="dre-col-pct dre-col-hide-sm">${pct}</div>
                <div class="dre-col-ha dre-col-hide-sm">${fmtHaSc(node.valor_ha)}</div>
                <div class="dre-col-sc dre-col-hide-sm">${node.valor_sc != null ? formatCurrency(node.valor_sc) : '—'}</div>
                <div class="dre-col-actions">${zoomBtn}</div>
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
            if (e.target.closest('[data-expand]') || e.target.closest('[data-zoom]')) return;
            openDetail(row.dataset.open);
        };
        row.addEventListener('click', handler);
        row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(row.dataset.open); }
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
        <div class="dre-statement-shell">
            <div class="dre-statement-header">
                <h3>DRE Gerencial — Competência</h3>
                <p>Valores em R$ · Regime de competência · Clique na linha para investigar</p>
            </div>
            <div class="dre-statement-table">
                <div class="dre-grid-head">
                    <div class="dre-col-label">Linha DRE</div>
                    <div class="dre-col-val">Valor</div>
                    <div class="dre-col-pct dre-col-hide-sm">% RL</div>
                    <div class="dre-col-ha dre-col-hide-sm">R$/ha</div>
                    <div class="dre-col-sc dre-col-hide-sm">R$/sc</div>
                    <div class="dre-col-actions"></div>
                </div>
                <div class="dre-grid-body">
                    ${model.map(n => renderRow(n, renderCtx, 0)).join('')}
                </div>
            </div>
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
