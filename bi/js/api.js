/**
 * Cliente de dados — caminhos relativos via nginx (/api → PostgREST interno)
 */
const API_BASE = '/api';
const FETCH_TIMEOUT_MS = 25000;

async function fetchView(viewName, params = {}) {
    const url = new URL(`${API_BASE}/${viewName}`, window.location.origin);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(url.toString(), {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`${viewName} [HTTP ${res.status}]`);
        return res.json();
    } finally {
        clearTimeout(timer);
    }
}

function formatNumber(n, decimals = 0) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formato compacto para KPIs — evita quebra de linha em cards estreitos */
function formatCurrencyCompact(n) {
    if (n == null || isNaN(n)) return '—';
    const num = Number(n);
    const abs = Math.abs(num);
    const sign = num < 0 ? '−' : '';
    if (abs >= 1e9) {
        return `${sign}R$ ${(abs / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} bi`;
    }
    if (abs >= 1e6) {
        return `${sign}R$ ${(abs / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
    }
    if (abs >= 1e4) {
        return `${sign}R$ ${(abs / 1e3).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`;
    }
    return formatCurrency(num);
}

function formatPct(n) {
    if (n == null || isNaN(n)) return '—';
    return formatNumber(n, 1) + '%';
}

function sumField(rows, key) {
    return rows.reduce((s, r) => s + Number(r[key] || 0), 0);
}

export {
    fetchView,
    formatNumber,
    formatCurrency,
    formatCurrencyCompact,
    formatPct,
    sumField,
    API_BASE
};
