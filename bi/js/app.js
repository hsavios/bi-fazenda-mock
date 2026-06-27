import { fetchView, formatNumber, formatCurrency } from './api.js';

let charts = {};

function initChart(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (charts[id]) charts[id].dispose();
    charts[id] = echarts.init(el, 'dark');
    return charts[id];
}

function renderTable(containerId, columns, rows) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    if (!rows.length) {
        wrap.innerHTML = '<p class="loading">Sem dados</p>';
        return;
    }
    const thead = columns.map(c => `<th>${c.label}</th>`).join('');
    const tbody = rows.map(row =>
        `<tr>${columns.map(c => `<td>${c.format ? c.format(row[c.key]) : (row[c.key] ?? '—')}</td>`).join('')}</tr>`
    ).join('');
    wrap.innerHTML = `<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

async function loadOverview() {
    const [dre, prod, com] = await Promise.all([
        fetchView('vw_dre_gerencial', { order: 'receita_bruta.desc', limit: '5' }),
        fetchView('vw_produtividade_talhao', { limit: '100' }),
        fetchView('vw_comercializacao_cultura')
    ]);

    const receitaTotal = dre.reduce((s, r) => s + Number(r.receita_bruta || 0), 0);
    const resultadoTotal = dre.reduce((s, r) => s + Number(r.resultado || 0), 0);
    const prodMedia = prod.length
        ? prod.reduce((s, r) => s + Number(r.produtividade_sc_ha || 0), 0) / prod.length
        : 0;

    document.getElementById('kpi-receita').textContent = formatCurrency(receitaTotal);
    document.getElementById('kpi-resultado').textContent = formatCurrency(resultadoTotal);
    document.getElementById('kpi-prod').textContent = formatNumber(prodMedia, 1) + ' sc/ha';
    document.getElementById('kpi-contratos').textContent = com.length;

    const chart = initChart('chart-overview-cultura');
    if (chart) {
        chart.setOption({
            tooltip: { trigger: 'axis' },
            legend: { data: ['Receita', 'Resultado'] },
            xAxis: { type: 'category', data: dre.map(r => r.cultura_nome) },
            yAxis: { type: 'value', axisLabel: { formatter: v => (v / 1e6).toFixed(1) + 'M' } },
            series: [
                { name: 'Receita', type: 'bar', data: dre.map(r => r.receita_bruta), itemStyle: { color: '#3d9970' } },
                { name: 'Resultado', type: 'bar', data: dre.map(r => r.resultado), itemStyle: { color: '#f0b429' } }
            ]
        });
    }
}

async function loadProducao() {
    const data = await fetchView('vw_produtividade_talhao', { order: 'produtividade_sc_ha.desc', limit: '20' });
    const chart = initChart('chart-produtividade');
    if (chart) {
        chart.setOption({
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: data.map(r => r.talhao_codigo), axisLabel: { rotate: 45 } },
            yAxis: { type: 'value', name: 'sc/ha' },
            series: [{
                type: 'bar',
                data: data.map(r => r.produtividade_sc_ha),
                itemStyle: { color: '#3d9970' }
            }]
        });
    }
    renderTable('table-producao', [
        { key: 'talhao_codigo', label: 'Talhão' },
        { key: 'cultura_nome', label: 'Cultura' },
        { key: 'produtividade_sc_ha', label: 'Produtividade', format: v => formatNumber(v, 2) },
        { key: 'producao_sc', label: 'Produção (sc)', format: v => formatNumber(v, 0) }
    ], data);
}

async function loadCustos() {
    const [custoHa, margem] = await Promise.all([
        fetchView('vw_custo_hectare_cultura_safra'),
        fetchView('vw_margem_bruta_cultura')
    ]);

    const chart = initChart('chart-custo-ha');
    if (chart) {
        chart.setOption({
            tooltip: { trigger: 'item' },
            series: [{
                type: 'pie', radius: ['40%', '70%'],
                data: custoHa.map(r => ({ name: r.cultura_nome, value: r.custo_hectare }))
            }]
        });
    }

    renderTable('table-custos', [
        { key: 'cultura_nome', label: 'Cultura' },
        { key: 'custo_hectare', label: 'Custo/ha', format: v => formatCurrency(v) },
        { key: 'margem_bruta_pct', label: 'Margem bruta %', format: v => formatNumber(v, 1) + '%' }
    ], margem.map(m => ({
        ...m,
        custo_hectare: custoHa.find(c => c.cultura_nome === m.cultura_nome)?.custo_hectare
    })));
}

async function loadEstoques() {
    const [ins, prod] = await Promise.all([
        fetchView('vw_estoque_insumos_atual'),
        fetchView('vw_estoque_producao_atual', { limit: '15' })
    ]);
    renderTable('table-estoque-ins', [
        { key: 'insumo_nome', label: 'Insumo' },
        { key: 'quantidade_atual', label: 'Qtd', format: v => formatNumber(v, 2) },
        { key: 'valor_estoque', label: 'Valor', format: v => formatCurrency(v) }
    ], ins);
    renderTable('table-estoque-prod', [
        { key: 'cultura_nome', label: 'Cultura' },
        { key: 'lote_codigo', label: 'Lote' },
        { key: 'quantidade_atual_sc', label: 'Estoque (sc)', format: v => formatNumber(v, 0) }
    ], prod);
}

async function loadFinanceiro() {
    const fluxo = await fetchView('vw_fluxo_caixa_realizado', { order: 'data_movimento', limit: '50' });
    const chart = initChart('chart-fluxo');
    if (chart) {
        chart.setOption({
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: fluxo.map(r => r.data_movimento) },
            yAxis: { type: 'value' },
            series: [{
                type: 'line', smooth: true,
                data: fluxo.map(r => r.saldo_acumulado),
                areaStyle: { opacity: 0.15 },
                itemStyle: { color: '#3d9970' }
            }]
        });
    }
}

async function loadContabilidade() {
    const dre = await fetchView('vw_dre_gerencial');
    renderTable('table-dre', [
        { key: 'cultura_nome', label: 'Cultura' },
        { key: 'receita_bruta', label: 'Receita', format: v => formatCurrency(v) },
        { key: 'custos_variaveis', label: 'CV', format: v => formatCurrency(v) },
        { key: 'custos_fixos', label: 'CF', format: v => formatCurrency(v) },
        { key: 'resultado', label: 'Resultado', format: v => formatCurrency(v) }
    ], dre);
}

const loaders = {
    overview: loadOverview,
    producao: loadProducao,
    custos: loadCustos,
    estoques: loadEstoques,
    financeiro: loadFinanceiro,
    contabilidade: loadContabilidade
};

async function loadSection(name) {
    const status = document.getElementById('api-status');
    try {
        status.textContent = 'Carregando...';
        status.classList.remove('error');
        await loaders[name]();
        status.textContent = 'Conectado';
    } catch (err) {
        status.textContent = 'Erro API: ' + err.message + ' — Verifique se PostgREST está rodando.';
        status.classList.add('error');
        console.error(err);
    }
}

function setupNav() {
    document.querySelectorAll('nav button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            const section = document.getElementById('section-' + btn.dataset.section);
            section.classList.add('active');
            loadSection(btn.dataset.section);
        });
    });
}

window.addEventListener('resize', () => Object.values(charts).forEach(c => c?.resize()));
document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    loadSection('overview');
});

export { loadSection };
