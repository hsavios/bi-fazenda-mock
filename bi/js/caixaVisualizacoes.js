/**
 * Visualizações de Caixa — gráficos e insights (fora da matriz).
 */
import {
    formatCurrency,
    formatCurrencyCompact
} from './api.js?v=5.5';
import { buildCashInsights } from './decisionQuestions.js?v=5.5';
import { renderInsightCards } from './insights.js?v=5.5';
import { lineAreaOption, horizontalBarOption } from './charts.js?v=5.5';

export function renderCaixaVisualizacoes({
    months,
    fluxo,
    charts,
    setChart,
    onDrill,
    drawChart = false
}) {
    renderInsightCards(
        document.getElementById('insights-caixa-viz'),
        buildCashInsights(months)
    );

    if (!drawChart || !months.length) return;

    const labels = months.map(m => m.monthLabel);

    setChart('chart-caixa-saldo', lineAreaOption(
        labels,
        months.map(m => m.saldoAcumulado),
        { rotate: labels.length > 6 ? 28 : 0, interval: Math.max(0, Math.floor(labels.length / 6)) }
    ));
    const saldoChart = charts['chart-caixa-saldo'];
    saldoChart?.off('click');
    saldoChart?.on('click', params => {
        const m = months[params.dataIndex];
        if (m) onDrill?.('cashMatrixCell', { monthKey: m.monthKey, indicator: 'saldo_acumulado', monthLabel: m.monthLabel });
    });

    setChart('chart-caixa-entradas-saidas', {
        color: ['#2d6a4f', '#c1121f'],
        tooltip: {
            trigger: 'axis',
            formatter: params => params.map(p => `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)}`).join('<br>')
                + '<br><span style="opacity:.7;font-size:10px">Clique para detalhar</span>'
        },
        legend: { bottom: 0, textStyle: { fontSize: 10 } },
        grid: { left: 48, right: 16, top: 20, bottom: 52 },
        xAxis: {
            type: 'category',
            data: labels,
            axisLabel: { fontSize: 10, rotate: labels.length > 6 ? 15 : 0 }
        },
        yAxis: {
            type: 'value',
            axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) }
        },
        series: [
            { name: 'Entradas', type: 'bar', data: months.map(m => m.entradas), barMaxWidth: 28 },
            { name: 'Saídas', type: 'bar', data: months.map(m => m.saidas), barMaxWidth: 28 }
        ]
    });
    const comboChart = charts['chart-caixa-entradas-saidas'];
    comboChart?.off('click');
    comboChart?.on('click', params => {
        const m = months[params.dataIndex];
        if (!m) return;
        const indicator = params.seriesName === 'Entradas' ? 'entradas' : 'saidas';
        onDrill?.('cashMatrixCell', { monthKey: m.monthKey, indicator, monthLabel: m.monthLabel });
    });

    const pressaoSorted = [...months].sort((a, b) => b.pressao - a.pressao).slice(0, 6);
    setChart('chart-caixa-pressao', horizontalBarOption(
        pressaoSorted.map(m => m.monthLabel),
        pressaoSorted.map(m => m.pressao),
        { color: '#c1121f' }
    ));
    const pressaoChart = charts['chart-caixa-pressao'];
    pressaoChart?.off('click');
    pressaoChart?.on('click', params => {
        const m = pressaoSorted[params.dataIndex];
        if (m) onDrill?.('cashMatrixCell', { monthKey: m.monthKey, indicator: 'saidas', monthLabel: m.monthLabel });
    });
}
