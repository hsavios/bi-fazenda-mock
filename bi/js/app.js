import {
    fetchView,
    formatNumber,
    formatCurrency,
    formatCurrencyCompact,
    formatPct,
    sumField
} from './api.js';

const charts = {};
const TABS = ['visao-geral', 'culturas', 'estoques', 'financeiro', 'operacoes', 'sobre'];
const CULTURE_ORDER = ['Café', 'Feijão', 'Milho', 'Soja', 'Sorgo'];

function el(id) {
    return document.getElementById(id);
}

function initChart(id) {
    const node = el(id);
    if (!node) return null;
    if (charts[id]) charts[id].dispose();
    charts[id] = echarts.init(node);
    return charts[id];
}

function resizeCharts() {
    Object.values(charts).forEach(c => c?.resize());
}

function kpiCard(label, value, className = '', fullValue = '') {
    const title = fullValue ? ` title="${fullValue.replace(/"/g, '&quot;')}"` : '';
    return `
        <div class="kpi-card">
            <div class="kpi-label">${label}</div>
            <div class="kpi-value ${className}"${title}>${value}</div>
        </div>
    `;
}

function renderKpis(containerId, items) {
    const container = el(containerId);
    if (!container) return;
    container.innerHTML = items.map(item =>
        kpiCard(item.label, item.value, item.className || '', item.full || '')
    ).join('');
}

function renderDataCards(containerId, cards) {
    const container = el(containerId);
    if (!container) return;
    if (!cards.length) {
        container.innerHTML = '<p class="data-card">Sem registros.</p>';
        return;
    }
    container.innerHTML = cards.map(card => `
        <article class="data-card">
            <div class="data-card-title">${card.title}</div>
            ${card.rows.map(r => `
                <div class="data-row">
                    <span>${r.label}</span>
                    <span${r.title ? ` title="${r.title}"` : ''}>${r.value}</span>
                </div>
            `).join('')}
        </article>
    `).join('');
}

function aggregateByCulture(dreRows) {
    const map = new Map();
    dreRows.forEach(r => {
        const name = r.cultura_nome || 'Consolidado';
        if (!map.has(name)) {
            map.set(name, { cultura_nome: name, receita_bruta: 0, custos_variaveis: 0, custos_fixos: 0, resultado: 0 });
        }
        const agg = map.get(name);
        agg.receita_bruta += Number(r.receita_bruta || 0);
        agg.custos_variaveis += Number(r.custos_variaveis || 0);
        agg.custos_fixos += Number(r.custos_fixos || 0);
        agg.resultado += Number(r.resultado || 0);
    });
    return [...map.values()];
}

