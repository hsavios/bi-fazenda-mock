/**
 * Cliente de dados — caminhos relativos via nginx (/api → PostgREST interno)
 */
const API_BASE = '/api';

async function fetchView(viewName, params = {}) {
    const url = new URL(`${API_BASE}/${viewName}`, window.location.origin);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Não foi possível carregar ${viewName}`);
    return res.json();
}

function formatNumber(n, decimals = 0) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPct(n) {
    if (n == null || isNaN(n)) return '—';
    return formatNumber(n, 1) + '%';
}

function sumField(rows, key) {
    return rows.reduce((s, r) => s + Number(r[key] || 0), 0);
}

export { fetchView, formatNumber, formatCurrency, formatPct, sumField, API_BASE };
