import { fetchView, formatNumber, formatCurrency, formatPct, sumField } from './api.js';

const charts = {};

function el(id) {
    return document.getElementById(id);
}

function initChart(id, theme = null) {
    const node = el(id);
    if (!node) return null;
    if (charts[id]) charts[id].dispose();
    charts[id] = echarts.init(node, theme);
    return charts[id];
}

function renderKpis(containerId, items) {
    const container = el(containerId);
    if (!container) return;
    container.innerHTML = items.map(item => `
        <div class="kpi-card">
            <div class="kpi-label">${item.label}</div>
            <div class="kpi-value ${item.className || ''}">${item.value}</div>
        </div>
    `).join('');
}

function renderDataCards(containerId, cards) {
    const container = el(containerId);
    if (!container) return;
    if (!cards.length) {
        container.innerHTML = '<p class="data-card">Nenhum registro disponível.</p>';
        return;
    }
    container.innerHTML = cards.map(card => `
        <article class="data-card">
            <div class="data-card-title">${card.title}</div>
            <dl class="data-card-rows">
                ${card.rows.map(r => `
                    <div class="data-row">
                        <span>${r.label}</span>
                        <span>${r.value}</span>
                    </div>
                `).join('')}
            </dl>
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

function renderOverview(dre, margem, custoHa, comercial) {
    const byCulture = aggregateByCulture(dre);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const custoTotal = byCulture.reduce((s, r) => s + Number(r.custos_variaveis || 0) + Number(r.custos_fixos || 0), 0);
    const margemBrutaTotal = sumField(margem, 'margem_bruta');
    const culturas = new Set(byCulture.map(r => r.cultura_nome).filter(Boolean));
    const areaTotal = custoHa.reduce((s, r) => s + Number(r.area_total_ha || 0), 0);

    renderKpis('kpi-overview', [
        { label: 'Receita total', value: formatCurrency(receitaTotal) },
        { label: 'Custo total', value: formatCurrency(custoTotal) },
        { label: 'Margem bruta', value: formatCurrency(margemBrutaTotal), className: 'kpi-value--gold' },
        { label: 'Culturas monitoradas', value: formatNumber(culturas.size || comercial.length) },
        { label: 'Área total', value: formatNumber(areaTotal, 0) + ' ha' }
    ]);

    const chart = initChart('chart-overview');
    if (chart && byCulture.length) {
        const names = byCulture.map(r => r.cultura_nome);
        chart.setOption({
            color: ['#40916c', '#b8860b'],
            tooltip: {
                trigger: 'axis',
                formatter: params => params.map(p =>
                    `${p.marker} ${p.seriesName}: ${formatCurrency(p.value)}`
                ).join('<br>')
            },
            legend: { data: ['Receita', 'Resultado'], bottom: 0, textStyle: { fontSize: 11 } },
            grid: { left: 48, right: 16, top: 24, bottom: 56 },
            xAxis: {
                type: 'category',
                data: names,
                axisLabel: { fontSize: 10, rotate: names.length > 4 ? 30 : 0 }
            },
            yAxis: {
                type: 'value',
                axisLabel: { formatter: v => (v / 1e6).toFixed(1) + 'M', fontSize: 10 }
            },
            series: [
                { name: 'Receita', type: 'bar', data: byCulture.map(r => r.receita_bruta), barMaxWidth: 36 },
                { name: 'Resultado', type: 'bar', data: byCulture.map(r => r.resultado), barMaxWidth: 36 }
            ]
        });
    }
}

function renderCulturas(resultado, margem, produtividade) {
    const prodMap = avgProdutividadeByCulture(produtividade);
    const margemMap = new Map(margem.map(m => [m.cultura_nome, m]));
    const culturas = [...new Set([
        ...resultado.map(r => r.cultura_nome),
        ...margem.map(m => m.cultura_nome)
    ])].filter(Boolean).sort();

    const container = el('culture-cards');
    if (!container) return;

    container.innerHTML = culturas.map(nome => {
        const res = resultado.find(r => r.cultura_nome === nome) || {};
        const mar = margemMap.get(nome) || {};
        const prod = prodMap.get(nome);
        const custo = Number(res.custos_variaveis || 0) + Number(res.custos_fixos || 0);

        return `
            <article class="culture-card">
                <h3>${nome}</h3>
                <dl class="culture-metrics">
                    <div class="metric"><dt>Receita</dt><dd>${formatCurrency(res.receita_bruta ?? mar.receita_bruta)}</dd></div>
                    <div class="metric"><dt>Custo</dt><dd>${formatCurrency(custo || null)}</dd></div>
                    <div class="metric"><dt>Margem bruta</dt><dd>${formatCurrency(mar.margem_bruta)}</dd></div>
                    <div class="metric"><dt>Produtividade</dt><dd>${prod != null ? formatNumber(prod, 1) + ' sc/ha' : '—'}</dd></div>
                </dl>
            </article>
        `;
    }).join('');
}

function renderEstoques(insumos, producao) {
    const valorInsumos = sumField(insumos, 'valor_estoque');
    const volumeProd = sumField(producao, 'quantidade_atual_sc');

    renderKpis('kpi-estoques', [
        { label: 'Produção armazenada', value: formatNumber(volumeProd, 0) + ' sc' },
        { label: 'Itens de insumo', value: formatNumber(insumos.length) },
        { label: 'Valor est. insumos', value: formatCurrency(valorInsumos) }
    ]);

    renderDataCards('cards-estoque-prod', producao.slice(0, 12).map(p => ({
        title: `${p.cultura_nome} · ${p.lote_codigo || 'Lote'}`,
        rows: [
            { label: 'Safra', value: p.safra_codigo || '—' },
            { label: 'Talhão', value: p.talhao_codigo || '—' },
            { label: 'Estoque', value: formatNumber(p.quantidade_atual_sc, 0) + ' sc' },
            { label: 'Umidade', value: p.umidade_pct != null ? formatPct(p.umidade_pct) : '—' }
        ]
    })));

    renderDataCards('cards-estoque-ins', insumos.slice(0, 10).map(i => ({
        title: i.insumo_nome,
        rows: [
            { label: 'Categoria', value: i.categoria || '—' },
            { label: 'Quantidade', value: formatNumber(i.quantidade_atual, 2) + ' ' + (i.unidade || '') },
            { label: 'Valor', value: formatCurrency(i.valor_estoque) }
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
        { label: 'Receita', value: formatCurrency(receita) },
        { label: 'Custos variáveis', value: formatCurrency(custos) },
        { label: 'Despesas fixas', value: formatCurrency(despesas) },
        { label: 'Resultado', value: formatCurrency(resultado), className: resultadoClass }
    ]);

    const chart = initChart('chart-fluxo');
    if (chart && fluxo.length) {
        chart.setOption({
            color: ['#2d6a4f'],
            tooltip: { trigger: 'axis', formatter: p => `${p[0].axisValue}<br>Saldo: ${formatCurrency(p[0].value)}` },
            grid: { left: 56, right: 16, top: 16, bottom: 48 },
            xAxis: {
                type: 'category',
                data: fluxo.map(r => r.data_movimento),
                axisLabel: { fontSize: 9, rotate: 45 }
            },
            yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: v => (v / 1e6).toFixed(1) + 'M' } },
            series: [{
                type: 'line',
                smooth: true,
                data: fluxo.map(r => r.saldo_acumulado),
                areaStyle: { opacity: 0.12 }
            }]
        });
    }

    renderDataCards('cards-dre', byCulture.map(d => ({
        title: d.cultura_nome,
        rows: [
            { label: 'Receita bruta', value: formatCurrency(d.receita_bruta) },
            { label: 'Custos variáveis', value: formatCurrency(d.custos_variaveis) },
            { label: 'Custos fixos', value: formatCurrency(d.custos_fixos) },
            { label: 'Resultado', value: formatCurrency(d.resultado) }
        ]
    })));
}

function renderOperacoes(talhoes, maquinas, maoObra) {
    renderDataCards('cards-talhao', talhoes
        .sort((a, b) => Number(b.resultado_estimado || 0) - Number(a.resultado_estimado || 0))
        .slice(0, 10)
        .map(t => ({
            title: `${t.talhao_codigo} · ${t.cultura_nome}`,
            rows: [
                { label: 'Talhão', value: t.talhao_nome || t.talhao_codigo },
                { label: 'Produção', value: formatNumber(t.producao_sc, 0) + ' sc' },
                { label: 'Custo', value: formatCurrency(t.custo_total) },
                { label: 'Resultado est.', value: formatCurrency(t.resultado_estimado) }
            ]
        })));

    renderDataCards('cards-maquinas', maquinas
        .sort((a, b) => Number(b.horas_totais || 0) - Number(a.horas_totais || 0))
        .slice(0, 8)
        .map(m => ({
            title: m.equipamento_nome,
            rows: [
                { label: 'Categoria', value: m.categoria || '—' },
                { label: 'Horas', value: formatNumber(m.horas_totais, 1) + ' h' },
                { label: 'Custo', value: formatCurrency(m.custo_total) },
                { label: 'Apontamentos', value: formatNumber(m.apontamentos) }
            ]
        })));

    const equipeMap = new Map();
    maoObra.forEach(r => {
        const team = r.equipe || 'Sem equipe';
        equipeMap.set(team, (equipeMap.get(team) || 0) + Number(r.horas_totais || 0));
    });
    const teams = [...equipeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const chart = initChart('chart-mao-obra');
    if (chart && teams.length) {
        chart.setOption({
            color: ['#40916c'],
            tooltip: { trigger: 'axis', formatter: p => `${p[0].name}: ${formatNumber(p[0].value, 1)} h` },
            grid: { left: 48, right: 16, top: 8, bottom: 64 },
            xAxis: { type: 'category', data: teams.map(t => t[0]), axisLabel: { fontSize: 9, rotate: 30 } },
            yAxis: { type: 'value', name: 'Horas', nameTextStyle: { fontSize: 10 } },
            series: [{ type: 'bar', data: teams.map(t => t[1]), barMaxWidth: 40 }]
        });
    }
}

function setupNavHighlight() {
    const chips = document.querySelectorAll('.nav-chip');
    const sections = ['visao-geral', 'culturas', 'estoques', 'financeiro', 'operacoes'];

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                chips.forEach(c => c.classList.toggle('active', c.getAttribute('href') === '#' + entry.target.id));
            }
        });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

    sections.forEach(id => {
        const section = el(id);
        if (section) observer.observe(section);
    });
}

async function loadDashboard() {
    const loading = el('loading-state');
    const content = el('app-content');
    const error = el('error-state');

    try {
        const [
            dre,
            margem,
            resultado,
            custoHa,
            comercial,
            produtividade,
            insumos,
            producao,
            fluxo,
            talhoes,
            maquinas,
            maoObra
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
            fetchView('vw_resultado_talhao', { order: 'resultado_estimado.desc', limit: '15' }),
            fetchView('vw_uso_maquinas_safra'),
            fetchView('vw_horas_mao_obra_safra', { limit: '100' })
        ]);

        renderOverview(dre, margem, custoHa, comercial);
        renderCulturas(resultado, margem, produtividade);
        renderEstoques(insumos, producao);
        renderFinanceiro(dre, fluxo);
        renderOperacoes(talhoes, maquinas, maoObra);

        loading.classList.add('hidden');
        content.classList.remove('hidden');
        setupNavHighlight();
    } catch (err) {
        console.error(err);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

window.addEventListener('resize', () => Object.values(charts).forEach(c => c?.resize()));
document.addEventListener('DOMContentLoaded', loadDashboard);
