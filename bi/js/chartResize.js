/**
 * Registry e resize programado de instâncias ECharts.
 */
export function registerBiChart(chart) {
    if (!chart) return;
    if (!window.__biCharts) window.__biCharts = new Set();
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
    return node.offsetWidth > 0 && node.offsetHeight > 0;
}

export function resizeRegisteredCharts(resolver) {
    const resizeOne = chart => {
        if (!chart) return;
        try { chart.resize(); } catch (_) { /* ignore */ }
    };
    if (typeof resolver === 'function') {
        resolver().forEach(resizeOne);
        return;
    }
    window.__biCharts?.forEach(resizeOne);
}

export function scheduleChartResize(resizeFn) {
    const run = typeof resizeFn === 'function' ? resizeFn : () => resizeRegisteredCharts();
    requestAnimationFrame(() => {
        run();
        setTimeout(run, 80);
        setTimeout(run, 180);
    });
}
