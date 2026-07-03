/**
 * Visualizações — Performance da Safra.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct
} from './api.js?v=5.10';
import {
    paretoOption,
    horizontalBarOption,
    heatmapOption
} from './charts.js?v=5.10';
import { CHART_COLORS } from './charts.js?v=5.10';

const GRIDS = {
    scatter: { left: 76, right: 30, top: 36, bottom: 60, containLabel: true },
    ganhoPerda: { left: 110, right: 36, top: 28, bottom: 44, containLabel: true },
    pareto: { left: 70, right: 58, top: 36, bottom: 62, containLabel: true },
    heatmap: { left: 86, right: 34, top: 34, bottom: 64, containLabel: true },
    ranking: { left: 110, right: 40, top: 30, bottom: 42, containLabel: true }
};

function withGrid(option, grid) {
    return { ...option, grid: { ...grid, ...(option.grid || {}) } };
}

function truncLabel(label, max = 14) {
    const s = String(label || '');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function showVizEmpty(chartId, charts, message) {
    const node = document.getElementById(chartId);
    if (!node) return;
    const body = node.closest('.bi-chart-card__body');
    if (!body) return;

    body.querySelector('.operations-chart-empty-host')?.remove();
    node.classList.add('hidden');

    if (charts[chartId]) {
        charts[chartId].dispose();
        delete charts[chartId];
    }

    const empty = document.createElement('div');
    empty.className = 'operations-chart-empty-host';
    empty.textContent = message;
    body.appendChild(empty);
}

function clearVizEmpty(chartId) {
    const node = document.getElementById(chartId);
    if (!node) return;
    node.classList.remove('hidden');
    node.closest('.bi-chart-card__body')?.querySelector('.operations-chart-empty-host')?.remove();
}

function renderScatter({ rows, charts, setChart, onDrill }) {
    clearVizEmpty('chart-scatter-prod-custo');
    const scatterRows = rows.filter(r => r.area_ha > 0);
    if (!scatterRows.length) return;

    setChart('chart-scatter-prod-custo', {
        color: CHART_COLORS,
        tooltip: {
            trigger: 'item',
            formatter(p) {
                const d = p.data;
                return `<strong>${d.talhao}</strong><br>
                    Cultura: ${d.cultura}<br>
                    Produtividade: ${formatNumber(d.value[0], 1)} sc/ha<br>
                    Custo/ha: ${formatCurrency(d.value[1])}<br>
                    Resultado/ha: ${formatCurrency(d.resultadoHa)}<br>
                    Margem: ${formatPct(d.margemPct)}`;
            }
        },
        grid: GRIDS.scatter,
        xAxis: {
            type: 'value',
            name: 'Produtividade sc/ha',
            nameLocation: 'middle',
            nameGap: 28,
            nameTextStyle: { fontSize: 10 },
            axisLabel: { fontSize: 10 }
        },
        yAxis: {
            type: 'value',
            name: 'Custo/ha',
            nameLocation: 'middle',
            nameGap: 52,
            nameTextStyle: { fontSize: 10 },
            axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) }
        },
        series: [{
            type: 'scatter',
            symbolSize: d => Math.max(18, Math.min(48, Math.sqrt(Math.abs(d[2])) / 90)),
            data: scatterRows.map(r => ({
                name: r.talhao_codigo,
                talhao: r.talhao_codigo,
                cultura: r.cultura_nome,
                value: [r.produtividade_sc_ha, r.custo_ha, Math.abs(r.resultado)],
                resultadoHa: r.resultado_ha,
                margemPct: r.margem_pct,
                itemStyle: { color: r.resultado >= 0 ? '#2d6a4f' : '#c1121f' }
            }))
        }]
    });

    const scChart = charts['chart-scatter-prod-custo'];
    scChart?.off('click');
    scChart?.on('click', p => {
        if (p.data?.talhao) onDrill?.('talhaoPerformance', { talhaoCodigo: p.data.talhao, cultura: p.data.cultura });
    });
}

function renderGanhoPerda({ rows, charts, setChart, onDrill }) {
    clearVizEmpty('chart-ganho-perda');
    const gpChart = [...rows]
        .sort((a, b) => Math.abs(Number(b.ganho_perda_valor_vs_media)) - Math.abs(Number(a.ganho_perda_valor_vs_media)))
        .slice(0, 10);

    if (!gpChart.length) return;

    const maxAbs = Math.max(...gpChart.map(r => Math.abs(Number(r.ganho_perda_valor_vs_media))), 0);
    if (maxAbs < 1) {
        showVizEmpty(
            'chart-ganho-perda',
            charts,
            'Sem desvio econômico relevante de produtividade no recorte atual.'
        );
        return;
    }

    const gpLabels = gpChart.map(r => r.talhao_codigo);
    const displayLabels = gpLabels.map(l => truncLabel(l, 12));

    setChart('chart-ganho-perda', {
        grid: GRIDS.ganhoPerda,
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: p => {
                const idx = p[0].dataIndex;
                const row = gpChart[idx];
                return `<strong>${row.talhao_codigo}</strong> · ${row.cultura_nome}<br>
                    Impacto: ${formatCurrencyCompact(p[0].value)}<br>
                    Desvio prod.: ${formatPct(row.desvio_produtividade_pct)}`;
            }
        },
        xAxis: {
            type: 'value',
            axisLine: { onZero: true, lineStyle: { color: '#94a3b8' } },
            axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) },
            splitLine: { lineStyle: { type: 'dashed', color: '#e2e8f0' } }
        },
        yAxis: {
            type: 'category',
            data: displayLabels,
            axisLabel: { fontSize: 11, width: 96, overflow: 'truncate' },
            inverse: true
        },
        series: [{
            type: 'bar',
            barMaxWidth: 22,
            data: gpChart.map(r => ({
                value: Number(r.ganho_perda_valor_vs_media),
                itemStyle: { color: r.ganho_perda_valor_vs_media >= 0 ? '#2d6a4f' : '#c1121f' }
            }))
        }]
    });
    bindTalhaoChart(charts['chart-ganho-perda'], gpLabels, onDrill, false);
}

function renderPareto({ talhoes, charts, setChart, onDrill }) {
    const sortedCusto = [...(talhoes || [])].sort((a, b) => Number(b.custo_total) - Number(a.custo_total));
    const paretoSlice = sortedCusto.slice(0, 8);
    const paretoCodes = paretoSlice.map(t => t.talhao_codigo);
    if (!paretoSlice.length) return;

    const paretoOpt = withGrid(
        paretoOption(paretoCodes, paretoSlice.map(t => Number(t.custo_total))),
        GRIDS.pareto
    );
    paretoOpt.xAxis = {
        ...paretoOpt.xAxis,
        axisLabel: {
            fontSize: 10,
            interval: 0,
            rotate: paretoCodes.length > 5 ? 22 : 0,
            formatter: v => truncLabel(v, 10)
        }
    };
    paretoOpt.yAxis = [
        { ...paretoOpt.yAxis[0], axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) } },
        { ...paretoOpt.yAxis[1], min: 0, max: 100, axisLabel: { fontSize: 10, formatter: v => `${v}%` } }
    ];

    setChart('chart-pareto-talhao', paretoOpt);
    bindTalhaoChart(charts['chart-pareto-talhao'], paretoCodes, onDrill, true);
}

function renderHeatmap({ rows, talhoes, charts, setChart, onDrill }) {
    const culturas = [...new Set((talhoes || []).map(t => t.cultura_nome))].sort();
    const talhaoCodes = [...new Set((talhoes || []).map(t => t.talhao_codigo))].slice(0, 10);
    if (!talhaoCodes.length || !culturas.length) return;

    const heatMatrix = talhaoCodes.map(tc =>
        culturas.map(cult => {
            const row = rows.find(r => r.talhao_codigo === tc && r.cultura_nome === cult);
            return row ? Number(row.custo_ha) : 0;
        })
    );

    const heatOpt = withGrid(heatmapOption(culturas, talhaoCodes, heatMatrix), GRIDS.heatmap);
    heatOpt.xAxis = {
        ...heatOpt.xAxis,
        axisLabel: { fontSize: 10, interval: 0, formatter: v => truncLabel(v, 12) }
    };
    heatOpt.yAxis = {
        ...heatOpt.yAxis,
        axisLabel: { fontSize: 10, formatter: v => truncLabel(v, 12) }
    };
    heatOpt.visualMap = {
        ...heatOpt.visualMap,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemWidth: 120,
        itemHeight: 10
    };

    setChart('chart-heatmap-talhao', heatOpt);
    const heatChart = charts['chart-heatmap-talhao'];
    heatChart?.off('click');
    heatChart?.on('click', params => {
        const d = params.data;
        if (!d || d.length < 2) return;
        const cultura = culturas[d[0]];
        const talhao = talhaoCodes[d[1]];
        if (cultura && talhao) onDrill?.('talhaoPerformance', { talhaoCodigo: talhao, cultura });
    });
}

function renderRanking({ rows, charts, setChart, onDrill }) {
    const byResult = [...rows].sort((a, b) => Number(b.resultado) - Number(a.resultado)).slice(0, 8);
    if (!byResult.length) return;

    const labels = byResult.map(r => r.talhao_codigo);
    const displayLabels = labels.map(l => truncLabel(l, 12));

    setChart('chart-ranking-talhao', withGrid(
        horizontalBarOption(
            displayLabels,
            byResult.map(r => Number(r.resultado)),
            {
                color: CHART_COLORS.light,
                formatter: v => formatCurrency(v),
                tooltipNames: labels,
                maxWidth: 22
            }
        ),
        GRIDS.ranking
    ));
    bindTalhaoChart(charts['chart-ranking-talhao'], labels, onDrill, false);
}

export function renderOperacoesVisualizacoes({
    model,
    talhoes,
    charts,
    setChart,
    onDrill,
    drawChart = false
}) {
    if (!drawChart) return;

    const { rows } = model;

    renderScatter({ rows, charts, setChart, onDrill });
    renderGanhoPerda({ rows, charts, setChart, onDrill });
    renderPareto({ talhoes, charts, setChart, onDrill });
    renderHeatmap({ rows, talhoes, charts, setChart, onDrill });
    renderRanking({ rows, charts, setChart, onDrill });
}

function bindTalhaoChart(chart, codes, onDrill, paretoMode) {
    chart?.off('click');
    chart?.on('click', params => {
        if (paretoMode && params.seriesName === 'Acumulado') {
            onDrill?.('costConcentration', { talhaoCodes: codes, dataIndex: params.dataIndex });
            return;
        }
        const code = params.name || codes[params.dataIndex];
        const full = codes.find(c => c === code || truncLabel(c, 12) === code || truncLabel(c, 10) === code) || code;
        if (full) onDrill?.('talhaoPerformance', { talhaoCodigo: full });
    });
}
