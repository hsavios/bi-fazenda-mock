/**
 * Sub-aba Máquinas — demonstrativo de recursos operacionais.
 */
import {
    formatCurrencyCompact,
    formatNumber,
    formatPct,
    sumField
} from './api.js?v=5.6';
import { horizontalBarOption, comboBarLineOption } from './charts.js?v=5.6';

const MAQ_GRID = { left: 56, right: 28, top: 36, bottom: 56, containLabel: true };
const MAQ_HGRID = { left: 120, right: 24, top: 28, bottom: 42, containLabel: true };

function withGrid(option, grid) {
    return { ...option, grid: { ...grid, ...(option.grid || {}) } };
}

function truncLabel(label, max = 16) {
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
        { label: 'Custo total máquinas', value: formatCurrencyCompact(totalCusto), tone: 'warn' },
        { label: 'Horas totais', value: formatNumber(totalHoras, 0) + ' h', tone: 'default' },
        { label: 'Custo/hora médio', value: formatCurrencyCompact(custoHora), tone: 'warn' },
        { label: 'Máquina mais onerosa', value: truncLabel(topCusto?.equipamento_nome, 18) || '—', hint: topCusto ? formatCurrencyCompact(topCusto.custo_total) : '', tone: 'critical', machine: topCusto?.equipamento_nome },
        { label: 'Máquina mais usada', value: truncLabel(topHoras?.equipamento_nome, 18) || '—', hint: topHoras ? formatNumber(topHoras.horas_totais, 0) + ' h' : '', tone: 'positive', machine: topHoras?.equipamento_nome }
    ];

    container.innerHTML = items.map(it => `
        <div class="field-kpi-card field-kpi-card--${it.tone}${it.machine ? ' field-kpi-card--clickable' : ''}"
             ${it.machine ? `data-machine="${it.machine}"` : ''}
             ${it.machine ? 'role="button" tabindex="0"' : ''}>
            <span class="field-kpi-label">${it.label}</span>
            <span class="field-kpi-value">${it.value}</span>
            ${it.hint ? `<span class="field-kpi-hint">${it.hint}</span>` : ''}
        </div>
    `).join('');

    container.querySelectorAll('[data-machine]').forEach(node => {
        const open = () => onDrill?.('machine', { equipamento: node.dataset.machine });
        node.addEventListener('click', open);
        node.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

export function isMaquinasVizOpen() {
    return document.getElementById('field-maquinas-viz-accordion')?.open === true;
}

export function renderOperacoesMaquinas({ maquinas, charts, setChart, onDrill, drawChart = false }) {
    const sorted = [...(maquinas || [])].sort((a, b) => Number(b.custo_total) - Number(a.custo_total));
    const totalCusto = sumField(sorted, 'custo_total');

    renderMaquinasKpis(document.getElementById('kpi-maquinas'), sorted, onDrill);

    const tableHost = document.getElementById('field-maquinas-table');
    if (tableHost) {
        if (!sorted.length) {
            tableHost.innerHTML = '<div class="field-empty-state"><p>Sem dados de máquinas no recorte.</p></div>';
        } else {
            tableHost.innerHTML = `
                <div class="field-maquinas-shell">
                    <div class="field-maquinas-head">
                        <div>Máquina</div><div>Categoria</div>
                        <div class="field-number">Horas</div><div class="field-number">Custo</div>
                        <div class="field-number">Custo/h</div><div class="field-number">Participação</div><div>Status</div>
                    </div>
                    ${sorted.map(m => {
                        const custoH = m.horas_totais ? Number(m.custo_total) / Number(m.horas_totais) : 0;
                        const pct = totalCusto ? (Number(m.custo_total) / totalCusto) * 100 : 0;
                        const tone = pct > 25 ? 'critical' : pct > 15 ? 'warn' : 'positive';
                        const chip = pct > 25 ? 'Alta participação' : pct > 15 ? 'Relevante' : 'Normal';
                        return `
                        <button type="button" class="field-maquina-row" data-machine="${m.equipamento_nome}">
                            <div><strong>${m.equipamento_nome}</strong></div>
                            <div>${m.categoria || '—'}</div>
                            <div class="field-number">${formatNumber(m.horas_totais, 0)} h</div>
                            <div class="field-number">${formatCurrencyCompact(m.custo_total)}</div>
                            <div class="field-number">${formatCurrencyCompact(custoH)}</div>
                            <div class="field-number">${formatPct(pct)}</div>
                            <div><span class="performance-chip performance-chip--${tone}">${chip}</span></div>
                        </button>`;
                    }).join('')}
                </div>`;
            tableHost.querySelectorAll('[data-machine]').forEach(btn => {
                btn.addEventListener('click', () => onDrill?.('machine', { equipamento: btn.dataset.machine }));
            });
        }
    }

    if (!drawChart || !sorted.length) return;

    const top = sorted.slice(0, 8);
    const fullNames = top.map(m => m.equipamento_nome);
    const shortNames = fullNames.map(n => truncLabel(n, 14));

    const comboOpt = withGrid(
        comboBarLineOption(
            shortNames,
            [{ name: 'Custo (R$)', data: top.map(m => Number(m.custo_total)) }],
            [{ name: 'Horas', data: top.map(m => Number(m.horas_totais)) }]
        ),
        MAQ_GRID
    );
    comboOpt.tooltip = {
        trigger: 'axis',
        formatter: params => {
            const idx = params[0]?.dataIndex ?? 0;
            const name = fullNames[idx] || params[0]?.name;
            return params.map(p => `${p.marker} ${p.seriesName}: ${p.seriesName === 'Custo (R$)' ? formatCurrencyCompact(p.value) : p.value + ' h'}`).join('<br>')
                + `<br><strong>${name}</strong>`;
        }
    };
    comboOpt.xAxis = { ...comboOpt.xAxis, axisLabel: { fontSize: 10, interval: 0, rotate: shortNames.length > 5 ? 18 : 0 } };

    setChart('chart-maquinas-viz', comboOpt);
    const mChart = charts['chart-maquinas-viz'];
    mChart?.off('click');
    mChart?.on('click', p => {
        const m = top[p.dataIndex];
        if (m) onDrill?.('machine', { equipamento: m.equipamento_nome });
    });

    setChart('chart-maquinas-custo-hora', withGrid(
        horizontalBarOption(
            shortNames,
            top.map(m => m.horas_totais ? Number(m.custo_total) / Number(m.horas_totais) : 0),
            { formatter: v => formatCurrencyCompact(v), tooltipNames: fullNames, maxWidth: 24 }
        ),
        MAQ_HGRID
    ));
    const chChart = charts['chart-maquinas-custo-hora'];
    chChart?.off('click');
    chChart?.on('click', p => {
        const m = top[p.dataIndex];
        if (m) onDrill?.('machine', { equipamento: m.equipamento_nome });
    });
}
