/**
 * Operações — Performance da Safra por talhão.
 */
import { formatCurrencyCompact } from './api.js?v=5.6';
import {
    buildTalhaoPerformanceModel,
    buildFieldPerformanceInsights,
    buildFieldPerformanceKpis,
    renderFieldPerformanceTable
} from './fieldPerformance.js?v=5.6';
import { renderOperacoesVisualizacoes } from './operacoesVisualizacoes.js?v=5.6';
import { renderOperacoesMaquinas } from './operacoesMaquinas.js?v=5.6';
import { renderOperacoesApontamentos } from './operacoesApontamentos.js?v=5.6';
import { renderInsightCards } from './insights.js?v=5.6';

function renderBreadcrumb(container, filterContext) {
    if (!container) return;
    if (!filterContext) {
        container.innerHTML = '<span class="field-breadcrumb-item field-breadcrumb-item--muted">Consolidado · Safra completa</span>';
        return;
    }
    container.innerHTML = `<span class="field-breadcrumb-item">${filterContext.replace('Recorte atual: ', '')}</span>`;
}

function renderKpis(container, kpis, onDrill) {
    if (!container) return;
    container.innerHTML = kpis.map(it => `
        <div class="field-kpi-card field-kpi-card--${it.tone || 'default'} field-kpi-card--clickable"
             data-field-kpi="${it.drill}"
             ${it.talhao ? `data-talhao="${it.talhao}" data-cultura="${it.cultura || ''}"` : ''}
             role="button" tabindex="0" aria-label="Detalhar ${it.label}">
            <span class="field-kpi-label">${it.label}</span>
            <span class="field-kpi-value">${it.value}</span>
            ${it.hint ? `<span class="field-kpi-hint">${it.hint}</span>` : ''}
            <span class="field-kpi-action">Ver detalhe ›</span>
        </div>
    `).join('');

    container.querySelectorAll('[data-field-kpi]').forEach(node => {
        const open = () => {
            if (node.dataset.talhao) {
                onDrill?.('talhaoPerformance', { talhaoCodigo: node.dataset.talhao, cultura: node.dataset.cultura || undefined });
            } else {
                onDrill?.('fieldKpi', { kpiId: node.dataset.fieldKpi });
            }
        };
        node.addEventListener('click', open);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

export function renderOperacoesGerencial({
    store,
    charts,
    setChart,
    onDrill,
    subTab = 'talhoes',
    drawChart = false,
    filterContext = ''
}) {
    const model = buildTalhaoPerformanceModel(store.talhoes, store.produtividade);

    renderBreadcrumb(document.getElementById('field-filter-breadcrumb'), filterContext);
    renderKpis(document.getElementById('kpi-operacoes'), buildFieldPerformanceKpis(model), onDrill);

    renderFieldPerformanceTable(
        document.getElementById('field-performance-table'),
        model,
        ctx => onDrill?.('talhaoPerformance', ctx)
    );

    renderInsightCards(
        document.getElementById('insights-field-talhoes'),
        buildFieldPerformanceInsights(model)
    );

    renderOperacoesVisualizacoes({
        model,
        talhoes: store.talhoes,
        maquinas: store.maquinas,
        charts,
        setChart,
        onDrill,
        drawChart: drawChart && subTab === 'visualizacoes'
    });

    renderOperacoesMaquinas({
        maquinas: store.maquinas,
        maoObra: store.maoObra,
        charts,
        setChart,
        onDrill,
        drawChart: drawChart && subTab === 'maquinas'
    });

    renderOperacoesApontamentos(document.getElementById('field-apontamentos-host'));

    document.querySelectorAll('.field-segment').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fieldSubtab === subTab);
        btn.setAttribute('aria-selected', btn.dataset.fieldSubtab === subTab ? 'true' : 'false');
    });
    document.querySelectorAll('.field-subpanel').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.fieldSubpanel !== subTab);
    });
}

export function initOperacoesSubtabs(onChange) {
    document.querySelectorAll('.field-segment').forEach(btn => {
        btn.addEventListener('click', () => onChange(btn.dataset.fieldSubtab));
    });
}

export { buildTalhaoPerformanceModel };
