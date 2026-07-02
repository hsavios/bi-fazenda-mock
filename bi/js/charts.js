/**
 * Builders ECharts — visualizações avançadas do cockpit.
 */
import { formatCurrency, formatNumber, formatPct } from './api.js?v=5.4';

export const CHART_COLORS = {
    primary: '#2d6a4f',
    light: '#40916c',
    accent: '#52b788',
    gold: '#b8860b',
    warn: '#d4a017',
    danger: '#c0392b',
    muted: '#6c7f72',
    positive: '#2d6a4f',
    negative: '#c0392b'
};

export const CHART_PALETTE = ['#2d6a4f', '#40916c', '#52b788', '#b8860b', '#74c69d', '#c0392b'];

export const DRILL_HINT = '<br><span style="opacity:0.72;font-size:10px">Clique para detalhar</span>';

const baseGrid = { left: 48, right: 16, top: 28, bottom: 36, containLabel: false };

export function compactAxisMoney(v) {
    const n = Number(v);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'k';
    return formatNumber(n, 0);
}

export function waterfallOption(steps) {
    const labels = steps.map(s => s.label);
    const values = steps.map(s => Number(s.value));
    const placeholders = [];
    const visible = [];
    let running = 0;

    values.forEach((v, i) => {
        const step = steps[i];
        if (step.type === 'total') {
            placeholders.push(0);
            visible.push(v);
            running = v;
            return;
        }
        if (v >= 0) {
            placeholders.push(running);
            visible.push(v);
            running += v;
        } else {
            running += v;
            placeholders.push(running);
            visible.push(Math.abs(v));
        }
    });

    return {
        color: [CHART_COLORS.light, CHART_COLORS.gold, CHART_COLORS.danger, CHART_COLORS.primary],
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter(params) {
                const idx = params[1]?.dataIndex ?? params[0]?.dataIndex ?? 0;
                const raw = values[idx];
                const step = steps[idx];
                const sign = step.type === 'subtract' ? '−' : '';
                return `${step.label}<br>${sign}${formatCurrency(Math.abs(raw))}${DRILL_HINT}`;
            }
        },
        grid: { ...baseGrid, bottom: 48 },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { fontSize: 10, interval: 0, rotate: labels.length > 5 ? 18 : 0 }
        },
        yAxis: {
            type: 'value',
            axisLabel: { fontSize: 10, formatter: compactAxisMoney }
        },
        series: [
            {
                name: 'placeholder',
                type: 'bar',
                stack: 'waterfall',
                itemStyle: { color: 'transparent', borderColor: 'transparent' },
                emphasis: { itemStyle: { color: 'transparent' } },
                data: placeholders
            },
            {
                name: 'valor',
                type: 'bar',
                stack: 'waterfall',
                barMaxWidth: 40,
                data: visible.map((v, i) => ({
                    value: v,
                    itemStyle: {
                        color: steps[i].type === 'total'
                            ? CHART_COLORS.primary
                            : steps[i].type === 'subtract'
                                ? CHART_COLORS.danger
                                : CHART_COLORS.light
                    }
                }))
            }
        ]
    };
}

export function treemapOption(items, valueFormatter = formatCurrency) {
    return {
        color: CHART_PALETTE,
        tooltip: {
            formatter(p) {
                return `${p.name}<br>${valueFormatter(p.value)} (${formatPct(p.data?.pct || 0)})${DRILL_HINT}`;
            }
        },
        series: [{
            type: 'treemap',
            roam: false,
            nodeClick: false,
            label: { show: true, fontSize: 11, formatter: '{b}' },
            upperLabel: { show: false },
            itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
            data: items.map(i => ({
                name: i.name,
                value: i.value,
                pct: i.pct,
                itemStyle: i.color ? { color: i.color } : undefined
            }))
        }]
    };
}

export function scatterBubbleOption(points) {
    return {
        color: CHART_PALETTE,
        tooltip: {
            formatter(p) {
                const d = p.data;
                return `<strong>${d.name}</strong><br>
                    Produtividade: ${formatNumber(d.x, 1)} sc/ha<br>
                    Margem: ${formatPct(d.y)}<br>
                    Receita: ${formatCurrency(d.receita)}${DRILL_HINT}`;
            }
        },
        grid: { ...baseGrid, left: 52, bottom: 52 },
        xAxis: {
            name: 'Produtividade (sc/ha)',
            nameLocation: 'middle',
            nameGap: 28,
            nameTextStyle: { fontSize: 10 },
            axisLabel: { fontSize: 10 }
        },
        yAxis: {
            name: 'Margem %',
            nameTextStyle: { fontSize: 10 },
            axisLabel: { fontSize: 10, formatter: v => v + '%' }
        },
        series: [{
            type: 'scatter',
            symbolSize(d) {
                return Math.max(18, Math.min(56, Math.sqrt(d[2]) / 800));
            },
            data: points.map(p => ({
                name: p.name,
                value: [p.x, p.y, p.size],
                x: p.x,
                y: p.y,
                receita: p.receita,
                itemStyle: { color: p.color }
            }))
        }]
    };
}

export function horizontalBarOption(labels, values, opts = {}) {
    const { color = CHART_COLORS.primary, formatter, maxWidth = 22 } = opts;
    return {
        color: [color],
        tooltip: {
            trigger: 'axis',
            formatter: p => `${p[0].name}: ${formatter ? formatter(p[0].value) : p[0].value}${DRILL_HINT}`
        },
        grid: { left: 8, right: 20, top: 8, bottom: 8, containLabel: true },
        xAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: opts.xFormatter } },
        yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11 } },
        series: [{ type: 'bar', data: values, barMaxWidth: maxWidth }]
    };
}