function sortCultures(names) {
    return [...names].sort((a, b) => {
        const ia = CULTURE_ORDER.indexOf(a);
        const ib = CULTURE_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

function avgProdutividadeByCulture(prodRows) {
    const map = new Map();
    prodRows.forEach(r => {
        const name = r.cultura_nome;
        if (!map.has(name)) map.set(name, { sum: 0, count: 0 });
        const entry = map.get(name);
        entry.sum += Number(r.produtividade_sc_ha || 0);
        entry.count += 1;
    });
    const result = new Map();
    map.forEach((v, k) => result.set(k, v.count ? v.sum / v.count : 0));
    return result;
}

function moneyKpi(label, n, className = '') {
    return {
        label,
        value: formatCurrencyCompact(n),
        full: formatCurrency(n),
        className
    };
}

function renderOverview(dre, margem, custoHa, comercial) {
    const byCulture = aggregateByCulture(dre);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const custoTotal = byCulture.reduce((s, r) => s + Number(r.custos_variaveis || 0) + Number(r.custos_fixos || 0), 0);
    const margemBrutaTotal = sumField(margem, 'margem_bruta');
    const culturas = new Set(byCulture.map(r => r.cultura_nome).filter(Boolean));
    const areaTotal = custoHa.reduce((s, r) => s + Number(r.area_total_ha || 0), 0);

    renderKpis('kpi-overview', [
        moneyKpi('Receita total', receitaTotal),
        moneyKpi('Custo total', custoTotal),
        moneyKpi('Margem bruta', margemBrutaTotal, 'kpi-value--gold'),
        { label: 'Área total', value: formatNumber(areaTotal, 0) + ' ha' },
        { label: 'Culturas', value: formatNumber(culturas.size || comercial.length) }
    ]);

    const chart = initChart('chart-overview');
    if (chart && byCulture.length) {
        const sorted = sortCultures(byCulture.map(r => r.cultura_nome));
        const data = sorted.map(name => byCulture.find(r => r.cultura_nome === name));
        chart.setOption({
            color: ['#40916c', '#b8860b'],
            tooltip: {
                trigger: 'axis',
                formatter: params => params.map(p =>
                    `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)}`
                ).join('<br>')
            },
            legend: { data: ['Receita', 'Resultado'], bottom: 4, textStyle: { fontSize: 11 } },
            grid: { left: 52, right: 12, top: 20, bottom: 52, containLabel: false },
            xAxis: {
                type: 'category',
                data: sorted,
                axisLabel: { fontSize: 11, interval: 0 }
            },
            yAxis: {
                type: 'value',
                axisLabel: { fontSize: 10, formatter: v => (v / 1e6).toFixed(0) + 'M' }
            },
            series: [
                { name: 'Receita', type: 'bar', data: data.map(r => r.receita_bruta), barMaxWidth: 32 },
                { name: 'Resultado', type: 'bar', data: data.map(r => r.resultado), barMaxWidth: 32 }
            ]
        }, true);
    }
}

function renderCulturas(resultado, margem, produtividade) {
    const prodMap = avgProdutividadeByCulture(produtividade);
    const margemMap = new Map(margem.map(m => [m.cultura_nome, m]));
    const culturas = sortCultures([...new Set([
        ...resultado.map(r => r.cultura_nome),
        ...margem.map(m => m.cultura_nome)
    ])].filter(Boolean));

    const container = el('culture-cards');
    if (!container) return;

    container.innerHTML = culturas.map(nome => {
        const res = resultado.find(r => r.cultura_nome === nome) || {};
        const mar = margemMap.get(nome) || {};
        const prod = prodMap.get(nome);
        const custo = Number(res.custos_variaveis || 0) + Number(res.custos_fixos || 0);
        const resultadoVal = Number(res.resultado ?? mar.margem_bruta ?? 0);
        const positive = resultadoVal >= 0;

        return `
            <article class="culture-card ${positive ? '' : 'culture-card--negative'}">
                <div class="culture-card-header">
                    <h3>${nome}</h3>
                    <span class="status-pill ${positive ? 'status-pill--ok' : 'status-pill--warn'}">
                        ${positive ? 'Positivo' : 'Atenção'}
                    </span>
                </div>
                <dl class="culture-metrics">
                    <div class="metric">
                        <dt>Receita</dt>
                        <dd title="${formatCurrency(res.receita_bruta ?? mar.receita_bruta)}">${formatCurrencyCompact(res.receita_bruta ?? mar.receita_bruta)}</dd>
                    </div>
                    <div class="metric">
                        <dt>Custo</dt>
                        <dd title="${formatCurrency(custo)}">${formatCurrencyCompact(custo)}</dd>
                    </div>
                    <div class="metric">
                        <dt>Margem</dt>
                        <dd title="${formatCurrency(mar.margem_bruta)}">${formatCurrencyCompact(mar.margem_bruta)}</dd>
                    </div>
                    <div class="metric">
                        <dt>Produtividade</dt>
                        <dd>${prod != null ? formatNumber(prod, 1) + ' sc/ha' : '—'}</dd>
                    </div>
                </dl>
            </article>
        `;
    }).join('');
}

function renderEstoques(insumos, producao) {
    const valorInsumos = sumField(insumos, 'valor_estoque');
    const volumeProd = sumField(producao, 'quantidade_atual_sc');

    renderKpis('kpi-estoques', [
        { label: 'Produção (sc)', value: formatNumber(volumeProd, 0) },
        { label: 'Itens insumo', value: formatNumber(insumos.length) },
        moneyKpi('Valor insumos', valorInsumos)
    ]);

    const byCulture = new Map();
    producao.forEach(p => {
        const c = p.cultura_nome;
        byCulture.set(c, (byCulture.get(c) || 0) + Number(p.quantidade_atual_sc || 0));
    });
    const cultNames = sortCultures([...byCulture.keys()]);
    const chart = initChart('chart-estoque-prod');
    if (chart && cultNames.length) {
        chart.setOption({
            color: ['#40916c'],
            tooltip: { trigger: 'axis', formatter: p => `${p[0].name}: ${formatNumber(p[0].value, 0)} sc` },
            grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
            xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
            yAxis: { type: 'category', data: cultNames, axisLabel: { fontSize: 11 } },
            series: [{
                type: 'bar',
                data: cultNames.map(c => byCulture.get(c)),
                barMaxWidth: 22
            }]
        }, true);
    }

    renderDataCards('cards-estoque-ins', insumos.slice(0, 8).map(i => ({
        title: i.insumo_nome,
        rows: [
            { label: 'Qtd', value: formatNumber(i.quantidade_atual, 1) + ' ' + (i.unidade || '') },
            { label: 'Valor', value: formatCurrencyCompact(i.valor_estoque), title: formatCurrency(i.valor_estoque) }
        ]
    })));
}

function renderFinanceiro(dre, fluxo) {
    const byCulture = aggregateByCulture(dre);
    const receita = sumField(byCulture, 'receita_bruta');
    const custos = byCulture.reduce((s, r) => s + Number(r.custos_variaveis || 0), 0);
    const despesas = byCulture.reduce((s, r) => s + Number(r.custos_fixos || 0), 0);
    const resultado = sumField(byCulture, 'resultado');
    const resultadoClass = resultado >= 0 ? 'kpi-value--positive' : 'kpi-value--negative';

    renderKpis('kpi-financeiro', [
        moneyKpi('Receita', receita),
        moneyKpi('Custos', custos),
        moneyKpi('Despesas', despesas),
        moneyKpi('Resultado', resultado, resultadoClass)
    ]);

    const chart = initChart('chart-fluxo');
    if (chart && fluxo.length) {
        chart.setOption({
            color: ['#2d6a4f'],
            tooltip: {
                trigger: 'axis',
                formatter: p => `${p[0].axisValue}<br>Saldo: ${formatCurrency(p[0].value)}`
            },
            grid: { left: 48, right: 12, top: 16, bottom: 40 },
            xAxis: {
                type: 'category',
                data: fluxo.map(r => r.data_movimento),
                axisLabel: { fontSize: 9, rotate: 35, interval: Math.floor(fluxo.length / 6) }
            },
            yAxis: {
                type: 'value',
                axisLabel: { fontSize: 10, formatter: v => (v / 1e6).toFixed(0) + 'M' }
            },
            series: [{
                type: 'line',
                smooth: true,
                data: fluxo.map(r => r.saldo_acumulado),
                areaStyle: { opacity: 0.1 }
            }]
        }, true);
    }

    renderDataCards('cards-dre', sortCultures(byCulture.map(d => d.cultura_nome)).map(name => {
        const d = byCulture.find(r => r.cultura_nome === name);
        return {
            title: d.cultura_nome,
            rows: [
                { label: 'Receita', value: formatCurrencyCompact(d.receita_bruta), title: formatCurrency(d.receita_bruta) },
                { label: 'Custos var.', value: formatCurrencyCompact(d.custos_variaveis), title: formatCurrency(d.custos_variaveis) },
                { label: 'Despesas', value: formatCurrencyCompact(d.custos_fixos), title: formatCurrency(d.custos_fixos) },
                { label: 'Resultado', value: formatCurrencyCompact(d.resultado), title: formatCurrency(d.resultado) }
            ]
        };
    }));
}

function renderOperacoes(talhoes, maquinas, maoObra) {
    renderDataCards('cards-talhao', talhoes
        .sort((a, b) => Number(b.custo_total || 0) - Number(a.custo_total || 0))
        .slice(0, 6)
        .map(t => ({
            title: `${t.talhao_codigo} · ${t.cultura_nome}`,
            rows: [
                { label: 'Produção', value: formatNumber(t.producao_sc, 0) + ' sc' },
                { label: 'Custo', value: formatCurrencyCompact(t.custo_total), title: formatCurrency(t.custo_total) },
                { label: 'Resultado', value: formatCurrencyCompact(t.resultado_estimado), title: formatCurrency(t.resultado_estimado) }
            ]
        })));

    const maqSorted = maquinas
        .sort((a, b) => Number(b.horas_totais || 0) - Number(a.horas_totais || 0))
        .slice(0, 8);

    const chartMaq = initChart('chart-maquinas');
    if (chartMaq && maqSorted.length) {
        chartMaq.setOption({
            color: ['#2d6a4f'],
            tooltip: {
                trigger: 'axis',
                formatter: p => `${p[0].name}<br>${formatNumber(p[0].value, 1)} h · ${formatCurrency(maqSorted[p[0].dataIndex]?.custo_total)}`
            },
            grid: { left: 8, right: 16, top: 8, bottom: 8, containLabel: true },
            xAxis: { type: 'value', axisLabel: { fontSize: 10 } },
            yAxis: {
                type: 'category',
                data: maqSorted.map(m => m.equipamento_nome),
                axisLabel: { fontSize: 10, width: 90, overflow: 'truncate' }
            },
            series: [{
                type: 'bar',
                data: maqSorted.map(m => m.horas_totais),
                barMaxWidth: 20
            }]
        }, true);
    }

    const equipeMap = new Map();
    maoObra.forEach(r => {
        const team = r.equipe || 'Sem equipe';
        equipeMap.set(team, (equipeMap.get(team) || 0) + Number(r.horas_totais || 0));
    });
    const teams = [...equipeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    const chartMo = initChart('chart-mao-obra');
    if (chartMo && teams.length) {
        chartMo.setOption({
            color: ['#40916c'],
            tooltip: { trigger: 'axis', formatter: p => `${p[0].name}: ${formatNumber(p[0].value, 1)} h` },
            grid: { left: 40, right: 12, top: 12, bottom: 48 },
            xAxis: {
                type: 'category',
                data: teams.map(t => t[0]),
                axisLabel: { fontSize: 9, rotate: 25, interval: 0 }
            },
            yAxis: { type: 'value', name: 'h', nameTextStyle: { fontSize: 10 } },
            series: [{ type: 'bar', data: teams.map(t => t[1]), barMaxWidth: 36 }]
        }, true);
    }
}

function switchTab(tabId, pushHash = true) {
    if (!TABS.includes(tabId)) tabId = 'visao-geral';

    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.view === tabId);
    });

    const activePanel = document.querySelector(`.view-panel[data-view="${tabId}"]`);
    if (activePanel) activePanel.scrollTop = 0;

    if (pushHash && location.hash !== `#${tabId}`) {
        history.replaceState(null, '', `#${tabId}`);
    }

    requestAnimationFrame(() => {
        resizeCharts();
    });
}

function setupTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    const hash = location.hash.replace('#', '');
    switchTab(TABS.includes(hash) ? hash : 'visao-geral', false);

    window.addEventListener('hashchange', () => {
        const h = location.hash.replace('#', '');
        if (TABS.includes(h)) switchTab(h, false);
    });
}

