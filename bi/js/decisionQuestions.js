/**
 * Perguntas do Gestor — respostas derivadas das views KPI já carregadas.
 */
import {
    formatCurrency,
    formatCurrencyCompact,
    formatNumber,
    formatPct,
    sumField
} from './api.js?v=4.4';
import { aggregateDreByCulture } from './insights.js?v=4.4';

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

function statusLabel(tone) {
    if (tone === 'positive') return 'Positivo';
    if (tone === 'critical') return 'Crítico';
    if (tone === 'warn') return 'Atenção';
    return 'Info';
}

function statusPillClass(tone) {
    if (tone === 'positive') return 'ok';
    if (tone === 'critical') return 'critical';
    if (tone === 'warn') return 'attention';
    return 'ok';
}

const DECISION_ICONS = {
    revenue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    margin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22V12"/><path d="M12 12C12 8 8 4 4 4c0 4 4 8 8 8z"/></svg>',
    talhao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    cost: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    machine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4"/></svg>',
    commercial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
};

function iconForCard(card) {
    const id = card.id || '';
    if (id.includes('receita') || id.includes('comercial-culture')) return DECISION_ICONS.revenue;
    if (id.includes('margin') || id.includes('why-culture')) return DECISION_ICONS.margin;
    if (id.includes('talhao') || id.includes('margin-leak')) return DECISION_ICONS.talhao;
    if (id.includes('cost')) return DECISION_ICONS.cost;
    if (id.includes('resource') || id.includes('machine')) return DECISION_ICONS.machine;
    if (id.includes('volume') || id.includes('pendente')) return DECISION_ICONS.commercial;
    if (id.includes('cash')) return DECISION_ICONS.cash;
    if (id.includes('attention') || id.includes('gestor')) return DECISION_ICONS.alert;
    return DECISION_ICONS.default;
}

function parseEvidenceLines(evidence) {
    if (!evidence) return [];
    return evidence.split('·').map(s => s.trim()).filter(Boolean);
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

export function renderDecisionCards(container, cards, selectedId = null) {
    if (!container) return;
    container.innerHTML = cards.map(c => `
        <article class="decision-card decision-card--${c.tone}${c.id === selectedId ? ' active' : ''}" data-decision-id="${c.id}" role="button" tabindex="0">
            <div class="decision-card-top">
                <span class="decision-card-icon" aria-hidden="true">${iconForCard(c)}</span>
                <div class="decision-card-head">
                    <h3 class="decision-question">${c.question}</h3>
                    <span class="status-pill status-pill--${statusPillClass(c.tone)}">${statusLabel(c.tone)}</span>
                </div>
            </div>
            <p class="decision-answer">${c.answer}</p>
            ${c.evidence ? `<p class="decision-evidence">${c.evidence}</p>` : ''}
            <span class="decision-card-cta">Ver análise →</span>
        </article>
    `).join('');
}

export function renderSelectedQuestionPanel(container, card, store) {
    if (!container) return;
    if (!card) {
        container.innerHTML = '<p class="insight-empty">Selecione uma pergunta para ver a análise.</p>';
        return;
    }
    const drill = buildDecisionDrilldown(card, store);
    const st = toneToStatus(card.tone);
    const evidenceLines = drill?.metrics?.length
        ? drill.metrics.map(m => `<li><strong>${m.label}:</strong> ${m.value}</li>`).join('')
        : parseEvidenceLines(card.evidence).map(line => `<li>${line}</li>`).join('');
    const interpretation = drill?.insight?.text || card.answer;
    const nextAction = drill?.nextAction || 'Aprofundar análise nas abas relacionadas do cockpit.';

    container.innerHTML = `
        <p class="selected-panel-heading">Análise selecionada</p>
        <p class="selected-panel-question">${card.question}</p>
        <span class="status-pill status-pill--${st.status}">${st.label}</span>
        <div class="selected-panel-section">
            <h4>Resposta executiva</h4>
            <p>${card.answer}</p>
        </div>
        ${evidenceLines ? `
        <div class="selected-panel-section">
            <h4>Evidências</h4>
            <ul class="selected-panel-evidence">${evidenceLines}</ul>
        </div>` : ''}
        <div class="selected-panel-section">
            <h4>Interpretação</h4>
            <p class="selected-panel-interpretation">${interpretation}</p>
        </div>
        <div class="selected-panel-section">
            <h4>Próxima ação sugerida</h4>
            <p class="selected-panel-action">${nextAction}</p>
        </div>
        <button type="button" class="btn-open-drill" data-open-drill="${card.id}">Abrir análise completa</button>
    `;
}

export function renderCommercialRanking(container, comercialRows, onCultureClick) {
    if (!container) return;
    const rows = [...(comercialRows || [])]
        .map(r => ({
            ...r,
            volume_pendente_sc: Math.max(Number(r.volume_contratado_sc || 0) - Number(r.volume_entregue_sc || 0), 0)
        }))
        .filter(r => r.volume_pendente_sc > 0)
        .sort((a, b) => b.volume_pendente_sc - a.volume_pendente_sc)
        .slice(0, 5);

    if (!rows.length) {
        container.innerHTML = '<p class="insight-empty">Nenhum saldo pendente de entrega.</p>';
        return;
    }

    container.innerHTML = rows.map(r => `
        <div class="comercial-rank-row" data-culture="${r.cultura_nome}">
            <div>
                <div class="comercial-rank-name">${r.cultura_nome}</div>
                <div class="comercial-rank-meta">${formatPct(r.pct_entregue)} entregue · ${formatNumber(r.volume_contratado_sc, 0)} sc contratadas</div>
            </div>
            <span class="comercial-rank-value">${formatNumber(r.volume_pendente_sc, 0)} sc</span>
        </div>
    `).join('');

    container.querySelectorAll('[data-culture]').forEach(row => {
        row.addEventListener('click', () => onCultureClick?.(row.dataset.culture));
    });
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
    `;

    container.querySelectorAll('thead th').forEach((th, i) => {
        if (i === 0) return;
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => onMonthClick?.(months[i - 1]));
    });
}
