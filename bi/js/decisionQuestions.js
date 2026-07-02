/**
 * Perguntas do Gestor — respostas derivadas das views KPI já carregadas.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct,
    sumField
} from './api.js?v=4.3';
import { aggregateDreByCulture } from './insights.js?v=4.3';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function pctShare(value, total) {
    if (!total) return 0;
    return (Number(value) / Number(total)) * 100;
}

function topBy(rows, field) {
    if (!rows?.length) return null;
    return rows.reduce((best, r) =>
        Number(r[field] || 0) > Number(best[field] || 0) ? r : best
    );
}

function bottomBy(rows, field) {
    if (!rows?.length) return null;
    return rows.reduce((worst, r) =>
        Number(r[field] || 0) < Number(worst[field] || 0) ? r : worst
    );
}

function toneToStatus(tone) {
    if (tone === 'positive') return { status: 'ok', label: 'Positivo' };
    if (tone === 'critical') return { status: 'critical', label: 'Crítico' };
    if (tone === 'warn') return { status: 'attention', label: 'Atenção' };
    return { status: 'ok', label: 'Informativo' };
}

function decisionCard(opts) {
    return {
        id: opts.id,
        question: opts.question,
        answer: opts.answer,
        evidence: opts.evidence || '',
        tone: opts.tone || 'info',
        actionLabel: opts.actionLabel || 'Ver detalhe',
        drillType: opts.drillType || 'decision',
        relatedTab: opts.relatedTab || null,
        payload: opts.payload || {}
    };
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
        else m.saidas += val;
        m.saldoAcumulado = Number(r.saldo_acumulado || m.saldoAcumulado);
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

function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split('-');
    const mi = Number(m) - 1;
    return `${MONTH_NAMES[mi] || m}/${y?.slice(2) || ''}`;
}

export function buildCommercialSummary(comercialRows) {
    const rows = (comercialRows || []).map(r => {
        const contratado = Number(r.volume_contratado_sc || 0);
        const entregue = Number(r.volume_entregue_sc || 0);
        return {
            ...r,
            volume_pendente_sc: Math.max(contratado - entregue, 0),
            valor_contratado: Number(r.valor_contratado || 0)
        };
    });
    const totalContratado = sumField(rows, 'volume_contratado_sc');
    const totalEntregue = sumField(rows, 'volume_entregue_sc');
    const totalPendente = sumField(rows, 'volume_pendente_sc');
    const totalValor = sumField(rows, 'valor_contratado');
    const topPendente = [...rows].sort((a, b) => b.volume_pendente_sc - a.volume_pendente_sc)[0];
    return { rows, totalContratado, totalEntregue, totalPendente, totalValor, topPendente };
}

function findMarginLeakTalhao(talhoes) {
    if (!talhoes?.length) return null;
    const medianResult = [...talhoes]
        .map(t => Number(t.resultado_estimado))
        .sort((a, b) => a - b)[Math.floor(talhoes.length / 2)] ?? 0;
    const scored = talhoes.map(t => {
        const custo = Number(t.custo_total || 0);
        const res = Number(t.resultado_estimado || 0);
        const leakScore = custo * (res < medianResult ? 1.4 : 1) * (res < 0 ? 1.6 : 1);
        return { ...t, leakScore };
    });
    return scored.sort((a, b) => b.leakScore - a.leakScore)[0];
}

function avgProdutividadeByCulture(prodRows) {
    const map = new Map();
    (prodRows || []).forEach(r => {
        const name = r.cultura_nome;
        if (!map.has(name)) map.set(name, { sum: 0, count: 0 });
        const e = map.get(name);
        e.sum += Number(r.produtividade_sc_ha || 0);
        e.count += 1;
    });
    const out = new Map();
    map.forEach((v, k) => out.set(k, v.count ? v.sum / v.count : 0));
    return out;
}

export function buildDecisionQuestions(store) {
    const cards = [];
    const byCulture = aggregateDreByCulture(store.dre || []);
    const receitaTotal = sumField(byCulture, 'receita_bruta');
    const resultadoTotal = sumField(byCulture, 'resultado');
    const prodMap = avgProdutividadeByCulture(store.produtividade);
    const comercial = buildCommercialSummary(store.comercial);
    const cashMonths = aggregateCashByMonth(store.fluxo);

    const topReceita = topBy(byCulture, 'receita_bruta');
    if (topReceita) {
        const share = pctShare(topReceita.receita_bruta, receitaTotal);
        cards.push(decisionCard({
            id: 'top-receita',
            question: 'Qual cultura mais sustenta o faturamento?',
            answer: `${topReceita.cultura_nome} concentra ${formatPct(share)} da receita total da safra demonstrativa.`,
            evidence: `Receita: ${formatCurrencyCompact(topReceita.receita_bruta)} · Resultado: ${formatCurrencyCompact(topReceita.resultado)}`,
            tone: 'positive',
            actionLabel: 'Analisar cultura',
            drillType: 'decision',
            relatedTab: 'culturas',
            payload: { kind: 'cultureResult', cultura: topReceita.cultura_nome }
        }));
    }

    const withMargin = byCulture
        .filter(c => c.receita_bruta > 0)
        .map(c => ({
            ...c,
            margemPct: (c.resultado / c.receita_bruta) * 100
        }));
    const lowMargin = withMargin.length
        ? withMargin.reduce((w, c) => (c.margemPct < w.margemPct ? c : w))
        : null;

    if (lowMargin) {
        cards.push(decisionCard({
            id: 'low-margin-culture',
            question: 'Qual cultura exige mais atenção econômica?',
            answer: `${lowMargin.cultura_nome} tem a menor margem relativa (${formatPct(lowMargin.margemPct)}) e deve ser priorizada para revisão de manejo e custos.`,
            evidence: `Custo: ${formatCurrencyCompact(lowMargin.custos_variaveis + lowMargin.custos_fixos)} · Resultado: ${formatCurrencyCompact(lowMargin.resultado)}`,
            tone: lowMargin.margemPct < 10 ? 'critical' : 'warn',
            actionLabel: 'Proteger margem',
            drillType: 'decision',
            relatedTab: 'culturas',
            payload: { kind: 'cultureResult', cultura: lowMargin.cultura_nome }
        }));
    }

    if (lowMargin) {
        const prod = prodMap.get(lowMargin.cultura_nome);
        const custo = lowMargin.custos_variaveis + lowMargin.custos_fixos;
        cards.push(decisionCard({
            id: 'why-culture-result',
            question: `Por que ${lowMargin.cultura_nome} deu esse resultado?`,
            answer: `${lowMargin.cultura_nome} exige atenção: o custo relativo frente ao resultado reduz a eficiência econômica da cultura. Em uma operação real, isso orientaria investigar insumos, produtividade e preço médio.`,
            evidence: `Margem ${formatPct(lowMargin.margemPct)} · Produtividade média ${prod != null ? formatNumber(prod, 1) + ' sc/ha' : '—'}`,
            tone: 'warn',
            actionLabel: 'Ver composição',
            drillType: 'decision',
            payload: { kind: 'cultureResult', cultura: lowMargin.cultura_nome }
        }));
    }

    const leakTalhao = findMarginLeakTalhao(store.talhoes || []);
    if (leakTalhao) {
        cards.push(decisionCard({
            id: 'margin-leak-talhao',
            question: 'Qual talhão está consumindo margem?',
            answer: `${leakTalhao.talhao_codigo} combina custo elevado com resultado abaixo dos melhores talhões. Em uma base real, priorizaria auditoria técnica e revisão de manejo neste talhão.`,
            evidence: `Custo: ${formatCurrencyCompact(leakTalhao.custo_total)} · Produção: ${formatNumber(leakTalhao.producao_sc, 0)} sc · Resultado: ${formatCurrencyCompact(leakTalhao.resultado_estimado)}`,
            tone: Number(leakTalhao.resultado_estimado) < 0 ? 'critical' : 'warn',
            actionLabel: 'Analisar talhão',
            drillType: 'marginLeak',
            relatedTab: 'operacoes',
            payload: { talhaoCodigo: leakTalhao.talhao_codigo }
        }));
    }

    const topCustoTalhao = topBy(store.talhoes || [], 'custo_total');
    if (topCustoTalhao) {
        const totalCusto = sumField(store.talhoes || [], 'custo_total');
        cards.push(decisionCard({
            id: 'cost-concentration',
            question: 'Onde está concentrado o custo?',
            answer: `Os maiores custos estão concentrados em poucos talhões, com destaque para ${topCustoTalhao.talhao_codigo}. Esse padrão indica prioridade de investigar composição de custo e eficiência operacional.`,
            evidence: `${topCustoTalhao.talhao_codigo}: ${formatPct(pctShare(topCustoTalhao.custo_total, totalCusto))} do custo operacional analisado`,
            tone: 'warn',
            actionLabel: 'Ver talhão',
            drillType: 'costConcentration',
            relatedTab: 'operacoes',
            payload: { talhaoCodigo: topCustoTalhao.talhao_codigo, cultura: topCustoTalhao.cultura_nome }
        }));
    }

    const topMaquina = topBy(store.maquinas || [], 'custo_total');
    if (topMaquina) {
        cards.push(decisionCard({
            id: 'top-resource',
            question: 'Qual recurso operacional mais pesa?',
            answer: `${topMaquina.equipamento_nome} concentra o maior custo operacional da safra demonstrativa (${formatCurrencyCompact(topMaquina.custo_total)}). Acompanhar horas e custo/hora ajuda a dimensionar frota e manutenção.`,
            evidence: `${formatNumber(topMaquina.horas_totais, 1)} h · ${formatNumber(topMaquina.apontamentos, 0)} apontamentos`,
            tone: 'info',
            actionLabel: 'Ver máquina',
            drillType: 'decision',
            relatedTab: 'operacoes',
            payload: { kind: 'machine', equipamento: topMaquina.equipamento_nome }
        }));
    }

    if (comercial.totalPendente > 0) {
        const cult = comercial.topPendente?.cultura_nome || '—';
        cards.push(decisionCard({
            id: 'volume-pendente',
            question: 'Qual volume ainda precisa ser entregue?',
            answer: `Ainda há ${formatNumber(comercial.totalPendente, 0)} sc pendentes de entrega, concentradas principalmente em ${cult}. Acompanhar logística e janela de entrega protege o faturamento.`,
            evidence: `Contratado: ${formatNumber(comercial.totalContratado, 0)} sc · Entregue: ${formatNumber(comercial.totalEntregue, 0)} sc`,
            tone: 'warn',
            actionLabel: 'Ver comercialização',
            drillType: 'commercialCulture',
            relatedTab: 'perguntas',
            payload: { cultura: cult }
        }));
    }

    const topCom = comercial.rows.length
        ? [...comercial.rows].sort((a, b) => b.volume_contratado_sc - a.volume_contratado_sc)[0]
        : null;
    if (topCom) {
        cards.push(decisionCard({
            id: 'comercial-culture',
            question: 'Quanto já foi contratado e entregue?',
            answer: `${topCom.cultura_nome} possui ${formatNumber(topCom.volume_contratado_sc, 0)} sc contratadas, com ${formatPct(topCom.pct_entregue)} já entregue. Visão agregada por cultura — contrato individual na próxima camada.`,
            evidence: `Saldo a entregar: ${formatNumber(topCom.volume_pendente_sc, 0)} sc · Valor: ${formatCurrencyCompact(topCom.valor_contratado)}`,
            tone: Number(topCom.pct_entregue) < 80 ? 'warn' : 'positive',
            actionLabel: 'Detalhar cultura',
            drillType: 'commercialCulture',
            payload: { cultura: topCom.cultura_nome }
        }));
    }

    if (cashMonths.length) {
        const maxPressao = [...cashMonths].sort((a, b) => b.pressao - a.pressao)[0];
        const minSaldo = [...cashMonths].sort((a, b) => a.saldoAcumulado - b.saldoAcumulado)[0];
        const target = maxPressao.pressao >= (minSaldo ? 0 : 1) ? maxPressao : minSaldo;
        cards.push(decisionCard({
            id: 'cash-pressure',
            question: 'Em quais meses há maior pressão de caixa?',
            answer: `${target.monthLabel} concentra maior pressão de caixa na safra demonstrativa. Em uma operação real, antecipar entradas ou reduzir saídas nesse período protege liquidez.`,
            evidence: `Saídas: ${formatCurrencyCompact(target.saidas)} · Entradas: ${formatCurrencyCompact(target.entradas)} · Saldo acum.: ${formatCurrencyCompact(target.saldoAcumulado)}`,
            tone: 'warn',
            actionLabel: 'Ver mês',
            drillType: 'cashMonth',
            relatedTab: 'financeiro',
            payload: { monthKey: target.monthKey, monthLabel: target.monthLabel }
        }));
    }

    const alertCount = cards.filter(c => c.tone === 'warn' || c.tone === 'critical').length;
    cards.push(decisionCard({
        id: 'gestor-attention',
        question: 'Quais pontos exigem atenção do gestor?',
        answer: alertCount > 0
            ? `${alertCount} indicadores exigem acompanhamento prioritário nesta safra demonstrativa. Priorize margem, concentração de custo, entregas pendentes e pressão de caixa.`
            : 'A safra demonstrativa apresenta indicadores equilibrados. Em uma base real, manter rotina de revisão semanal dos KPIs críticos.',
        evidence: `Resultado consolidado: ${formatCurrencyCompact(resultadoTotal)} · Margem: ${formatPct(receitaTotal ? (resultadoTotal / receitaTotal) * 100 : 0)}`,
        tone: alertCount >= 3 ? 'critical' : alertCount > 0 ? 'warn' : 'positive',
        actionLabel: 'Ver resumo',
        drillType: 'decision',
        payload: { kind: 'attentionSummary', alertCount }
    }));

    return cards;
}

export function buildDecisionDrilldown(card, store) {
    const st = toneToStatus(card.tone);
    const payload = card.payload || {};

    if (card.drillType === 'marginLeak' || card.drillType === 'costConcentration') {
        const t = (store.talhoes || []).find(x => x.talhao_codigo === payload.talhaoCodigo);
        if (!t) return null;
        return {
            title: card.question,
            subtitle: `${t.talhao_codigo} · ${t.cultura_nome}`,
            status: st.status,
            statusLabel: st.label,
            metrics: [
                { label: 'Cultura', value: t.cultura_nome },
                { label: 'Custo total', value: formatCurrency(t.custo_total), highlight: true },
                { label: 'Resultado estimado', value: formatCurrency(t.resultado_estimado) },
                { label: 'Produção', value: formatNumber(t.producao_sc, 0) + ' sc' },
                { label: 'Preço médio (sc)', value: formatCurrency(t.preco_medio_sc) }
            ],
            insight: {
                title: 'Interpretação gerencial',
                text: card.answer,
                tone: card.tone === 'critical' ? 'warn' : card.tone
            },
            nextAction: 'Em uma operação real: investigar composição de custo, revisar manejo e comparar produtividade com talhões de referência.'
        };
    }

    if (card.drillType === 'commercialCulture') {
        const row = buildCommercialSummary(store.comercial).rows.find(r => r.cultura_nome === payload.cultura);
        if (!row) return null;
        return {
            title: `Comercialização — ${row.cultura_nome}`,
            subtitle: 'Visão agregada por cultura (sem contrato individual)',
            status: Number(row.pct_entregue) >= 80 ? 'ok' : 'attention',
            statusLabel: Number(row.pct_entregue) >= 80 ? 'No prazo' : 'Acompanhar',
            metrics: [
                { label: 'Volume contratado', value: formatNumber(row.volume_contratado_sc, 0) + ' sc' },
                { label: 'Volume entregue', value: formatNumber(row.volume_entregue_sc, 0) + ' sc' },
                { label: 'Saldo a entregar', value: formatNumber(row.volume_pendente_sc, 0) + ' sc', highlight: true },
                { label: '% entregue', value: formatPct(row.pct_entregue) },
                { label: 'Valor contratado', value: formatCurrency(row.valor_contratado) },
                { label: 'Contratos', value: formatNumber(row.qtd_contratos, 0) }
            ],
            insight: {
                title: 'Próxima camada',
                text: 'A análise por contrato individual depende da view vw_contratos_venda, prevista para a etapa seguinte.',
                tone: 'info'
            },
            nextAction: 'Dimensionar equipe logística e acompanhar janelas de entrega para proteger receita.'
        };
    }

    if (card.drillType === 'cashMonth') {
        const month = aggregateCashByMonth(store.fluxo).find(m => m.monthKey === payload.monthKey);
        if (!month) return null;
        return {
            title: `Pressão de caixa — ${month.monthLabel}`,
            subtitle: 'Fluxo realizado agregado por mês',
            status: month.pressao > 0 ? 'attention' : 'ok',
            statusLabel: month.pressao > 0 ? 'Pressão' : 'Confortável',
            metrics: [
                { label: 'Entradas', value: formatCurrency(month.entradas) },
                { label: 'Saídas', value: formatCurrency(month.saidas) },
                { label: 'Saldo do mês', value: formatCurrency(month.saldoMes), highlight: true },
                { label: 'Saldo acumulado', value: formatCurrency(month.saldoAcumulado) },
                { label: 'Movimentos', value: formatNumber(month.movimentos, 0) }
            ],
            insight: {
                title: 'Gestão de liquidez',
                text: card.answer,
                tone: 'warn'
            },
            nextAction: 'Reduzir pressão de caixa antecipando recebíveis ou reprogramando despesas não críticas.'
        };
    }

    if (payload.kind === 'cultureResult') {
        const byCulture = aggregateDreByCulture(store.dre || []);
        const row = byCulture.find(c => c.cultura_nome === payload.cultura);
        if (!row) return null;
        const receitaTotal = sumField(byCulture, 'receita_bruta');
        const margemPct = row.receita_bruta ? (row.resultado / row.receita_bruta) * 100 : 0;
        const prod = avgProdutividadeByCulture(store.produtividade).get(payload.cultura);
        const talhoes = (store.talhoes || []).filter(t => t.cultura_nome === payload.cultura).slice(0, 3);
        return {
            title: `Por que ${payload.cultura} deu esse resultado?`,
            subtitle: `${formatPct(pctShare(row.receita_bruta, receitaTotal))} da receita total`,
            status: st.status,
            statusLabel: st.label,
            metrics: [
                { label: 'Receita', value: formatCurrency(row.receita_bruta) },
                { label: 'Custos variáveis', value: formatCurrency(row.custos_variaveis) },
                { label: 'Despesas / fixos', value: formatCurrency(row.custos_fixos) },
                { label: 'Resultado', value: formatCurrency(row.resultado), highlight: true },
                { label: 'Margem %', value: formatPct(margemPct) },
                { label: 'Produtividade média', value: prod != null ? formatNumber(prod, 1) + ' sc/ha' : '—' },
                { label: 'Talhões relacionados', value: talhoes.map(t => t.talhao_codigo).join(', ') || '—' }
            ],
            insight: {
                title: 'Leitura executiva',
                text: card.answer,
                tone: card.tone
            },
            nextAction: 'Em uma base real: acompanhar preço médio, contratos e proteção de margem nesta cultura.'
        };
    }

    if (payload.kind === 'machine') {
        const m = (store.maquinas || []).find(x => x.equipamento_nome === payload.equipamento);
        if (!m) return null;
        return {
            title: card.question,
            subtitle: m.categoria || 'Equipamento',
            metrics: [
                { label: 'Horas', value: formatNumber(m.horas_totais, 1) + ' h' },
                { label: 'Custo', value: formatCurrency(m.custo_total), highlight: true },
                { label: 'Custo / hora', value: m.horas_totais ? formatCurrency(Number(m.custo_total) / Number(m.horas_totais)) : '—' }
            ],
            insight: { title: 'Dimensionamento', text: card.answer, tone: 'info' },
            nextAction: 'Revisar alocação de máquinas e manutenção preventiva para reduzir custo operacional.'
        };
    }

    return {
        title: card.question,
        subtitle: 'Resumo para decisão',
        status: st.status,
        statusLabel: st.label,
        metrics: [
            { label: 'Resposta', value: card.answer.slice(0, 120) + (card.answer.length > 120 ? '…' : ''), highlight: true },
            { label: 'Evidência', value: card.evidence }
        ],
        insight: {
            title: 'Ação sugerida',
            text: payload.kind === 'attentionSummary'
                ? 'Priorize revisão dos indicadores em atenção e cruze com planejamento operacional e financeiro.'
                : card.answer,
            tone: card.tone
        },
        nextAction: 'Use as abas Culturas, Operações e Financeiro para aprofundar cada dimensão.'
    };
}

export function renderDecisionCards(container, cards) {
    if (!container) return;
    container.innerHTML = cards.map(c => `
        <article class="decision-card decision-card--${c.tone}" data-decision-id="${c.id}">
            <div class="decision-card-head">
                <h3 class="decision-question">${c.question}</h3>
                <span class="status-pill status-pill--${c.tone === 'positive' ? 'ok' : c.tone === 'critical' ? 'critical' : c.tone === 'warn' ? 'attention' : 'ok'}">${c.tone === 'positive' ? 'Positivo' : c.tone === 'critical' ? 'Crítico' : c.tone === 'warn' ? 'Atenção' : 'Info'}</span>
            </div>
            <p class="decision-answer">${c.answer}</p>
            ${c.evidence ? `<p class="decision-evidence">${c.evidence}</p>` : ''}
            <button type="button" class="btn-decision" data-decision-id="${c.id}">${c.actionLabel}</button>
        </article>
    `).join('');
}

export function renderCashMatrix(container, fluxoRows, onMonthClick) {
    if (!container) return;
    const months = aggregateCashByMonth(fluxoRows);
    if (!months.length) {
        container.innerHTML = '<p class="insight-empty">Sem dados de fluxo de caixa.</p>';
        return;
    }
    const maxSaida = Math.max(...months.map(m => m.saidas), 1);
    const minSaldo = Math.min(...months.map(m => m.saldoAcumulado));
    const hotMonth = [...months].sort((a, b) => b.pressao - a.pressao)[0]?.monthKey;

    container.innerHTML = `
        <table class="cash-matrix">
            <thead>
                <tr>
                    <th>Indicador</th>
                    ${months.map(m => `<th class="${m.monthKey === hotMonth ? 'cash-matrix--hot' : ''}">${m.monthLabel}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="cash-matrix-label cash-matrix-label--in">Entradas</td>
                    ${months.map(m => `<td class="cash-cell cash-cell--in">${formatCurrencyCompact(m.entradas)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="cash-matrix-label cash-matrix-label--out">Saídas</td>
                    ${months.map(m => {
                        const intensity = Math.min(m.saidas / maxSaida, 1);
                        return `<td class="cash-cell cash-cell--out" style="--intensity:${intensity}">${formatCurrencyCompact(m.saidas)}</td>`;
                    }).join('')}
                </tr>
                <tr>
                    <td class="cash-matrix-label">Saldo do mês</td>
                    ${months.map(m => `<td class="cash-cell ${m.saldoMes >= 0 ? 'cash-cell--in' : 'cash-cell--out'}">${formatCurrencyCompact(m.saldoMes)}</td>`).join('')}
                </tr>
                <tr>
                    <td class="cash-matrix-label">Saldo acumulado</td>
                    ${months.map(m => `<td class="cash-cell ${m.saldoAcumulado === minSaldo ? 'cash-matrix--hot' : ''}">${formatCurrencyCompact(m.saldoAcumulado)}</td>`).join('')}
                </tr>
            </tbody>
        </table>
        <p class="cash-matrix-note">Clique em um mês para detalhar pressão de caixa.</p>
    `;

    container.querySelectorAll('thead th').forEach((th, i) => {
        if (i === 0) return;
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => onMonthClick?.(months[i - 1]));
    });
}
