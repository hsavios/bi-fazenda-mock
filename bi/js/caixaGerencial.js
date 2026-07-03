/**
 * Caixa — demonstrativo (matriz), visualizações e movimentos.
 */
import {
    formatCurrency,
    formatCurrencyCompact
} from './api.js?v=5.10';
import {
    aggregateCashByMonth,
    renderCashStatementMatrix,
    renderCashMovementsTable,
    renderCashMobilePanel
} from './cashFlow.js?v=5.10';
import { renderCaixaVisualizacoes } from './caixaVisualizacoes.js?v=5.10';

function renderFilterBreadcrumb(container, filterContext) {
    if (!container) return;
    if (!filterContext) {
        container.innerHTML = '<span class="cash-breadcrumb-item cash-breadcrumb-item--muted">Consolidado · Período completo</span>';
        return;
    }
    container.innerHTML = `<span class="cash-breadcrumb-item">${filterContext.replace('Recorte atual: ', '')}</span>`;
}

function renderCompactKpis(container, months, onDrill) {
    if (!container) return;
    const totalEntradas = months.reduce((s, m) => s + m.entradas, 0);
    const totalSaidas = months.reduce((s, m) => s + m.saidas, 0);
    const saldoFinal = months.length ? months[months.length - 1].saldoAcumulado : 0;
    const maxPressao = months.length ? [...months].sort((a, b) => b.pressao - a.pressao)[0] : null;
    const maxEntrada = months.length ? [...months].sort((a, b) => b.entradas - a.entradas)[0] : null;

    const items = [
        { label: 'Total de entradas', value: formatCurrencyCompact(totalEntradas), drill: 'total-entradas', tone: 'positive' },
        { label: 'Total de saídas', value: formatCurrencyCompact(totalSaidas), drill: 'total-saidas', tone: 'warn' },
        { label: 'Saldo final', value: formatCurrencyCompact(saldoFinal), drill: 'saldo-final', tone: saldoFinal >= 0 ? 'positive' : 'critical' },
        { label: 'Mês de maior pressão', value: maxPressao?.monthLabel || '—', hint: maxPressao ? formatCurrencyCompact(maxPressao.pressao) + ' de pressão' : '', drill: 'pressao-caixa', tone: 'warn' },
        { label: 'Maior entrada mensal', value: maxEntrada?.monthLabel || '—', hint: maxEntrada ? formatCurrencyCompact(maxEntrada.entradas) : '', drill: 'maior-entrada', tone: 'positive' }
    ];

    container.innerHTML = items.map(it => `
        <div class="cash-kpi-card cash-kpi-card--${it.tone} cash-kpi-card--clickable"
             data-drill-kpi="${it.drill}" role="button" tabindex="0" aria-label="Detalhar ${it.label}">
            <span class="cash-kpi-label">${it.label}</span>
            <span class="cash-kpi-value">${it.value}</span>
            ${it.hint ? `<span class="cash-kpi-hint">${it.hint}</span>` : ''}
            <span class="cash-kpi-action">Ver detalhe ›</span>
        </div>
    `).join('');

    container.querySelectorAll('[data-drill-kpi]').forEach(node => {
        const open = () => onDrill?.('kpi', { kpiId: node.dataset.drillKpi });
        node.addEventListener('click', open);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

export function renderCaixaGerencial({
    store,
    charts,
    setChart,
    onDrill,
    subTab = 'matriz',
    drawChart = false,
    filterContext = '',
    selectedMonthKey = null,
    onMonthKeyChange = null,
    onChartsReady = null
}) {
    const fluxo = store.fluxo || [];
    const months = aggregateCashByMonth(fluxo);

    document.querySelectorAll('.cash-segment').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cashSubtab === subTab);
        btn.setAttribute('aria-selected', btn.dataset.cashSubtab === subTab ? 'true' : 'false');
    });
    document.querySelectorAll('.cash-subpanel').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.cashSubpanel !== subTab);
    });

    renderFilterBreadcrumb(document.getElementById('cash-filter-breadcrumb'), filterContext);
    renderCompactKpis(document.getElementById('kpi-caixa'), months, onDrill);

    const matrixContainer = document.getElementById('cash-matrix');
    renderCashStatementMatrix(matrixContainer, fluxo, ctx =>
        onDrill?.('cashMatrixCell', ctx)
    );

    renderCashMovementsTable(
        document.getElementById('cash-movements-table'),
        fluxo,
        movement => onDrill?.('cashMovement', { movement })
    );

    const shouldDrawCharts = drawChart && subTab === 'visualizacoes';
    const paintCharts = () => {
        renderCaixaVisualizacoes({
            months,
            fluxo,
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
        renderCaixaVisualizacoes({
            months,
            fluxo,
            charts,
            setChart,
            onDrill,
            drawChart: false
        });
    }

    const mobileKey = selectedMonthKey || months[0]?.monthKey;
    if (mobileKey && onMonthKeyChange) {
        const select = document.getElementById('cash-month-select');
        if (select && select.value !== mobileKey) select.value = mobileKey;
    }
    renderCashMobilePanel(
        document.getElementById('cash-mobile-cards'),
        months,
        mobileKey,
        ctx => onDrill?.('cashMatrixCell', ctx)
    );
}

export function setupCashMobileSelect(months, selectedKey, onChange) {
    const select = document.getElementById('cash-month-select');
    if (!select || !months.length) return;
    select.innerHTML = months.map(m =>
        `<option value="${m.monthKey}"${m.monthKey === selectedKey ? ' selected' : ''}>${m.monthLabel}</option>`
    ).join('');
    select.onchange = () => onChange?.(select.value);
}

export function initCaixaSubtabs(onChange) {
    document.querySelectorAll('.cash-segment').forEach(btn => {
        btn.addEventListener('click', () => onChange(btn.dataset.cashSubtab));
    });
}