async function loadDashboard() {
    const loading = el('loading-state');
    const views = el('app-views');
    const error = el('error-state');

    try {
        const [
            dre, margem, resultado, custoHa, comercial, produtividade,
            insumos, producao, fluxo, talhoes, maquinas, maoObra
        ] = await Promise.all([
            fetchView('vw_dre_gerencial'),
            fetchView('vw_margem_bruta_cultura'),
            fetchView('vw_resultado_gerencial_cultura'),
            fetchView('vw_custo_hectare_cultura_safra'),
            fetchView('vw_comercializacao_cultura'),
            fetchView('vw_produtividade_talhao', { limit: '200' }),
            fetchView('vw_estoque_insumos_atual'),
            fetchView('vw_estoque_producao_atual', { limit: '20' }),
            fetchView('vw_fluxo_caixa_realizado', { order: 'data_movimento', limit: '40' }),
            fetchView('vw_resultado_talhao', { order: 'custo_total.desc', limit: '15' }),
            fetchView('vw_uso_maquinas_safra'),
            fetchView('vw_horas_mao_obra_safra', { limit: '100' })
        ]);

        renderOverview(dre, margem, custoHa, comercial);
        renderCulturas(resultado, margem, produtividade);
        renderEstoques(insumos, producao);
        renderFinanceiro(dre, fluxo);
        renderOperacoes(talhoes, maquinas, maoObra);

        loading.classList.add('hidden');
        views.classList.remove('hidden');
        setupTabs();
        resizeCharts();
    } catch (err) {
        console.error(err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

window.addEventListener('resize', resizeCharts);
document.addEventListener('DOMContentLoaded', loadDashboard);
