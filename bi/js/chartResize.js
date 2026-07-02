/**
 * Registry central e resize programado de instâncias ECharts.
 */
window.__biCharts = window.__biCharts || new Set();

export function registerBiChart(chart) {
    if (!chart) return;
    window.__biCharts.add(chart);
}

export function unregisterBiChart(chart) {
    window.__biCharts?.delete(chart);
}

export function isChartNodeVisible(node) {
    if (!node) return false;
    let el = node;
    while (el) {
        if (el.classList?.contains('hidden')) return false;
        if (el.tagName === 'DETAILS' && !el.open) return false;
        el = el.parentElement;
    }
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

export function resizeVisibleCharts() {
    if (!window.__biCharts) return;

    window.__biCharts.forEach(chart => {
        try {
            const dom = chart.getDom?.();
            if (!dom) return;

            const rect = dom.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            chart.resize();
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
    const nodes = document.querySelectorAll('.bi-chart, .chart');
    return Array.from(nodes).map(el => {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        return {
            id: el.id,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            visible,
            tooSmall: visible && rect.height < 260
        };
    });
}

export function installChartDebugGlobals() {
    window.__BI_RESIZE_CHARTS__ = () => scheduleChartResize(resizeVisibleCharts);
    window.__BI_CHART_DEBUG__ = debugBiCharts;
}
