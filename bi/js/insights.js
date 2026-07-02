/**
 * Insights interpretativos gerados por regras simples sobre os dados carregados.
 */
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPct, sumField } from './api.js?v=4.0';

function pctShare(value, total) {
    if (!total) return 0;
    return (Number(value) / Number(total)) * 100;
}

function topBy(rows, key, field) {
    if (!rows?.length) return null;
    return rows.reduce((best, r) =>
        Number(r[field] || 0) > Number(best[field] || 0) ? r : best
    );
}

function bottomBy(rows, key, field) {
    if (!rows?.length) return null;
    return rows.reduce((worst, r) =>
        Number(r[field] || 0) < Number(worst[field] || 0) ? r : worst
    );
}

function insightCard(title, text, tone = 'info') {
    return { title, text, tone };
}

export function aggregateDreByCulture(dreRows) {
    const map = new Map();
    dreRows.forEach(r => {
        const name = r.cultura_nome || 'Consolidado';
        if (!map.has(name)) {
            map.set(name, {
                cultura_nome: name,
                receita_bruta: 0,
                custos_variaveis: 0,
                custos_fixos: 0,
                resultado: 0
            });
        }
        const agg = map.get(name);
        agg.receita_bruta += Number(r.receita_bruta || 0);
        agg.custos_variaveis += Number(r.custos_variaveis || 0);
        agg.custos_fixos += Number(r.custos_fixos || 0);
        agg.resultado += Number(r.resultado || 0);
    });
    return [...map.values()];
}

export function buildExecutiveInsights(store) {
    const byCulture = aggregateDreByCulture(store.dre || []);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const resultado = sumField(byCulture, 'resultado');
    const margemPct = receitaTotal ? (resultado / receitaTotal) * 100 : 0;
    const insights = [];

    const topReceita = topBy(byCulture, 'cultura_nome', 'receita_bruta');
    if (topReceita) {
        insights.push(insightCard(
            'Concentração de receita',
            `${topReceita.cultura_nome} concentra ${formatPct(pctShare(topReceita.receita_bruta, receitaTotal))} da receita total da safra.`,
            'info'
        ));
    }

    const topMargem = [...byCulture]
        .filter(c => c.receita_bruta > 0)
        .sort((a, b) => (b.resultado / b.receita_bruta) - (a.resultado / a.receita_bruta))[0];
    const lowAreaHighMargin = (store.margem || []).find(m => {
        const custo = (store.custoHa || []).find(c => c.cultura_nome === m.cultura_nome);
        return m.margem_bruta_pct > 25 && custo && Number(custo.area_total_ha || 0) < 500;
    });
    if (lowAreaHighMargin) {
        insights.push(insightCard(
            'Eficiência por área',
            `${lowAreaHighMargin.cultura_nome} apresenta margem relevante com menor área relativa na operação simulada.`,
            'positive'
        ));
    } else if (topMargem) {
        insights.push(insightCard(
            'Margem destacada',
            `${topMargem.cultura_nome} lidera o resultado consolidado entre as culturas monitoradas.`,
            'positive'
        ));
    }

    const worstResult = bottomBy(byCulture.filter(c => c.cultura_nome), 'cultura_nome', 'resultado');
    if (worstResult && Number(worstResult.resultado) < resultado * 0.15) {
        const custo = Number(worstResult.custos_variaveis) + Number(worstResult.custos_fixos);
        insights.push(insightCard(
            'Custo x retorno',
            `${worstResult.cultura_nome} tem custo elevado (${formatCurrencyCompact(custo)}) frente ao resultado, exigindo atenção.`,
            'warn'
        ));
    }

    const prodMap = new Map();
    (store.producao || []).forEach(p => {
        const c = p.cultura_nome;
        prodMap.set(c, (prodMap.get(c) || 0) + Number(p.quantidade_atual_sc || 0));
    });
    const prodSorted = [...prodMap.entries()].sort((a, b) => b[1] - a[1]);
    if (prodSorted.length >= 2) {
        insights.push(insightCard(
            'Estoque de produção',
            `Produção armazenada concentrada em ${prodSorted[0][0]} e ${prodSorted[1][0]}.`,
            'info'
        ));
    }

    const topTalhao = topBy(store.talhoes || [], 'talhao_codigo', 'custo_total');
    if (topTalhao) {
        insights.push(insightCard(
            'Custos operacionais',
            `Custos de operação concentrados em poucos talhões — destaque para ${topTalhao.talhao_codigo}.`,
            'warn'
        ));
    }

    if (resultado >= 0) {
        insights.push(insightCard(
            'Resultado consolidado',
            `A operação demonstrativa apresenta resultado positivo, com margem de ${formatPct(margemPct)}.`,
            'positive'
        ));
    } else {
        insights.push(insightCard(
            'Resultado consolidado',
            'A operação demonstrativa exige atenção: resultado consolidado negativo.',
            'warn'
        ));
    }

    return insights.slice(0, 6);
}

export function buildCultureInsights(store, culturaNome) {
    const byCulture = aggregateDreByCulture(store.dre || []);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const row = byCulture.find(c => c.cultura_nome === culturaNome);
    if (!row) return [];

    const share = pctShare(row.receita_bruta, receitaTotal);
    return [
        insightCard(
            'Exposição econômica',
            `${culturaNome} representa ${formatPct(share)} da receita total e concentra exposição relevante na safra demonstrativa.`,
            share > 40 ? 'info' : 'positive'
        )
    ];
}

