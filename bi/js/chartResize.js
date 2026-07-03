/**
 * Registry central, resize programado e observers de instâncias ECharts.
 */
window.__biCharts = window.__biCharts || new Set();

let chartResizeObserver = null;
let viewportListenersBound = false;

export function registerBiChart(chart) {
    if (!chart) return;
    window.__biCharts.add(chart);
    const dom = chart.getDom?.();
    if (dom) dom.__echartsInstance__ = chart;
}

export function unregisterBiChart(chart) {
    window.__biCharts?.delete(chart);
    const dom = chart.getDom?.();
    if (dom && dom.__echartsInstance__ === chart) {
        delete dom.__echartsInstance__;
    }
}

export function isChartNodeVisible(node) {
    if (!node) return false;
    let el = node;
    while (el) {
        if (el.classList?.contains('hidden')) return false;
        if (el.tagName === 'DETAILS' && !el.open) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        el = el.parentElement;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

export function syncChartDomSize(chart) {
    if (!chart) return;
    try {
        const dom = chart.getDom?.();
        if (!dom || !isChartNodeVisible(dom)) return;

        const rect = dom.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) return;

        chart.resize({
            width: Math.floor(rect.width),
            height: Math.floor(rect.height)
        });
    } catch (error) {
        console.warn('[BI] Falha ao sincronizar tamanho do chart', error);
    }
}

export function resizeVisibleCharts() {
    if (!window.__biCharts) return;

    window.__biCharts.forEach(chart => {
        try {
            const dom = chart.getDom?.();
            if (!dom || !isChartNodeVisible(dom)) return;

            const rect = dom.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 50) return;

            chart.resize({
                width: Math.floor(rect.width),
                height: Math.floor(rect.height)
            });
        } catch (error) {
            console.warn('[BI] Falha ao redimensionar chart', error);
        }
    });
}

export function scheduleChartResize(resizeFn) {
    const run = typeof resizeFn === 'function' ? resizeFn : resizeVisibleCharts;
    requestAnimationFrame(() => {
        run();
        setTimeout(run, 80);
        setTimeout(run, 180);
        setTimeout(run, 360);
    });
}

export function debugBiCharts() {
    return Array.from(document.querySelectorAll('.bi-chart')).map(el => {
        const rect = el.getBoundingClientRect();
        const card = el.closest('.bi-chart-card');
        const cardRect = card?.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;

        return {
            id: el.id || '(sem id)',
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            cardWidth: cardRect ? Math.round(cardRect.width) : null,
            cardHeight: cardRect ? Math.round(cardRect.height) : null,
            visible,
            tooSmall: visible && rect.height < 280,
            clippedByParent: card ? card.scrollHeight > card.clientHeight + 2 : false
        };
    });
}

export function installChartDebugGlobals() {
    window.__BI_RESIZE_CHARTS__ = () => scheduleChartResize(resizeVisibleCharts);
    window.__BI_CHART_DEBUG__ = debugBiCharts;
}

function observeTarget(node) {
    if (!chartResizeObserver || !node || node.dataset.resizeObserved) return;
    node.dataset.resizeObserved = '1';
    chartResizeObserver.observe(node);
}

export function observeChartNode(chartNode) {
    if (!chartNode) return;
    const body = chartNode.closest('.bi-chart-card__body')
        || chartNode.closest('.chart-body')
        || chartNode.parentElement;
    observeTarget(body || chartNode);
}

export function observeChartContainers() {
    if (!chartResizeObserver) return;
    document.querySelectorAll(
        '.bi-chart-card__body, .chart-body, .bi-chart-card, .visualizations-panel, .visualizations-grid, .operations-visualizations-view, .machine-visuals-panel, .bi-chart'
    ).forEach(observeTarget);
}

export function setupBiChartResizeObserver(onResize) {
    if (typeof ResizeObserver === 'undefined') return;

    const schedule = () => scheduleChartResize(onResize);

    if (!chartResizeObserver) {
        chartResizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const target = entry.target;
                const chartEl = target.classList?.contains('bi-chart')
                    ? target
                    : target.querySelector?.('.bi-chart');
                const chart = chartEl?.__echartsInstance__;
                if (chart) syncChartDomSize(chart);
            }
            schedule();
        });
    }

    observeChartContainers();
}

export function setupViewportResizeListeners(onResize) {
    if (viewportListenersBound) return;
    viewportListenersBound = true;

    const schedule = () => scheduleChartResize(onResize);

    window.addEventListener('resize', schedule, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', schedule, { passive: true });
    }

    if (window.matchMedia) {
        const dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        if (typeof dprQuery.addEventListener === 'function') {
            dprQuery.addEventListener('change', schedule);
        } else if (typeof dprQuery.addListener === 'function') {
            dprQuery.addListener(schedule);
        }
    }
}
