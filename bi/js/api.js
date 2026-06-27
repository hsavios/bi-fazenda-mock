/**
 * Cliente API — PostgREST
 * Em produção com nginx: /api/ | Desenvolvimento local: http://127.0.0.1:3000
 */
const API_BASE = window.location.port === '8088' || window.location.hostname !== 'localhost'
    ? '/api'
    : 'http://127.0.0.1:3000';

async function fetchView(viewName, params = {}) {
    const url = new URL(`${API_BASE}/${viewName}`, window.location.origin);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`API ${viewName}: ${res.status} ${res.statusText}`);
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

export { fetchView, formatNumber, formatCurrency, API_BASE };
