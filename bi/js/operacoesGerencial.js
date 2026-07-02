/**
 * Operações — Performance da Safra por talhão.
 */
import {
    buildTalhaoPerformanceModel,
    buildFieldPerformanceInsights,
    buildFieldPerformanceKpis,
    renderFieldPerformanceTable
} from './fieldPerformance.js?v=5.6';
import { renderOperacoesVisualizacoes } from './operacoesVisualizacoes.js?v=5.8';
import { renderOperacoesMaquinas, isMaquinasVizOpen, initMaquinasAccordionDefault } from './operacoesMaquinas.js?v=5.9';
import { renderOperacoesApontamentos } from './operacoesApontamentos.js?v=5.6';
import { renderInsightCards } from './insights.js?v=5.6';

const FIELD_MODES = ['talhoes', 'visualizacoes', 'maquinas', 'apontamentos'];

function applyFieldLayoutMode(subTab) {
    const layout = document.querySelector('.operations-layout.field-premium');
    if (!layout) return;
    FIELD_MODES.forEach(mode => layout.classList.toggle(`field-mode-${mode}`, mode === subTab));
}

function applyFieldSubtabs(subTab) {
    document.querySelectorAll('.field-segment').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fieldSubtab === subTab);
        btn.setAttribute('aria-selected', btn.dataset.fieldSubtab === subTab ? 'true' : 'false');
    });
    document.querySelectorAll('.field-subpanel').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.fieldSubpanel !== subTab);
    });
}

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

function drawOperacoesCharts({ subTab, drawChart, model, store, charts, setChart, onDrill, onChartsReady }) {
    if (!drawChart) return;

    const shouldDrawViz = subTab === 'visualizacoes';
    const shouldDrawMaq = subTab === 'maquinas' && isMaquinasVizOpen();
    if (!shouldDrawViz && !shouldDrawMaq) return;

    const paint = () => {
        if (shouldDrawViz) {
            renderOperacoesVisualizacoes({
                model,
                talhoes: store.talhoes,
                charts,
                setChart,
                onDrill,
                drawChart: true
            });
        }
        if (shouldDrawMaq) {
            renderOperacoesMaquinas({
                maquinas: store.maquinas,
                charts,
                setChart,
                onDrill,
                drawChart: true
            });
        }
        requestAnimationFrame(() => {
            onChartsReady?.();
            if (shouldDrawViz) {
                setTimeout(() => onChartsReady?.(), 150);
            }
            if (shouldDrawMaq) {
                setTimeout(() => onChartsReady?.(), 150);
                setTimeout(() => onChartsReady?.(), 300);
            }
        });
    };

    requestAnimationFrame(() => requestAnimationFrame(paint));
}

export function renderOperacoesGerencial({
    store,
    charts,
    setChart,
    onDrill,
    subTab = 'talhoes',
    drawChart = false,
    filterContext = '',
    onChartsReady = null
}) {
    applyFieldSubtabs(subTab);
    applyFieldLayoutMode(subTab);

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

    renderOperacoesMaquinas({
        maquinas: store.maquinas,
        charts,
        setChart,
        onDrill,
        drawChart: false
    });

    renderOperacoesApontamentos(document.getElementById('field-apontamentos-host'));

    drawOperacoesCharts({
        subTab,
        drawChart,
        model,
        store,
        charts,
        setChart,
        onDrill,
        onChartsReady
    });
}

export function initOperacoesSubtabs(onChange) {
    document.querySelectorAll('.field-segment').forEach(btn => {
        btn.addEventListener('click', () => onChange(btn.dataset.fieldSubtab));
    });
}

export function initMaquinasVizAccordion(onOpen) {
    initMaquinasAccordionDefault();
    const acc = document.getElementById('field-maquinas-viz-accordion');
    if (!acc || acc.dataset.bound) return;
    acc.dataset.bound = '1';
    acc.addEventListener('toggle', () => {
        if (acc.open) onOpen?.();
    });
}

export { buildTalhaoPerformanceModel };
