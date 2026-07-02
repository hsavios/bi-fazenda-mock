/**
 * Fluxo de caixa — matriz, agregações e detalhes por célula.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct
} from './api.js?v=5.5';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const CASH_INDICATORS = {
    entradas: { id: 'entradas', label: 'Entradas' },
    saidas: { id: 'saidas', label: 'Saídas' },
    saldo_mes: { id: 'saldo_mes', label: 'Saldo do mês' },
    saldo_acumulado: { id: 'saldo_acumulado', label: 'Saldo acumulado' }
};

export function formatMonthLabel(monthKey) {
    const [y, m] = (monthKey || '').split('-');
    const mi = Number(m) - 1;
    return `${MONTH_NAMES[mi] || m}/${y?.slice(2) || ''}`;
}

export function aggregateCashByMonth(fluxoRows) {
    const map = new Map();
    (fluxoRows || []).forEach(r => {
        const d = r.data_movimento;
        if (!d) return;
        const key = d.slice(0, 7);
        if (!map.has(key)) {
            map.set(key, {
                monthKey: key,
                monthLabel: formatMonthLabel(key),
                entradas: 0,
                saidas: 0,
                saldoAcumulado: 0,
                movimentos: 0
            });
        }
        const m = map.get(key);
        const val = Number(r.valor || 0);
        if (r.tipo === 'entrada') m.entradas += val;
        else m.saidas += Math.abs(val);
        m.saldoAcumulado = Number(r.saldo_acumulado ?? m.saldoAcumulado);
        m.movimentos += 1;
    });
    return [...map.values()]
        .map(m => ({
            ...m,
            saldoMes: m.entradas - m.saidas,
            pressao: m.saidas - m.entradas
        }))
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export function getMovementsForMonth(fluxoRows, monthKey) {
    return (fluxoRows || [])
        .filter(r => r.data_movimento?.slice(0, 7) === monthKey)
        .sort((a, b) => String(a.data_movimento).localeCompare(String(b.data_movimento)));
}

export function groupCashMovementsByCategory(movements) {
    const map = new Map();
    (movements || []).forEach(m => {
        const cat = m.categoria || 'Outros';
        map.set(cat, (map.get(cat) || 0) + Math.abs(Number(m.valor || 0)));
    });
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([categoria, valor]) => ({
            categoria,
            valor,
            pct: total ? (valor / total) * 100 : 0
        }));
}

export function getCashMonthSummary(fluxoRows, monthKey) {
    return aggregateCashByMonth(fluxoRows).find(m => m.monthKey === monthKey) || null;
}

export function getAccumulatedUntil(fluxoRows, monthKey) {
    const months = aggregateCashByMonth(fluxoRows).filter(m => m.monthKey <= monthKey);
    return {
        entradas: months.reduce((s, m) => s + m.entradas, 0),
        saidas: months.reduce((s, m) => s + m.saidas, 0),
        saldo: months.length ? months[months.length - 1].saldoAcumulado : 0,
        months
    };
}

export function buildCashMatrix(fluxoRows) {
    const months = aggregateCashByMonth(fluxoRows);
    if (!months.length) return null;

    const hotMonthKey = [...months].sort((a, b) => b.pressao - a.pressao)[0]?.monthKey;
    const criticalMonthKey = [...months].sort((a, b) => a.saldoAcumulado - b.saldoAcumulado)[0]?.monthKey;
    const maxSaida = Math.max(...months.map(m => m.saidas), 1);

    const rows = [
        {
            indicator: 'entradas',
            label: 'Entradas',
            tone: 'entrada',
            values: months.map(m => ({ monthKey: m.monthKey, value: m.entradas }))
        },
        {
            indicator: 'saidas',
            label: 'Saídas',
            tone: 'saida',
            values: months.map(m => ({
                monthKey: m.monthKey,
                value: m.saidas,
                intensity: Math.min(m.saidas / maxSaida, 1)
            }))
        },
        {
            indicator: 'saldo_mes',
            label: 'Saldo do mês',
            tone: 'saldo',
            values: months.map(m => ({ monthKey: m.monthKey, value: m.saldoMes }))
        },
        {
            indicator: 'saldo_acumulado',
            label: 'Saldo acumulado',
            tone: 'acumulado',
            values: months.map(m => ({
                monthKey: m.monthKey,
                value: m.saldoAcumulado,
                critical: m.monthKey === criticalMonthKey
            }))
        }
    ];

    return { months, rows, hotMonthKey, criticalMonthKey, maxSaida };
}

function fmtSigned(val) {
    const n = Number(val || 0);
    const abs = formatCurrencyCompact(Math.abs(n));
    return n < 0 ? `-${abs}` : abs;
}

function cellClass(indicator, value, opts = {}) {
    const parts = ['cash-matrix-cell', 'cash-cell-value'];
    if (indicator === 'entradas') parts.push('cash-cell--entrada');
    if (indicator === 'saidas') parts.push('cash-cell--saida');
    if (indicator === 'saldo_mes' || indicator === 'saldo_acumulado') {
        parts.push(Number(value) >= 0 ? 'cash-cell--saldo-positive' : 'cash-cell--saldo-negative');
    }
    if (opts.critical) parts.push('cash-cell--critical');
    if (opts.hot) parts.push('cash-cell--critical');
    if (Math.abs(Number(value)) < 0.01) parts.push('cash-cell--zero');
    return parts.join(' ');
}

export function renderCashStatementMatrix(container, fluxoRows, onCellClick) {
    if (!container) return;
    const matrix = buildCashMatrix(fluxoRows);
    if (!matrix) {
        container.innerHTML = '<div class="cash-empty-state"><p>Sem dados de fluxo de caixa no recorte.</p></div>';
        return;
    }

    const { months, rows, hotMonthKey, criticalMonthKey } = matrix;
    const colCount = months.length;

    container.innerHTML = `
        <div class="cash-statement-shell" style="--cash-cols:${colCount}">
            <div class="cash-statement-titlebar">
                <div>
                    <h3>Matriz mensal de caixa — regime de caixa</h3>
                    <p>Valores em R$ · Clique nos valores para detalhar</p>
                </div>
            </div>
            <div class="cash-matrix-table">
                <div class="cash-matrix-head">
                    <div class="cash-matrix-label-col">Indicador</div>
                    ${months.map(m => `
                        <div class="cash-matrix-month-col cash-number${m.monthKey === hotMonthKey ? ' cash-cell--critical-head' : ''}">${m.monthLabel}</div>
                    `).join('')}
                </div>
                ${rows.map(row => `
                    <div class="cash-matrix-row cash-matrix-row--${row.tone}">
                        <div class="cash-matrix-label cash-matrix-label--${row.tone === 'entrada' ? 'in' : row.tone === 'saida' ? 'out' : 'neutral'}">${row.label}</div>
                        ${row.values.map(v => {
                            const hot = row.indicator === 'saidas' && v.monthKey === hotMonthKey;
                            const critical = row.indicator === 'saldo_acumulado' && v.monthKey === criticalMonthKey;
                            const cls = cellClass(row.indicator, v.value, { critical, hot });
                            const style = v.intensity != null ? ` style="--intensity:${v.intensity}"` : '';
                            return `<button type="button" class="${cls}"${style}
                                data-month="${v.monthKey}" data-indicator="${row.indicator}"
                                aria-label="${row.label} ${formatMonthLabel(v.monthKey)}: ${fmtSigned(v.value)}">
                                ${fmtSigned(v.value)}
                            </button>`;
                        }).join('')}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.querySelectorAll('[data-month][data-indicator]').forEach(btn => {
        const open = () => onCellClick?.({
            monthKey: btn.dataset.month,
            indicator: btn.dataset.indicator,
            monthLabel: formatMonthLabel(btn.dataset.month)
        });
        btn.addEventListener('click', open);
        btn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

export function renderCashMovementsTable(container, fluxoRows, onMovementClick) {
    if (!container) return;
    const rows = [...(fluxoRows || [])].sort((a, b) =>
        String(b.data_movimento).localeCompare(String(a.data_movimento))
    );
    if (!rows.length) {
        container.innerHTML = '<div class="cash-empty-state"><p>Nenhum movimento de caixa no recorte filtrado.</p></div>';
        return;
    }

    container.innerHTML = `
        <div class="cash-movements-shell">
            <div class="cash-movements-head">
                <div>Data</div>
                <div>Tipo</div>
                <div>Categoria</div>
                <div>Descrição</div>
                <div>Conta</div>
                <div class="cash-number">Valor</div>
                <div class="cash-number">Saldo acum.</div>
            </div>
            <div class="cash-movements-body">
                ${rows.map((r, i) => `
                    <button type="button" class="cash-movement-row" data-movement-idx="${i}" title="Clique para detalhar">
                        <div>${(r.data_movimento || '').slice(0, 10)}</div>
                        <div><span class="cash-chip cash-chip--${r.tipo === 'entrada' ? 'in' : 'out'}">${r.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></div>
                        <div>${r.categoria || '—'}</div>
                        <div class="cash-movement-desc">${r.descricao || '—'}</div>
                        <div>${r.conta_bancaria || '—'}</div>
                        <div class="cash-number ${r.tipo === 'entrada' ? 'cash-cell--entrada' : 'cash-cell--saida'}">${fmtSigned(r.valor)}</div>
                        <div class="cash-number">${formatCurrencyCompact(r.saldo_acumulado)}</div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    container.querySelectorAll('[data-movement-idx]').forEach(btn => {
        const movement = rows[Number(btn.dataset.movementIdx)];
        const open = () => onMovementClick?.(movement);
        btn.addEventListener('click', open);
        btn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

export function getCashCellDetails(fluxoRows, { monthKey, indicator }) {
    const months = aggregateCashByMonth(fluxoRows);
    const month = months.find(m => m.monthKey === monthKey);
    const monthLabel = month?.monthLabel || formatMonthLabel(monthKey);
    const monthMovements = getMovementsForMonth(fluxoRows, monthKey);
    const minSaldo = months.length ? Math.min(...months.map(m => m.saldoAcumulado)) : 0;
    const accumulated = getAccumulatedUntil(fluxoRows, monthKey);

    let movements = [];
    let value = 0;
    let title = '';
    let interpretation = '';
    let nextAction = '';

    switch (indicator) {
        case 'entradas':
            movements = monthMovements.filter(m => m.tipo === 'entrada');
            value = movements.reduce((s, m) => s + Number(m.valor || 0), 0);
            title = `Entradas — ${monthLabel}`;
            interpretation = value > 0
                ? `${monthLabel} registra entradas de ${formatCurrencyCompact(value)} no recorte filtrado.`
                : `Não há movimentos de entrada registrados em ${monthLabel}.`;
            nextAction = value > 0
                ? 'Confirmar recebimentos associados e cruzar com contratos de comercialização.'
                : 'Verificar se há recebíveis previstos ainda não registrados neste mês.';
            break;
        case 'saidas':
            movements = monthMovements.filter(m => m.tipo === 'saida');
            value = movements.reduce((s, m) => s + Math.abs(Number(m.valor || 0)), 0);
            title = `Saídas — ${monthLabel}`;
            interpretation = value > 0
                ? `${monthLabel} concentra desembolsos de ${formatCurrencyCompact(value)} no período.`
                : `Não há movimentos de saída registrados em ${monthLabel}.`;
            nextAction = value > 0
                ? 'Revisar compras de insumos e necessidade de capital de giro no início da safra.'
                : 'Avaliar se despesas previstas foram registradas ou reprogramadas.';
            break;
        case 'saldo_mes':
            movements = monthMovements;
            value = month?.saldoMes ?? 0;
            title = `Saldo do mês — ${monthLabel}`;
            interpretation = `Entradas ${formatCurrencyCompact(month?.entradas || 0)} menos saídas ${formatCurrencyCompact(month?.saidas || 0)} resultam em saldo mensal de ${fmtSigned(value)}.`;
            nextAction = value >= 0
                ? 'Manter disciplina de recebimentos para preservar liquidez positiva.'
                : 'Reprogramar desembolsos não críticos ou antecipar recebíveis.';
            break;
        case 'saldo_acumulado':
            movements = monthMovements;
            value = month?.saldoAcumulado ?? 0;
            title = `Saldo acumulado — ${monthLabel}`;
            interpretation = value === minSaldo && months.length > 1
                ? `${monthLabel} representa o ponto de menor liquidez acumulada (${fmtSigned(value)}) no período.`
                : `Saldo acumulado até ${monthLabel}: ${fmtSigned(value)} após entradas acumuladas de ${formatCurrencyCompact(accumulated.entradas)} e saídas de ${formatCurrencyCompact(accumulated.saidas)}.`;
            nextAction = value < 0
                ? 'Planejar antecipação de recebíveis, ajuste de desembolsos ou reforço de caixa.'
                : 'Monitorar evolução do saldo acumulado e manter reserva operacional.';
            break;
        default:
            return null;
    }

    const categories = groupCashMovementsByCategory(
        indicator === 'entradas' ? movements.filter(m => m.tipo === 'entrada')
            : indicator === 'saidas' ? movements.filter(m => m.tipo === 'saida')
                : movements
    );

    const mainAccount = movements.reduce((acc, m) => {
        const c = m.conta_bancaria || '—';
        acc[c] = (acc[c] || 0) + 1;
        return acc;
    }, {});
    const topAccount = Object.entries(mainAccount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const maxMovement = movements.length
        ? [...movements].sort((a, b) => Math.abs(Number(b.valor)) - Math.abs(Number(a.valor)))[0]
        : null;

    return {
        monthKey,
        monthLabel,
        indicator,
        title,
        value,
        movements,
        categories,
        month,
        months,
        accumulated,
        isZero: Math.abs(value) < 0.01,
        isMinLiquidity: month && month.saldoAcumulado === minSaldo,
        topAccount,
        maxMovement,
        interpretation,
        nextAction
    };
}

export function renderCashMobilePanel(container, months, selectedKey, onCellClick) {
    if (!container) return;
    const month = months.find(m => m.monthKey === selectedKey) || months[0];
    if (!month) {
        container.innerHTML = '<p class="insight-empty">Sem dados.</p>';
        return;
    }

    const items = [
        { indicator: 'entradas', label: 'Entradas', value: month.entradas, tone: 'in' },
        { indicator: 'saidas', label: 'Saídas', value: month.saidas, tone: 'out' },
        { indicator: 'saldo_mes', label: 'Saldo do mês', value: month.saldoMes, tone: month.saldoMes >= 0 ? 'in' : 'out' },
        { indicator: 'saldo_acumulado', label: 'Saldo acumulado', value: month.saldoAcumulado, tone: month.saldoAcumulado >= 0 ? 'in' : 'out', wide: true }
    ];

    container.innerHTML = items.map(it => `
        <button type="button" class="cash-mobile-card${it.wide ? ' cash-mobile-card--wide' : ''}"
                data-indicator="${it.indicator}" data-month="${month.monthKey}">
            <span class="cash-mobile-card-label">${it.label}</span>
            <span class="cash-mobile-card-value cash-mobile-card-value--${it.tone}">${fmtSigned(it.value)}</span>
        </button>
    `).join('');

    container.querySelectorAll('[data-indicator]').forEach(btn => {
        btn.addEventListener('click', () => onCellClick?.({
            monthKey: btn.dataset.month,
            indicator: btn.dataset.indicator,
            monthLabel: month.monthLabel
        }));
    });
}