export function paretoOption(labels, values, valueFormatter = formatCurrency) {
    const total = values.reduce((s, v) => s + v, 0) || 1;
    let cumulative = 0;
    const cumPct = values.map(v => {
        cumulative += v;
        return Math.round((cumulative / total) * 1000) / 10;
    });

    return {
        color: [CHART_COLORS.primary, CHART_COLORS.gold],
        tooltip: {
            trigger: 'axis',
            formatter(params) {
                const bar = params.find(p => p.seriesName === 'Custo');
                const line = params.find(p => p.seriesName === 'Acumulado');
                let html = `${bar?.name || ''}<br>`;
                if (bar) html += `Custo: ${valueFormatter(bar.value)}<br>`;
                if (line) html += `Acumulado: ${line.value}%`;
                return html + DRILL_HINT;
            }
        },
        legend: { data: ['Custo', 'Acumulado'], bottom: 0, textStyle: { fontSize: 10 } },
        grid: { ...baseGrid, bottom: 52 },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { fontSize: 10, interval: 0, rotate: labels.length > 6 ? 25 : 0 }
        },
        yAxis: [
            { type: 'value', axisLabel: { fontSize: 10, formatter: compactAxisMoney } },
            { type: 'value', max: 100, axisLabel: { fontSize: 10, formatter: v => v + '%' } }
        ],
        series: [
            { name: 'Custo', type: 'bar', data: values, barMaxWidth: 36 },
            {
                name: 'Acumulado',
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                data: cumPct
            }
        ]
    };
}

export function stackedBarOption(categories, series) {
    return {
        color: CHART_PALETTE,
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter(params) {
                return params.map(p => `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)}`).join('<br>') + DRILL_HINT;
            }
        },
        legend: { bottom: 0, textStyle: { fontSize: 10 } },
        grid: { ...baseGrid, bottom: 52 },
        xAxis: {
            type: 'category',
            data: categories,
            axisLabel: { fontSize: 10, interval: 0, rotate: categories.length > 4 ? 15 : 0 }
        },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: compactAxisMoney } },
        series: series.map(s => ({
            name: s.name,
            type: 'bar',
            stack: 'total',
            barMaxWidth: 40,
            data: s.data
        }))
    };
}

export function heatmapOption(xLabels, yLabels, matrix) {
    const data = [];
    matrix.forEach((row, yi) => {
        row.forEach((val, xi) => {
            if (val > 0) data.push([xi, yi, val]);
        });
    });
    const maxVal = Math.max(...data.map(d => d[2]), 1);

    return {
        tooltip: {
            position: 'top',
            formatter(p) {
                return `${yLabels[p.data[1]]} · ${xLabels[p.data[0]]}<br>Custo: ${formatCurrency(p.data[2])}${DRILL_HINT}`;
            }
        },
        grid: { left: 72, right: 16, top: 16, bottom: 48 },
        xAxis: {
            type: 'category',
            data: xLabels,
            splitArea: { show: true },
            axisLabel: { fontSize: 10, interval: 0 }
        },
        yAxis: {
            type: 'category',
            data: yLabels,
            splitArea: { show: true },
            axisLabel: { fontSize: 10 }
        },
        visualMap: {
            min: 0,
            max: maxVal,
            calculable: false,
            orient: 'horizontal',
            left: 'center',
            bottom: 0,
            inRange: { color: ['#e8f3ec', '#40916c', '#1b4332'] },
            textStyle: { fontSize: 10 },
            formatter: compactAxisMoney
        },
        series: [{
            type: 'heatmap',
            data,
            label: { show: false },
            emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' } }
        }]
    };
}

export function lineAreaOption(labels, values, opts = {}) {
    return {
        color: [CHART_COLORS.primary],
        tooltip: {
            trigger: 'axis',
            formatter: p => `${p[0].axisValue}<br>Saldo: ${formatCurrency(p[0].value)}${DRILL_HINT}`
        },
        grid: { ...baseGrid, bottom: 48 },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { fontSize: 9, rotate: opts.rotate || 30, interval: opts.interval || 'auto' }
        },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: compactAxisMoney } },
        series: [{
            type: 'line',
            smooth: true,
            data: values,
            areaStyle: { opacity: 0.12 },
            lineStyle: { width: 2.5 }
        }]
    };
}

export function comboBarLineOption(categories, barSeries, lineSeries) {
    return {
        color: CHART_PALETTE,
        tooltip: {
            trigger: 'axis',
            formatter: params => params.map(p => `${p.marker} ${p.seriesName}: ${p.value}`).join('<br>') + DRILL_HINT
        },
        legend: { bottom: 0, textStyle: { fontSize: 10 } },
        grid: { ...baseGrid, bottom: 52 },
        xAxis: { type: 'category', data: categories, axisLabel: { fontSize: 10 } },
        yAxis: [
            { type: 'value', axisLabel: { fontSize: 10, formatter: compactAxisMoney } },
            { type: 'value', name: 'h', axisLabel: { fontSize: 10 } }
        ],
        series: [
            ...barSeries.map(s => ({
                name: s.name,
                type: 'bar',
                data: s.data,
                barMaxWidth: 28
            })),
            ...lineSeries.map(s => ({
                name: s.name,
                type: 'line',
                yAxisIndex: 1,
                smooth: true,
                data: s.data
            }))
        ]
    };
}

export function donutOption(items, valueFormatter = formatCurrency) {
    return {
        color: CHART_PALETTE,
        tooltip: { formatter: p => `${p.name}: ${valueFormatter(p.value)} (${formatPct(p.percent)})` },
        legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { fontSize: 10 } },
        series: [{
            type: 'pie',
            radius: ['42%', '68%'],
            center: ['40%', '50%'],
            avoidLabelOverlap: true,
            label: { show: false },
            data: items
        }]
    };
}
