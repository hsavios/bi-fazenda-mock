/**
 * Visualizações — Performance da Safra.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber
} from './api.js?v=5.5.1';
import {
    paretoOption,
    horizontalBarOption,
    heatmapOption
} from './charts.js?v=5.5.1';
import { CHART_COLORS } from './charts.js?v=5.5.1';

const GRIDS = {
    scatter: { left: 56, right: 28, top: 36, bottom: 56, containLabel: true },
    horizontal: { left: 110, right: 32, top: 24, bottom: 40, containLabel: true },
    heatmap: { left: 80, right: 32, top: 24, bottom: 54, containLabel: true },
    pareto: { left: 56, right: 48, top: 36, bottom: 56, containLabel: true },
    bar: { left: 56, right: 28, top: 24, bottom: 40, containLabel: true }
};

function withGrid(option, gridKey) {
    return { ...option, grid: { ...GRIDS[gridKey], ...(option.grid || {}) } };
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
    const sortedCusto = [...(talhoes || [])].sort((a, b) => Number(b.custo_total) - Number(a.custo_total));
    const paretoSlice = sortedCusto.slice(0, 8);
    const paretoCodes = paretoSlice.map(t => t.talhao_codigo);
    if (paretoSlice.length) {
        setChart('chart-pareto-talhao', withGrid(
            paretoOption(paretoCodes, paretoSlice.map(t => Number(t.custo_total))),
            'pareto'
        ));
        bindTalhaoChart(charts['chart-pareto-talhao'], paretoCodes, onDrill, true);
    }

    const culturas = [...new Set((talhoes || []).map(t => t.cultura_nome))].sort();
    const talhaoCodes = [...new Set((talhoes || []).map(t => t.talhao_codigo))].slice(0, 10);
    const heatMatrix = talhaoCodes.map(tc =>
        culturas.map(cult => {
            const row = rows.find(r => r.talhao_codigo === tc && r.cultura_nome === cult);
            return row ? Number(row.custo_ha) : 0;
        })
    );
    if (talhaoCodes.length && culturas.length) {
        const heatOpt = withGrid(heatmapOption(culturas, talhaoCodes, heatMatrix), 'heatmap');
        heatOpt.grid = { ...GRIDS.heatmap, bottom: 72 };
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

    const byResult = [...rows].sort((a, b) => Number(b.resultado) - Number(a.resultado)).slice(0, 8);
    if (byResult.length) {
        setChart('chart-ranking-talhao', withGrid(
            horizontalBarOption(
                byResult.map(r => r.talhao_codigo),
                byResult.map(r => Number(r.resultado)),
                { color: CHART_COLORS.light, formatter: v => formatCurrency(v) }
            ),
            'horizontal'
        ));
        bindTalhaoChart(charts['chart-ranking-talhao'], byResult.map(r => r.talhao_codigo), onDrill, false);
    }

    const scatterRows = rows.filter(r => r.area_ha > 0).slice(0, 20);
    if (scatterRows.length) {
        setChart('chart-scatter-prod-custo', {
            color: CHART_COLORS,
            tooltip: {
                formatter(p) {
                    const d = p.data;
                    return `<strong>${d.name}</strong><br>
                        Produtividade: ${formatNumber(d.value[0], 1)} sc/ha<br>
                        Custo/ha: ${formatCurrency(d.value[1])}<br>
                        Resultado/ha: ${formatCurrencyCompact(d.resultadoHa)}`;
                }
            },
            grid: GRIDS.scatter,
            xAxis: {
                name: 'Produtividade sc/ha',
                nameGap: 28,
                nameTextStyle: { fontSize: 10 },
                axisLabel: { fontSize: 10 }
            },
            yAxis: {
                name: 'Custo/ha',
                nameGap: 36,
                nameTextStyle: { fontSize: 10 },
                axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) }
            },
            series: [{
                type: 'scatter',
                symbolSize: d => Math.max(14, Math.min(48, Math.sqrt(Math.abs(d[2])) / 120)),
                data: scatterRows.map(r => ({
                    name: r.talhao_codigo,
                    value: [r.produtividade_sc_ha, r.custo_ha, Math.abs(r.resultado)],
                    resultadoHa: r.resultado_ha,
                    itemStyle: { color: r.resultado >= 0 ? '#2d6a4f' : '#c1121f' }
                }))
            }]
        });
        const scChart = charts['chart-scatter-prod-custo'];
        scChart?.off('click');
        scChart?.on('click', p => {
            if (p.data?.name) onDrill?.('talhaoPerformance', { talhaoCodigo: p.data.name });
        });
    }

    const ganhoSorted = [...rows].sort((a, b) => Number(b.ganho_perda_valor_vs_media) - Number(a.ganho_perda_valor_vs_media));
    const gpTop = ganhoSorted.slice(0, 6);
    const gpBottom = [...rows].sort((a, b) => Number(a.ganho_perda_valor_vs_media) - Number(b.ganho_perda_valor_vs_media)).slice(0, 4);
    const gpChart = [...gpTop, ...gpBottom.filter(r => !gpTop.includes(r))].slice(0, 10);
    if (gpChart.length) {
        setChart('chart-ganho-perda', {
            grid: GRIDS.horizontal,
            tooltip: {
                trigger: 'axis',
                formatter: p => `${p[0].name}: ${formatCurrencyCompact(p[0].value)}`
            },
            xAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) } },
            yAxis: { type: 'category', data: gpChart.map(r => r.talhao_codigo), axisLabel: { fontSize: 11 } },
            series: [{
                type: 'bar',
                barMaxWidth: 22,
                data: gpChart.map(r => ({
                    value: Number(r.ganho_perda_valor_vs_media),
                    itemStyle: { color: r.ganho_perda_valor_vs_media >= 0 ? '#2d6a4f' : '#c1121f' }
                }))
            }]
        });
        bindTalhaoChart(charts['chart-ganho-perda'], gpChart.map(r => r.talhao_codigo), onDrill, false);
    }
}

function bindTalhaoChart(chart, codes, onDrill, paretoMode) {
    chart?.off('click');
    chart?.on('click', params => {
        if (paretoMode && params.seriesName === 'Acumulado') {
            onDrill?.('costConcentration', { talhaoCodes: codes, dataIndex: params.dataIndex });
            return;
        }
        const code = params.name || codes[params.dataIndex];
        if (code) onDrill?.('talhaoPerformance', { talhaoCodigo: code });
    });
}
