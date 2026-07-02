/**
 * Performance da safra por talhão — produtividade, custo e resultado.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct,
    sumField
} from './api.js?v=5.6';

function rowKey(r) {
    return `${r.safra_codigo || ''}|${r.talhao_codigo}|${r.cultura_nome}`;
}

function computeCultureBenchmarks(rows) {
    const map = new Map();
    rows.forEach(r => {
        const c = r.cultura_nome;
        if (!map.has(c)) {
            map.set(c, {
                prodArea: 0, area: 0, custoArea: 0, custoScSum: 0, custoScCount: 0,
                margemSum: 0, margemCount: 0
            });
        }
        const e = map.get(c);
        const area = Number(r.area_ha || 0);
        e.prodArea += Number(r.produtividade_sc_ha || 0) * area;
        e.area += area;
        if (area > 0) {
            e.custoArea += Number(r.custo_ha || 0) * area;
        }
        if (r.custo_sc > 0) { e.custoScSum += r.custo_sc; e.custoScCount += 1; }
        e.margemSum += Number(r.margem_pct || 0);
        e.margemCount += 1;
    });
    const out = new Map();
    map.forEach((e, cultura) => {
        out.set(cultura, {
            produtividade_media: e.area ? e.prodArea / e.area : 0,
            custo_ha_medio: e.area ? e.custoArea / e.area : 0,
            custo_sc_medio: e.custoScCount ? e.custoScSum / e.custoScCount : 0,
            margem_media: e.margemCount ? e.margemSum / e.margemCount : 0
        });
    });
    return out;
}

function classifyTalhao(r, bench) {
    const b = bench.get(r.cultura_nome) || {};
    const prodMedia = b.produtividade_media || 0;
    const custoHaMed = b.custo_ha_medio || r.custo_ha;
    const desvio = Number(r.desvio_produtividade_pct || 0);

    if (desvio > 3 && r.resultado_ha > 0 && r.custo_ha <= custoHaMed * 1.05) {
        return { chip: 'Eficiência alta', tone: 'positive', classificacao: 'Alta eficiência' };
    }
    if (r.resultado_ha < 0 || (r.custo_ha > custoHaMed * 1.12 && desvio < -3)) {
        return { chip: 'Consome margem', tone: 'critical', classificacao: 'Consome margem' };
    }
    if (r.custo_ha > custoHaMed * 1.08) {
        return { chip: 'Custo elevado', tone: 'warn', classificacao: 'Custo elevado' };
    }
    if (desvio < -5) {
        return { chip: 'Produtividade baixa', tone: 'warn', classificacao: 'Produtividade baixa' };
    }
    if (r.resultado_ha > 0 && desvio >= 0) {
        return { chip: 'Positivo', tone: 'positive', classificacao: 'Bom resultado' };
    }
    return { chip: 'Atenção', tone: 'warn', classificacao: 'Atenção' };
}

export function buildTalhaoPerformanceModel(talhoes, produtividade) {
    const prodMap = new Map((produtividade || []).map(p => [rowKey(p), p]));

    const base = (talhoes || []).map(t => {
        const prod = prodMap.get(rowKey(t)) || prodMap.get(`${t.safra_codigo || ''}|${t.talhao_codigo}|${t.cultura_nome}`)
            || (produtividade || []).find(p => p.talhao_codigo === t.talhao_codigo && p.cultura_nome === t.cultura_nome)
            || {};
        const area = Number(prod.area_planejada_ha || 0);
        const producao = Number(t.producao_sc || prod.producao_sc || 0);
        const prodScHa = Number(prod.produtividade_sc_ha || 0);
        const custoTotal = Number(t.custo_total || 0);
        const precoMedio = Number(t.preco_medio_sc || 0);
        const receitaEst = producao * precoMedio;
        const resultado = Number(t.resultado_estimado || 0);
        const custoHa = area > 0 ? custoTotal / area : 0;
        const custoSc = producao > 0 ? custoTotal / producao : 0;
        const resultadoHa = area > 0 ? resultado / area : 0;
        const resultadoSc = producao > 0 ? resultado / producao : 0;
        const margemPct = receitaEst > 0 ? (resultado / receitaEst) * 100 : 0;

        return {
            safra_codigo: t.safra_codigo,
            talhao_codigo: t.talhao_codigo,
            talhao_nome: t.talhao_nome,
            cultura_nome: t.cultura_nome,
            area_ha: area,
            producao_sc: producao,
            produtividade_sc_ha: prodScHa,
            produtividade_meta_sc_ha: Number(prod.produtividade_meta_sc_ha || 0),
            variacao_meta_pct: Number(prod.variacao_meta_pct || 0),
            preco_medio_estimado_sc: precoMedio,
            receita_estimada: receitaEst,
            custo_total: custoTotal,
            custo_ha: custoHa,
            custo_sc: custoSc,
            resultado,
            resultado_ha: resultadoHa,
            resultado_sc: resultadoSc,
            margem_pct: margemPct,
            desvio_produtividade_sc_ha: 0,
            desvio_produtividade_pct: 0,
            produtividade_media_cultura_sc_ha: 0,
            ganho_perda_sc_vs_media: 0,
            ganho_perda_valor_vs_media: 0
        };
    });

    const benchmarks = computeCultureBenchmarks(base);
    const enriched = base.map(r => {
        const b = benchmarks.get(r.cultura_nome) || {};
        const prodMedia = b.produtividade_media || r.produtividade_sc_ha;
        const desvioScHa = r.produtividade_sc_ha - prodMedia;
        const desvioPct = prodMedia ? (desvioScHa / prodMedia) * 100 : 0;
        const ganhoPerdaSc = desvioScHa * r.area_ha;
        const preco = r.preco_medio_estimado_sc || (r.producao_sc ? r.receita_estimada / r.producao_sc : 0);
        const ganhoPerdaValor = ganhoPerdaSc * preco;
        const cls = classifyTalhao({ ...r, desvio_produtividade_pct: desvioPct, custo_ha: r.custo_ha, resultado_ha: r.resultado_ha }, benchmarks);
        return {
            ...r,
            produtividade_media_cultura_sc_ha: prodMedia,
            desvio_produtividade_sc_ha: desvioScHa,
            desvio_produtividade_pct: desvioPct,
            ganho_perda_sc_vs_media: ganhoPerdaSc,
            ganho_perda_valor_vs_media: ganhoPerdaValor,
            classificacao: cls.classificacao,
            status_chip: cls.chip,
            status_tone: cls.tone
        };
    });

    return { rows: enriched.sort((a, b) => Number(b.resultado) - Number(a.resultado)), benchmarks };
}

export function getTalhaoPerformanceRow(model, talhaoCodigo, cultura = null) {
    return model.rows.find(r =>
        r.talhao_codigo === talhaoCodigo && (!cultura || r.cultura_nome === cultura)
    ) || null;
}

export function buildFieldPerformanceInsights(model) {
    const { rows } = model;
    if (!rows.length) {
        return [{ title: 'Sem dados', text: 'Não há talhões no recorte filtrado.', tone: 'info' }];
    }

    const insights = [];
    const best = [...rows].sort((a, b) => Number(b.resultado_ha) - Number(a.resultado_ha))[0];
    const worst = [...rows].sort((a, b) => Number(a.ganho_perda_valor_vs_media) - Number(b.ganho_perda_valor_vs_media))[0];
    const marginLeak = [...rows].filter(r => r.status_tone === 'critical' || r.classificacao === 'Consome margem')[0]
        || [...rows].sort((a, b) => Number(b.custo_ha) - Number(a.custo_ha))[0];
    const totalGanhoPerda = sumField(rows, 'ganho_perda_valor_vs_media');
    const top3Custo = [...rows].sort((a, b) => Number(b.custo_total) - Number(a.custo_total)).slice(0, 3);
    const totalCusto = sumField(rows, 'custo_total');
    const top3Share = totalCusto ? (sumField(top3Custo, 'custo_total') / totalCusto) * 100 : 0;

    if (marginLeak) {
        insights.push({
            title: 'Talhão que consome margem',
            text: `${marginLeak.talhao_codigo} (${marginLeak.cultura_nome}): custo/ha ${formatCurrencyCompact(marginLeak.custo_ha)} e produtividade ${formatNumber(marginLeak.produtividade_sc_ha, 1)} sc/ha (${formatPct(marginLeak.desvio_produtividade_pct)} vs média da cultura).`,
            tone: 'critical'
        });
    }

    if (best && best.ganho_perda_valor_vs_media > 0) {
        insights.push({
            title: 'Ganho econômico',
            text: `${best.talhao_codigo} supera o benchmark interno da cultura ${best.cultura_nome}, com ganho estimado de ${formatCurrencyCompact(best.ganho_perda_valor_vs_media)} vs média.`,
            tone: 'positive'
        });
    }

    if (worst && worst.ganho_perda_valor_vs_media < 0) {
        insights.push({
            title: 'Perda vs benchmark',
            text: `${worst.talhao_codigo} está ${formatPct(Math.abs(worst.desvio_produtividade_pct))} abaixo da média de produtividade da cultura, representando perda estimada de ${formatCurrencyCompact(Math.abs(worst.ganho_perda_valor_vs_media))}.`,
            tone: 'warn'
        });
    }

    if (top3Custo.length) {
        insights.push({
            title: 'Concentração de custo',
            text: `Os 3 talhões mais caros concentram ${formatPct(top3Share)} do custo operacional analisado (${top3Custo.map(t => t.talhao_codigo).join(', ')}).`,
            tone: 'info'
        });
    }

    insights.push({
        title: 'Potencial econômico da produtividade',
        text: `A diferença agregada de produtividade vs média interna representa ${formatCurrencyCompact(totalGanhoPerda)} no recorte (estimado via preço médio/sc da receita).`,
        tone: totalGanhoPerda >= 0 ? 'positive' : 'warn'
    });

    return insights.slice(0, 5);
}

function fmtSignedCompact(v) {
    const n = Number(v || 0);
    const abs = formatCurrencyCompact(Math.abs(n));
    return n < 0 ? `-${abs}` : abs;
}

function rowClass(r) {
    const parts = ['field-performance-row'];
    if (r.status_tone === 'positive') parts.push('field-performance-row--positive');
    else if (r.status_tone === 'critical') parts.push('field-performance-row--critical');
    else if (r.status_tone === 'warn') parts.push('field-performance-row--warning');
    return parts.join(' ');
}

export function renderFieldPerformanceTable(container, model, onRowClick) {
    if (!container) return;
    const { rows } = model;
    if (!rows.length) {
        container.innerHTML = '<div class="field-empty-state"><p>Nenhum talhão no recorte filtrado.</p></div>';
        return;
    }

    const maxMargem = Math.max(...rows.map(r => Math.abs(r.margem_pct)), 1);

    container.innerHTML = `
        <div class="field-performance-shell">
            <div class="field-performance-header">
                <div>
                    <h3>Performance por Talhão — Safra</h3>
                    <p>Produtividade, custo, margem e resultado econômico · Clique na linha para detalhar</p>
                </div>
            </div>
            <div class="field-performance-table">
                <div class="field-performance-head">
                    <div>Talhão</div>
                    <div>Cultura</div>
                    <div class="field-number field-col-hide-sm">Área</div>
                    <div class="field-number">Prod.</div>
                    <div class="field-number field-col-hide-sm">Prod. média</div>
                    <div class="field-number">Δ Prod.</div>
                    <div class="field-number field-col-hide-sm">Receita est.</div>
                    <div class="field-number field-col-hide-sm">Custo total</div>
                    <div class="field-number">Custo/ha</div>
                    <div class="field-number field-col-hide-sm">Custo/sc</div>
                    <div class="field-number">Resultado/ha</div>
                    <div class="field-number field-col-hide-sm">Margem</div>
                    <div class="field-number">G/P vs média</div>
                    <div>Status</div>
                </div>
                ${rows.map(r => {
                    const barW = Math.min(100, (Math.abs(r.margem_pct) / maxMargem) * 100);
                    const desvioCls = r.desvio_produtividade_pct >= 0 ? 'field-value-positive' : 'field-value-negative';
                    const gpCls = r.ganho_perda_valor_vs_media >= 0 ? 'field-value-positive' : 'field-value-negative';
                    return `
                    <button type="button" class="${rowClass(r)}"
                            data-talhao="${r.talhao_codigo}" data-cultura="${r.cultura_nome}"
                            title="Detalhar ${r.talhao_codigo}">
                        <div class="field-talhao-label"><strong>${r.talhao_codigo}</strong></div>
                        <div>${r.cultura_nome}</div>
                        <div class="field-number field-col-hide-sm">${formatNumber(r.area_ha, 0)} ha</div>
                        <div class="field-number">${formatNumber(r.produtividade_sc_ha, 1)}</div>
                        <div class="field-number field-col-hide-sm">${formatNumber(r.produtividade_media_cultura_sc_ha, 1)}</div>
                        <div class="field-number ${desvioCls}">${formatPct(r.desvio_produtividade_pct)}</div>
                        <div class="field-number field-col-hide-sm">${formatCurrencyCompact(r.receita_estimada)}</div>
                        <div class="field-number field-col-hide-sm">${formatCurrencyCompact(r.custo_total)}</div>
                        <div class="field-number">${formatCurrencyCompact(r.custo_ha)}</div>
                        <div class="field-number field-col-hide-sm">${r.custo_sc ? formatCurrencyCompact(r.custo_sc) : '—'}</div>
                        <div class="field-number field-metric-wrap">
                            <div class="field-metric-bar" style="width:${barW}%"></div>
                            <span>${formatCurrencyCompact(r.resultado_ha)}</span>
                        </div>
                        <div class="field-number field-col-hide-sm">${formatPct(r.margem_pct)}</div>
                        <div class="field-number ${gpCls}">${fmtSignedCompact(r.ganho_perda_valor_vs_media)}</div>
                        <div><span class="performance-chip performance-chip--${r.status_tone}">${r.status_chip}</span></div>
                    </button>`;
                }).join('')}
            </div>
        </div>
    `;

    container.querySelectorAll('[data-talhao]').forEach(btn => {
        const open = () => onRowClick?.({
            talhaoCodigo: btn.dataset.talhao,
            cultura: btn.dataset.cultura
        });
        btn.addEventListener('click', open);
        btn.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    });
}

export function buildFieldPerformanceKpis(model) {
    const { rows } = model;
    if (!rows.length) return [];
    const totalArea = sumField(rows, 'area_ha');
    const prodMedia = totalArea
        ? rows.reduce((s, r) => s + r.produtividade_sc_ha * r.area_ha, 0) / totalArea
        : 0;
    const custoHaMed = totalArea ? sumField(rows, 'custo_total') / totalArea : 0;
    const totalProd = sumField(rows, 'producao_sc');
    const custoScMed = totalProd ? sumField(rows, 'custo_total') / totalProd : 0;
    const best = [...rows].sort((a, b) => Number(b.resultado_ha) - Number(a.resultado_ha))[0];
    const atencao = rows.find(r => r.status_tone === 'critical')
        || [...rows].sort((a, b) => Number(a.desvio_produtividade_pct) - Number(b.desvio_produtividade_pct))[0];
    const ganhoPerdaTotal = sumField(rows, 'ganho_perda_valor_vs_media');

    return [
        { label: 'Resultado total', value: formatCurrencyCompact(sumField(rows, 'resultado')), tone: 'positive', drill: 'field-resultado-total' },
        { label: 'Produtividade média', value: formatNumber(prodMedia, 1) + ' sc/ha', tone: 'default', drill: 'field-prod-media' },
        { label: 'Custo médio/ha', value: formatCurrencyCompact(custoHaMed), tone: 'warn', drill: 'field-custo-ha' },
        { label: 'Custo médio/sc', value: formatCurrencyCompact(custoScMed), tone: 'warn', drill: 'field-custo-sc' },
        { label: 'Melhor talhão', value: best?.talhao_codigo || '—', hint: best ? formatCurrencyCompact(best.resultado_ha) + '/ha' : '', tone: 'positive', drill: 'field-melhor', talhao: best?.talhao_codigo, cultura: best?.cultura_nome },
        { label: 'Talhão de atenção', value: atencao?.talhao_codigo || '—', hint: atencao?.status_chip || '', tone: 'critical', drill: 'field-atencao', talhao: atencao?.talhao_codigo, cultura: atencao?.cultura_nome },
        { label: 'G/P produtividade', value: fmtSignedCompact(ganhoPerdaTotal), hint: 'vs média da cultura', tone: ganhoPerdaTotal >= 0 ? 'positive' : 'warn', drill: 'field-ganho-perda' }
    ];
}
