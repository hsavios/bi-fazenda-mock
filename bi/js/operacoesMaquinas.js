/**
 * Sub-aba Máquinas — demonstrativo de recursos operacionais.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct,
    sumField
} from './api.js?v=5.10';
import { horizontalBarOption, comboBarLineOption } from './charts.js?v=5.10';

const GRIDS = {
    combo: { left: 72, right: 64, top: 38, bottom: 72, containLabel: true },
    ranking: { left: 170, right: 34, top: 30, bottom: 42, containLabel: true }
};

function withGrid(option, grid) {
    return { ...option, grid: { ...grid, ...(option.grid || {}) } };
}

function truncLabel(label, max = 14) {
    const s = String(label || '');
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function renderMaquinasKpis(container, maquinas, onDrill) {
    if (!container) return;
    const sorted = [...(maquinas || [])].sort((a, b) => Number(b.custo_total) - Number(a.custo_total));
    const totalCusto = sumField(sorted, 'custo_total');
    const totalHoras = sumField(sorted, 'horas_totais');
    const custoHora = totalHoras ? totalCusto / totalHoras : 0;
    const topCusto = sorted[0];
    const topHoras = [...sorted].sort((a, b) => Number(b.horas_totais) - Number(a.horas_totais))[0];

    const items = [
        { label: 'Custo total máquinas', value: formatCurrencyCompact(totalCusto), tone: 'warn', drill: 'machineFleet', metric: 'custo' },
        { label: 'Horas totais', value: formatNumber(totalHoras, 0) + ' h', tone: 'default', drill: 'machineFleet', metric: 'horas' },
        { label: 'Custo/hora médio', value: formatCurrencyCompact(custoHora), tone: 'warn', drill: 'machineFleet', metric: 'custoHora' },
        {
            label: 'Máquina mais onerosa',
            value: truncLabel(topCusto?.equipamento_nome, 18) || '—',
            hint: topCusto ? formatCurrencyCompact(topCusto.custo_total) : '',
            tone: 'critical',
            drill: 'machine',
            machine: topCusto?.equipamento_nome
        },
        {
            label: 'Máquina mais usada',
            value: truncLabel(topHoras?.equipamento_nome, 18) || '—',
            hint: topHoras ? formatNumber(topHoras.horas_totais, 0) + ' h' : '',
            tone: 'positive',
            drill: 'machine',
            machine: topHoras?.equipamento_nome
        }
    ];

    container.innerHTML = items.map(it => `
        <div class="field-kpi-card field-kpi-card--${it.tone} field-kpi-card--clickable"
             data-maquina-kpi="${it.drill}"
             ${it.metric ? `data-metric="${it.metric}"` : ''}
             ${it.machine ? `data-machine="${it.machine}"` : ''}
             role="button" tabindex="0" aria-label="Detalhar ${it.label}">
            <span class="field-kpi-label">${it.label}</span>
            <span class="field-kpi-value">${it.value}</span>
            ${it.hint ? `<span class="field-kpi-hint">${it.hint}</span>` : ''}
            <span class="field-kpi-action">Ver detalhe ›</span>
        </div>
    `).join('');

    container.querySelectorAll('[data-maquina-kpi]').forEach(node => {
        const open = () => {
            if (node.dataset.machine) {
                onDrill?.('machine', { equipamento: node.dataset.machine });
            } else {
                onDrill?.('machineFleet', { metric: node.dataset.metric });
            }
        };
        node.addEventListener('click', open);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

function renderMaquinasTable(tableHost, sorted, totalCusto, onDrill) {
    if (!tableHost) return;
    if (!sorted.length) {
        tableHost.innerHTML = '<div class="field-empty-state"><p>Sem dados de máquinas no recorte.</p></div>';
        return;
    }

    tableHost.innerHTML = `
        <table class="machine-table">
            <thead>
                <tr>
                    <th>Máquina</th>
                    <th>Categoria</th>
                    <th class="machine-table__num">Horas</th>
                    <th class="machine-table__num">Custo</th>
                    <th class="machine-table__num">Custo/h</th>
                    <th class="machine-table__num">Participação</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(m => {
                    const custoH = m.horas_totais ? Number(m.custo_total) / Number(m.horas_totais) : 0;
                    const pct = totalCusto ? (Number(m.custo_total) / totalCusto) * 100 : 0;
                    const tone = pct > 25 ? 'critical' : pct > 15 ? 'warn' : 'positive';
                    const chip = pct > 25 ? 'Alta participação' : pct > 15 ? 'Relevante' : 'Normal';
                    return `
                    <tr tabindex="0" data-machine="${m.equipamento_nome}" aria-label="Detalhar ${m.equipamento_nome}">
                        <td><span class="machine-table__name">${m.equipamento_nome}</span></td>
                        <td>${m.categoria || '—'}</td>
                        <td class="machine-table__num">${formatNumber(m.horas_totais, 0)} h</td>
                        <td class="machine-table__num">${formatCurrencyCompact(m.custo_total)}</td>
                        <td class="machine-table__num">${formatCurrencyCompact(custoH)}</td>
                        <td class="machine-table__num">${formatPct(pct)}</td>
                        <td><span class="performance-chip performance-chip--${tone}">${chip}</span></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;

    tableHost.querySelectorAll('[data-machine]').forEach(row => {
        const open = () => onDrill?.('machine', { equipamento: row.dataset.machine });
        row.addEventListener('click', open);
        row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

export function isMaquinasVizOpen() {
    return document.getElementById('field-maquinas-viz-accordion')?.open === true;
}

export function initMaquinasAccordionDefault() {
    const acc = document.getElementById('field-maquinas-viz-accordion');
    if (!acc || acc.dataset.defaultSet) return;
    acc.dataset.defaultSet = '1';

    const openOnLarge = window.matchMedia('(min-width: 1280px) and (min-height: 720px)').matches;
    if (openOnLarge) acc.open = true;

    acc.addEventListener('toggle', () => {
        acc.dataset.userToggled = '1';
    });
}

export function renderOperacoesMaquinas({ maquinas, charts, setChart, onDrill, drawChart = false }) {
    const sorted = [...(maquinas || [])].sort((a, b) => Number(b.custo_total) - Number(a.custo_total));
    const totalCusto = sumField(sorted, 'custo_total');

    renderMaquinasKpis(document.getElementById('kpi-maquinas'), sorted, onDrill);
    renderMaquinasTable(document.getElementById('field-maquinas-table'), sorted, totalCusto, onDrill);

    if (!drawChart || !sorted.length) return;

    const top = sorted.slice(0, 8);
    const fullNames = top.map(m => m.equipamento_nome);
    const shortNames = fullNames.map(n => truncLabel(n, 12));
    const rotateLabels = shortNames.length > 4 ? 20 : 0;

    const comboOpt = withGrid(
        comboBarLineOption(
            shortNames,
            [{ name: 'Custo (R$)', data: top.map(m => Number(m.custo_total)) }],
            [{ name: 'Horas', data: top.map(m => Number(m.horas_totais)) }]
        ),
        GRIDS.combo
    );
    comboOpt.tooltip = {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: params => {
            const idx = params[0]?.dataIndex ?? 0;
            const name = fullNames[idx] || params[0]?.name;
            const lines = params.map(p =>
                `${p.marker} ${p.seriesName}: ${p.seriesName === 'Custo (R$)' ? formatCurrencyCompact(p.value) : formatNumber(p.value, 0) + ' h'}`
            );
            return `<strong>${name}</strong><br>${lines.join('<br>')}`;
        }
    };
    comboOpt.legend = { bottom: 4, textStyle: { fontSize: 10 }, itemWidth: 14, itemHeight: 8 };
    comboOpt.xAxis = {
        ...comboOpt.xAxis,
        axisLabel: {
            fontSize: 10,
            interval: 0,
            rotate: rotateLabels,
            formatter: v => truncLabel(v, 12)
        }
    };
    comboOpt.yAxis = [
        {
            ...comboOpt.yAxis[0],
            name: 'R$',
            nameTextStyle: { fontSize: 10 },
            axisLabel: { fontSize: 10, formatter: v => formatCurrencyCompact(v) }
        },
        {
            ...comboOpt.yAxis[1],
            name: 'Horas',
            nameTextStyle: { fontSize: 10 },
            axisLabel: { fontSize: 10, formatter: v => formatNumber(v, 0) }
        }
    ];
    comboOpt.series = comboOpt.series.map((s, i) => ({
        ...s,
        barMaxWidth: i === 0 ? 32 : undefined,
        symbolSize: i === 1 ? 7 : undefined,
        lineStyle: i === 1 ? { width: 2 } : undefined
    }));

    setChart('chart-maquinas-viz', comboOpt);
    const mChart = charts['chart-maquinas-viz'];
    mChart?.off('click');
    mChart?.on('click', p => {
        const m = top[p.dataIndex];
        if (m) onDrill?.('machine', { equipamento: m.equipamento_nome });
    });

    const byCustoHora = [...sorted]
        .map(m => ({ ...m, custoH: m.horas_totais ? Number(m.custo_total) / Number(m.horas_totais) : 0 }))
        .sort((a, b) => b.custoH - a.custoH)
        .slice(0, 8);
    const rankNames = byCustoHora.map(m => m.equipamento_nome);
    const rankDisplay = rankNames.map(n => truncLabel(n, 22));
    const barWidth = byCustoHora.length <= 3 ? 28 : 22;

    const rankOpt = withGrid(
        horizontalBarOption(
            rankDisplay,
            byCustoHora.map(m => m.custoH),
            {
                formatter: v => formatCurrencyCompact(v),
                tooltipNames: rankNames,
                maxWidth: barWidth
            }
        ),
        GRIDS.ranking
    );
    rankOpt.yAxis = {
        ...rankOpt.yAxis,
        inverse: true,
        axisLabel: {
            fontSize: 11,
            width: 150,
            overflow: 'truncate',
            formatter: v => truncLabel(v, 22)
        }
    };
    rankOpt.grid = {
        ...GRIDS.ranking,
        top: byCustoHora.length <= 3 ? 48 : GRIDS.ranking.top
    };
    rankOpt.series = [{
        ...rankOpt.series[0],
        barCategoryGap: byCustoHora.length <= 3 ? '38%' : '24%'
    }];

    setChart('chart-maquinas-custo-hora', rankOpt);
    const chChart = charts['chart-maquinas-custo-hora'];
    chChart?.off('click');
    chChart?.on('click', p => {
        const m = byCustoHora[p.dataIndex];
        if (m) onDrill?.('machine', { equipamento: m.equipamento_nome });
    });
}
