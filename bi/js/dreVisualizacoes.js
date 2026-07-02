/**
 * Visualizações Contábeis — gráficos e insights (fora do demonstrativo).
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatPct
} from './api.js?v=5.3';
import { renderInsightCards } from './insights.js?v=5.3';
import { horizontalBarOption } from './charts.js?v=5.3';

function buildInsights(lines, culturaComp) {
    const get = name => lines.find(l => l.linha_dre === name)?.valor || 0;
    const receitaLiq = get('Receita líquida');
    const custosVar = Math.abs(get('Custos variáveis'));
    const resLiq = get('Resultado líquido gerencial');
    const insights = [];
    if (receitaLiq > 0) {
        insights.push({
            title: 'Margem líquida gerencial',
            text: `O resultado líquido contábil representa ${formatPct((resLiq / receitaLiq) * 100)} da receita líquida no recorte.`,
            tone: resLiq >= 0 ? 'positive' : 'critical'
        });
    }
    if (custosVar > 0 && receitaLiq > 0) {
        insights.push({
            title: 'Peso dos custos variáveis',
            text: `Custos variáveis (CPV) correspondem a ${formatPct((custosVar / receitaLiq) * 100)} da receita líquida.`,
            tone: 'info'
        });
    }
    const top = [...(culturaComp || [])].sort((a, b) => Number(b.receita_liquida) - Number(a.receita_liquida))[0];
    if (top) {
        insights.push({
            title: 'Concentração por cultura',
            text: `${top.cultura_nome} lidera a receita líquida contábil com ${formatCurrencyCompact(top.receita_liquida)}.`,
            tone: 'positive'
        });
    }
    return insights.slice(0, 4);
}

function renderWaterfall(container, lines, onDrill) {
    if (!container || typeof echarts === 'undefined') return null;
    const pick = names => names.reduce((s, n) => s + (lines.find(l => l.linha_dre === n)?.valor || 0), 0);
    const steps = [
        { label: 'Receita bruta', value: pick(['Receita bruta']) },
        { label: 'Deduções', value: pick(['Deduções']) },
        { label: 'Custos var.', value: pick(['Custos variáveis']) },
        { label: 'Custos fixos', value: pick(['Custos fixos']) },
        { label: 'Despesas', value: pick(['Despesas comerciais', 'Despesas administrativas']) },
        { label: 'Depreciação', value: pick(['Depreciação/amortização']) },
        { label: 'Financeiro', value: pick(['Resultado financeiro']) },
        { label: 'Tributos', value: pick(['Tributos']) },
        { label: 'Resultado líquido', value: pick(['Resultado líquido gerencial']) }
    ];

    const chart = echarts.getInstanceByDom(container) || echarts.init(container);
    chart.setOption({
        tooltip: {
            trigger: 'item',
            formatter: p => `${p.name}<br>${formatCurrency(p.value)}<br><span style="opacity:.7;font-size:10px">Clique para detalhar</span>`
        },
        grid: { left: 52, right: 16, top: 20, bottom: 48 },
        xAxis: { type: 'category', data: steps.map(s => s.label), axisLabel: { fontSize: 9, rotate: 24, color: '#5a6b5e' } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v), color: '#5a6b5e' }, splitLine: { lineStyle: { color: '#e8efe9' } } },
        series: [{
            type: 'bar',
            barMaxWidth: 40,
            data: steps.map(s => ({
                value: Math.abs(s.value),
                itemStyle: { color: s.value >= 0 ? '#2d6a4f' : '#c1121f', borderRadius: [4, 4, 0, 0] }
            }))
        }]
    }, true);
    chart.off('click');
    chart.on('click', p => { if (p.name) onDrill?.('dreLine', { label: p.name, linha: p.name }); });
    return chart;
}

function custosPorGrupo(contabilRows) {
    const map = new Map();
    (contabilRows || []).forEach(r => {
        if (Number(r.ordem_grupo) < 40) return;
        const g = r.grupo_dre || 'Outros';
        map.set(g, (map.get(g) || 0) + Math.abs(Number(r.valor || 0)));
    });
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value }));
}

export function renderDreVisualizacoes({
    lines,
    data,
    charts,
    setChart,
    onDrill,
    drawChart = false
}) {
    renderInsightCards(
        document.getElementById('insights-dre-visualizacoes'),
        buildInsights(lines, data.dreCulturaComp)
    );

    if (!drawChart || typeof echarts === 'undefined') return;

    const wf = document.getElementById('chart-dre-waterfall');
    if (wf) {
        const c = renderWaterfall(wf, lines, onDrill);
        if (c && charts) charts['chart-dre-waterfall'] = c;
    }

    const custos = custosPorGrupo(data.dreContabil);
    const elCustos = document.getElementById('chart-dre-custos');
    if (elCustos && custos.length) {
        setChart('chart-dre-custos', horizontalBarOption(
            custos.map(c => c.label),
            custos.map(c => c.value),
            { color: '#c1121f', formatter: v => formatCurrencyCompact(v) }
        ));
    }

    const cultura = [...(data.dreCulturaComp || [])].sort((a, b) => Number(b.resultado_liquido) - Number(a.resultado_liquido));
    const elRes = document.getElementById('chart-dre-resultado-cultura');
    if (elRes && cultura.length) {
        setChart('chart-dre-resultado-cultura', horizontalBarOption(
            cultura.map(c => c.cultura_nome),
            cultura.map(c => Number(c.resultado_liquido || 0)),
            { color: '#2d6a4f', formatter: v => formatCurrencyCompact(v) }
        ));
    }

    const elMarg = document.getElementById('chart-dre-margem-cultura');
    if (elMarg && cultura.length) {
        setChart('chart-dre-margem-cultura', horizontalBarOption(
            cultura.map(c => c.cultura_nome),
            cultura.map(c => Number(c.margem_liquida_pct || 0)),
            { color: '#40916c', formatter: v => formatPct(v) }
        ));
    }
}