export function buildStockPanelInsights(store) {
    const insights = [];
    const insumos = store.insumos || [];
    const producao = store.producao || [];
    const totalInsumos = sumField(insumos, 'valor_estoque');
    const topInsumo = topBy(insumos, 'insumo_nome', 'valor_estoque');

    if (topInsumo) {
        insights.push(insightCard(
            'Maior valor em estoque',
            `${topInsumo.insumo_nome} é o maior item em valor de estoque (${formatCurrencyCompact(topInsumo.valor_estoque)}).`,
            'info'
        ));
    }

    const prodMap = new Map();
    producao.forEach(p => {
        prodMap.set(p.cultura_nome, (prodMap.get(p.cultura_nome) || 0) + Number(p.quantidade_atual_sc || 0));
    });
    const prodSorted = [...prodMap.entries()].sort((a, b) => b[1] - a[1]);
    if (prodSorted.length >= 2) {
        insights.push(insightCard(
            'Produção armazenada',
            `Estoque de produção concentrado em ${prodSorted[0][0]} e ${prodSorted[1][0]}.`,
            'info'
        ));
    }

    if (totalInsumos > 0 && topInsumo) {
        const share = pctShare(topInsumo.valor_estoque, totalInsumos);
        if (share > 25) {
            insights.push(insightCard(
                'Concentração de insumos',
                `${topInsumo.insumo_nome} representa ${formatPct(share)} do valor total de insumos — monitorar reposição.`,
                'warn'
            ));
        }
    }

    return insights.slice(0, 4);
}

export function buildStockInsights(store, item) {
    const total = sumField(store.insumos || [], 'valor_estoque');
    const share = pctShare(item.valor_estoque, total);
    return [
        insightCard(
            'Participação no estoque',
            `${item.insumo_nome} representa ${formatPct(share)} do valor total de insumos em estoque.`,
            share > 20 ? 'warn' : 'info'
        )
    ];
}

export function buildTalhaoInsight(talhao) {
    return [
        insightCard(
            'Análise operacional',
            `${talhao.talhao_codigo} está entre os maiores custos da safra e deve ser investigado em uma operação real.`,
            Number(talhao.resultado_estimado) < 0 ? 'warn' : 'info'
        )
    ];
}

export function buildFinancialInsight(row) {
    const margem = row.receita_bruta
        ? (Number(row.resultado) / Number(row.receita_bruta)) * 100
        : 0;
    const tone = margem >= 15 ? 'positive' : margem >= 0 ? 'info' : 'warn';
    return [
        insightCard(
            'Interpretação DRE',
            `${row.cultura_nome}: margem de ${formatPct(margem)} sobre receita de ${formatCurrencyCompact(row.receita_bruta)}.`,
            tone
        )
    ];
}

export function buildOperationsInsights(store) {
    const insights = [];
    const talhoes = store.talhoes || [];
    const topCusto = topBy(talhoes, 'talhao_codigo', 'custo_total');
    const topResult = topBy(talhoes, 'talhao_codigo', 'resultado_estimado');

    if (topCusto) {
        const totalCusto = sumField(talhoes, 'custo_total');
        insights.push(insightCard(
            'Maior concentração de custo',
            `${topCusto.talhao_codigo} aparece como maior concentração de custo operacional (${formatPct(pctShare(topCusto.custo_total, totalCusto))}).`,
            'warn'
        ));
    }
    if (topResult && Number(topResult.resultado_estimado) > 0) {
        insights.push(insightCard(
            'Talhão de destaque',
            `${topResult.talhao_codigo} lidera o resultado estimado entre os talhões analisados.`,
            'positive'
        ));
    }

    const resultado = store.resultado || [];
    const lowMargin = bottomBy(resultado.filter(r => r.cultura_nome), 'cultura_nome', 'margem_pct');
    if (lowMargin) {
        insights.push(insightCard(
            'Menor margem',
            `${lowMargin.cultura_nome} tem a menor margem entre as culturas monitoradas.`,
            'warn'
        ));
    }

    const topCustoCulture = topBy(aggregateDreByCulture(store.dre || []), 'cultura_nome', 'custos_variaveis');
    if (topCustoCulture) {
        insights.push(insightCard(
            'Maior custo por cultura',
            `${topCustoCulture.cultura_nome} concentra o maior custo total da safra.`,
            'info'
        ));
    }

    const topInsumo = topBy(store.insumos || [], 'insumo_nome', 'valor_estoque');
    if (topInsumo) {
        insights.push(insightCard(
            'Estoque crítico',
            `${topInsumo.insumo_nome} é o maior item em valor de estoque (${formatCurrencyCompact(topInsumo.valor_estoque)}).`,
            'info'
        ));
    }

    return insights.slice(0, 5);
}

export function renderInsightCards(container, insights) {
    if (!container) return;
    if (!insights?.length) {
        container.innerHTML = '<p class="insight-empty">Sem insights para exibir.</p>';
        return;
    }
    container.innerHTML = insights.map(i => `
        <article class="insight-card insight-card--${i.tone}">
            <h4 class="insight-title">${i.title}</h4>
            <p class="insight-text">${i.text}</p>
        </article>
    `).join('');
}
