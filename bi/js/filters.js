/**
 * Filtros inteligentes em cascata — estado, engine e painel UI.
 */
const STORAGE_KEY = 'bi-agro-filters-v1';

export const VISAO_OPTIONS = [
    { id: null, label: 'Todas as visões' },
    { id: 'producao', label: 'Produção' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'comercializacao', label: 'Comercialização' },
    { id: 'operacoes', label: 'Operações' },
    { id: 'estoque', label: 'Estoque' }
];

export const STATUS_COMERCIAL = [
    { id: 'entregue', label: 'Entregue' },
    { id: 'parcial', label: 'Parcial' },
    { id: 'pendente', label: 'Pendente' }
];

const TAB_FILTER_KEYS = {
    'visao-geral': ['safra', 'culturas', 'talhoes', 'meses', 'categorias', 'visao'],
    culturas: ['safra', 'culturas', 'talhoes', 'visao'],
    estoques: ['culturas', 'talhoes', 'categorias', 'visao'],
    'dre-gerencial': ['safra', 'culturas', 'meses', 'categorias', 'visao'],
    comercializacao: ['safra', 'culturas', 'status', 'visao'],
    caixa: ['meses', 'categorias', 'visao'],
    operacoes: ['safra', 'culturas', 'talhoes', 'operacoes', 'categorias', 'visao'],
    perguntas: ['safra', 'culturas', 'talhoes', 'meses', 'status', 'visao'],
    sobre: []
};

const STORE_KEYS = [
    'dre', 'margem', 'resultado', 'custoHa', 'comercial', 'produtividade',
    'insumos', 'producao', 'fluxo', 'talhoes', 'maquinas', 'maoObra',
    'dreResumo', 'dreContabil', 'dreCulturaComp', 'balanceteGerencial', 'kpisContabeis', 'dreDrilldown'
];

export function createEmptyFilterState() {
    return {
        safra: null,
        culturas: [],
        talhoes: [],
        meses: [],
        categorias: [],
        operacoes: [],
        clientes: [],
        status: [],
        visao: null
    };
}

export function loadFilterState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createEmptyFilterState();
        const parsed = JSON.parse(raw);
        return { ...createEmptyFilterState(), ...parsed };
    } catch {
        return createEmptyFilterState();
    }
}

export function saveFilterState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
}

export function clearFilterStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
}

function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}

function monthKeyFromRow(row) {
    if (row.data_movimento) return row.data_movimento.slice(0, 7);
    if (row.ano != null && row.mes != null) {
        return `${row.ano}-${String(row.mes).padStart(2, '0')}`;
    }
    return null;
}

function monthLabel(key) {
    if (!key) return '';
    const [y, m] = key.split('-');
    const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${names[Number(m) - 1] || m}/${y?.slice(2) || ''}`;
}

function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
}

function matchesArrayFilter(value, selected) {
    if (!selected?.length) return true;
    return selected.includes(value);
}

function commercialStatus(row) {
    const pct = Number(row.pct_entregue || 0);
    if (pct >= 100) return 'entregue';
    if (pct > 0) return 'parcial';
    return 'pendente';
}

export function applyFiltersToDataset(rows, filterState, mapping = {}) {
    if (!rows?.length) return rows || [];
    return rows.filter(row => {
        if (mapping.safra && filterState.safra) {
            const field = mapping.safra;
            const val = typeof field === 'function' ? field(row) : row[field];
            if (val != null && val !== filterState.safra) return false;
        }
        if (mapping.cultura && filterState.culturas?.length) {
            const field = mapping.cultura;
            const val = typeof field === 'function' ? field(row) : row[field];
            if (val != null && !filterState.culturas.includes(val)) return false;
        }
        if (mapping.talhao && filterState.talhoes?.length) {
            const field = mapping.talhao;
            const val = typeof field === 'function' ? field(row) : row[field];
            if (val != null && !filterState.talhoes.includes(val)) return false;
        }
        if (mapping.mes && filterState.meses?.length) {
            const field = mapping.mes;
            const val = typeof field === 'function' ? field(row) : row[field];
            if (val != null && !filterState.meses.includes(val)) return false;
        }
        if (mapping.categoria && filterState.categorias?.length) {
            const field = mapping.categoria;
            const val = typeof field === 'function' ? field(row) : row[field];
            if (val != null && !filterState.categorias.includes(val)) return false;
        }
        if (mapping.operacao && filterState.operacoes?.length) {
            const field = mapping.operacao;
            const val = typeof field === 'function' ? field(row) : row[field];
            if (val != null && !filterState.operacoes.includes(val)) return false;
        }
        if (mapping.status && filterState.status?.length) {
            const st = typeof mapping.status === 'function' ? mapping.status(row) : commercialStatus(row);
            if (!filterState.status.includes(st)) return false;
        }
        return true;
    });
}

const DATASET_MAPPINGS = {
    dre: { safra: 'safra_codigo', cultura: 'cultura_nome', mes: monthKeyFromRow },
    margem: { safra: 'safra_codigo', cultura: 'cultura_nome' },
    resultado: { safra: 'safra_codigo', cultura: 'cultura_nome' },
    custoHa: { safra: 'safra_codigo', cultura: 'cultura_nome' },
    comercial: { safra: 'safra_codigo', cultura: 'cultura_nome', status: commercialStatus },
    produtividade: { safra: 'safra_codigo', cultura: 'cultura_nome', talhao: 'talhao_codigo' },
    insumos: { categoria: 'categoria' },
    producao: { safra: 'safra_codigo', cultura: 'cultura_nome', talhao: 'talhao_codigo' },
    fluxo: { mes: monthKeyFromRow, categoria: 'categoria' },
    talhoes: { safra: 'safra_codigo', cultura: 'cultura_nome', talhao: 'talhao_codigo' },
    maquinas: { safra: 'safra_codigo', categoria: 'categoria', operacao: 'equipamento_nome' },
    maoObra: { safra: 'safra_codigo', operacao: r => r.colaborador_nome || r.equipe },
    dreResumo: { safra: 'safra_codigo', cultura: 'cultura_nome', mes: monthKeyFromRow },
    dreContabil: { safra: 'safra_codigo', cultura: 'cultura_nome', mes: monthKeyFromRow, categoria: 'grupo_dre' },
    dreCulturaComp: { safra: 'safra_codigo', cultura: 'cultura_nome' },
    balanceteGerencial: { mes: monthKeyFromRow, categoria: 'grupo_dre' },
    kpisContabeis: { safra: 'safra_codigo', mes: monthKeyFromRow },
    dreDrilldown: { safra: 'safra_codigo', cultura: 'cultura_nome', mes: monthKeyFromRow, categoria: 'grupo_dre' }
};

function filterPool(store, partialState) {
    const out = {};
    STORE_KEYS.forEach(key => {
        out[key] = applyFiltersToDataset(store[key] || [], partialState, DATASET_MAPPINGS[key] || {});
    });
    return out;
}

export function buildFilterOptions(store, draftState = createEmptyFilterState()) {
    const poolSafra = filterPool(store, { ...draftState, safra: null });
    const poolCultura = filterPool(store, { ...draftState, culturas: [] });
    const poolTalhao = filterPool(store, { ...draftState, talhoes: [] });

    const collect = (datasets, mapper) => uniqueSorted(
        datasets.flatMap(ds => (ds || []).map(mapper).filter(Boolean))
    );

    const allPools = filterPool(store, createEmptyFilterState());

    return {
        safras: collect(
            [allPools.dre, allPools.margem, allPools.talhoes, allPools.comercial, allPools.maquinas],
            r => r.safra_codigo
        ),
        culturas: collect(
            [poolSafra.dre, poolSafra.margem, poolSafra.talhoes, poolSafra.comercial, poolSafra.produtividade, poolSafra.producao],
            r => r.cultura_nome
        ),
        talhoes: collect(
            [poolCultura.talhoes, poolCultura.produtividade, poolCultura.producao],
            r => r.talhao_codigo
        ),
        meses: uniqueSorted([
            ...collect([allPools.fluxo], monthKeyFromRow),
            ...collect([allPools.dre, allPools.dreResumo], monthKeyFromRow)
        ]).map(key => ({ key, label: monthLabel(key) })),
        categorias: collect(
            [allPools.insumos, allPools.maquinas, allPools.fluxo],
            r => r.categoria
        ),
        operacoes: uniqueSorted([
            ...collect([allPools.maquinas], r => r.equipamento_nome),
            ...collect([allPools.maoObra], r => r.colaborador_nome),
            ...collect([allPools.maoObra], r => r.equipe)
        ]),
        status: STATUS_COMERCIAL.map(s => s.id),
        visoes: VISAO_OPTIONS
    };
}

export function getFilteredStore(store, filterState) {
    const filtered = {};
    STORE_KEYS.forEach(key => {
        filtered[key] = applyFiltersToDataset(store[key] || [], filterState, DATASET_MAPPINGS[key] || {});
    });
    return filtered;
}

export function countActiveFilters(state) {
    let n = 0;
    if (state.safra) n += 1;
    n += (state.culturas?.length || 0);
    n += (state.talhoes?.length || 0);
    n += (state.meses?.length || 0);
    n += (state.categorias?.length || 0);
    n += (state.operacoes?.length || 0);
    n += (state.clientes?.length || 0);
    n += (state.status?.length || 0);
    if (state.visao) n += 1;
    return n;
}

export function formatFilterSummary(state) {
    const parts = [];
    if (state.safra) parts.push(`Safra ${state.safra}`);
    if (state.culturas?.length) parts.push(state.culturas.join(', '));
    if (state.talhoes?.length) {
        parts.push(state.talhoes.length <= 2
            ? state.talhoes.join(', ')
            : `${state.talhoes.length} talhões`);
    }
    if (state.meses?.length) {
        parts.push(state.meses.length <= 2
            ? state.meses.map(monthLabel).join('–')
            : `${state.meses.length} meses`);
    }
    if (state.categorias?.length) parts.push(state.categorias.slice(0, 2).join(', '));
    if (state.operacoes?.length) parts.push(`${state.operacoes.length} operações`);
    if (state.status?.length) parts.push(state.status.join(', '));
    if (state.visao) {
        const v = VISAO_OPTIONS.find(o => o.id === state.visao);
        if (v) parts.push(v.label);
    }
    return parts.length ? parts.join(' · ') : 'Toda a fazenda · Todas as culturas · Safra completa';
}

export function getFilterImpactTabs(state) {
    const tabs = new Set(['Visão Geral', 'Culturas', 'Operações']);
    if (state.culturas?.length || state.status?.length) tabs.add('Comercialização');
    if (state.meses?.length || state.categorias?.length) tabs.add('Caixa');
    if (state.categorias?.length) tabs.add('Estoques');
    if (state.safra || state.culturas?.length) tabs.add('Financeiro');
    if (countActiveFilters(state)) tabs.add('Perguntas');
    return [...tabs];
}

export function tabHasPartialFilters(tabId, state) {
    if (!countActiveFilters(state)) return false;
    const activeKeys = new Set();
    if (state.safra) activeKeys.add('safra');
    (state.culturas || []).forEach(() => activeKeys.add('culturas'));
    (state.talhoes || []).forEach(() => activeKeys.add('talhoes'));
    (state.meses || []).forEach(() => activeKeys.add('meses'));
    (state.categorias || []).forEach(() => activeKeys.add('categorias'));
    (state.operacoes || []).forEach(() => activeKeys.add('operacoes'));
    (state.status || []).forEach(() => activeKeys.add('status'));
    if (state.visao) activeKeys.add('visao');

    const tabKeys = TAB_FILTER_KEYS[tabId] || [];
    const applicable = tabKeys.some(k => activeKeys.has(k));
    if (!applicable && countActiveFilters(state) > 0) return true;

    const irrelevant = [];
    if (activeKeys.has('talhoes') && !tabKeys.includes('talhoes')) irrelevant.push('talhão');
    if (activeKeys.has('meses') && !tabKeys.includes('meses')) irrelevant.push('período');
    if (activeKeys.has('status') && !tabKeys.includes('status')) irrelevant.push('status comercial');
    if (activeKeys.has('operacoes') && !tabKeys.includes('operacoes')) irrelevant.push('operação');
    return irrelevant.length > 0;
}

export function getFilterContextLabel(state) {
    const summary = formatFilterSummary(state);
    return summary === 'Toda a fazenda · Todas as culturas · Safra completa'
        ? ''
        : `Recorte atual: ${summary}`;
}

export function isStoreEmptyForTab(tabId, filteredStore) {
    const checks = {
        'visao-geral': () => !(filteredStore.dre?.length || filteredStore.talhoes?.length),
        culturas: () => !filteredStore.resultado?.length && !filteredStore.dre?.length,
        estoques: () => !filteredStore.insumos?.length && !filteredStore.producao?.length,
        'dre-gerencial': () => !filteredStore.dreResumo?.length && !filteredStore.dreContabil?.length,
        comercializacao: () => !filteredStore.comercial?.length,
        caixa: () => !filteredStore.fluxo?.length,
        operacoes: () => !filteredStore.talhoes?.length && !filteredStore.maquinas?.length,
        perguntas: () => !filteredStore.dre?.length && !filteredStore.talhoes?.length
    };
    return checks[tabId]?.() ?? false;
}

export function buildFilterPresets(store) {
    const months = (store.fluxo || []).map(monthKeyFromRow).filter(Boolean);
    const monthCounts = {};
    (store.fluxo || []).forEach(r => {
        const k = monthKeyFromRow(r);
        if (!k) return;
        if (!monthCounts[k]) monthCounts[k] = { entradas: 0, saidas: 0 };
        const v = Number(r.valor || 0);
        if (r.tipo === 'entrada') monthCounts[k].entradas += v;
        else monthCounts[k].saidas += v;
    });
    const hotMonth = Object.entries(monthCounts)
        .map(([key, v]) => ({ key, pressao: v.saidas - v.entradas }))
        .sort((a, b) => b.pressao - a.pressao)[0];

    const talhoesCriticos = [...(store.talhoes || [])]
        .sort((a, b) => Number(a.resultado_estimado) - Number(b.resultado_estimado))
        .slice(0, 3)
        .map(t => t.talhao_codigo);

    const culturasAtencao = [...(store.dre || [])]
        .filter(r => r.receita_bruta > 0)
        .map(r => ({ nome: r.cultura_nome, margem: (r.resultado / r.receita_bruta) * 100 }))
        .sort((a, b) => a.margem - b.margem)
        .slice(0, 2)
        .map(c => c.nome);

    const topPendente = [...(store.comercial || [])]
        .map(r => ({
            ...r,
            pendente: Math.max(Number(r.volume_contratado_sc || 0) - Number(r.volume_entregue_sc || 0), 0)
        }))
        .sort((a, b) => b.pendente - a.pendente)[0];

    const topMaquina = [...(store.maquinas || [])].sort((a, b) => Number(b.custo_total) - Number(a.custo_total))[0];

    return [
        {
            id: 'soja',
            label: 'Soja',
            tab: 'culturas',
            build: () => ({ ...createEmptyFilterState(), culturas: ['Soja'] })
        },
        {
            id: 'cafe',
            label: 'Café',
            tab: 'culturas',
            build: () => ({ ...createEmptyFilterState(), culturas: ['Café'] })
        },
        {
            id: 'culturas-atencao',
            label: 'Culturas com atenção',
            tab: 'culturas',
            build: () => ({ ...createEmptyFilterState(), culturas: culturasAtencao.filter(Boolean) })
        },
        {
            id: 'talhoes-criticos',
            label: 'Talhões críticos',
            tab: 'operacoes',
            build: () => ({ ...createEmptyFilterState(), talhoes: talhoesCriticos.filter(Boolean) })
        },
        {
            id: 'pressao-caixa',
            label: 'Maior pressão de caixa',
            tab: 'caixa',
            build: () => ({ ...createEmptyFilterState(), meses: hotMonth ? [hotMonth.key] : months.slice(0, 1) })
        },
        {
            id: 'saldo-entregar',
            label: 'Saldo a entregar',
            tab: 'comercializacao',
            build: () => ({
                ...createEmptyFilterState(),
                culturas: topPendente?.cultura_nome ? [topPendente.cultura_nome] : [],
                status: ['parcial', 'pendente']
            })
        },
        {
            id: 'maior-custo',
            label: 'Operações de maior custo',
            tab: 'operacoes',
            build: () => ({
                ...createEmptyFilterState(),
                operacoes: topMaquina?.equipamento_nome ? [topMaquina.equipamento_nome] : []
            })
        }
    ];
}

function toggleArrayValue(arr, value) {
    const set = new Set(arr || []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return [...set];
}

function optionValue(opt) {
    if (opt == null) return null;
    if (typeof opt === 'object') return opt.key ?? opt.id;
    return opt;
}

function optionLabel(opt, labelFn) {
    if (labelFn) return labelFn(opt);
    if (opt == null) return 'Todas';
    if (typeof opt === 'object') return opt.label ?? String(opt.key ?? opt.id ?? '');
    return String(opt);
}

function renderOptionGroup(container, { title, options, selected, multi, onChange, labelFn }) {
    if (!container) return;
    const wrap = document.createElement('div');
    wrap.className = 'filter-group';
    wrap.innerHTML = `<h4 class="filter-group-title">${title}</h4>`;
    const opts = document.createElement('div');
    opts.className = 'filter-options';

    options.forEach(opt => {
        const value = optionValue(opt);
        const label = optionLabel(opt, labelFn);
        const isActive = multi
            ? (selected || []).includes(value)
            : selected === value || (value == null && !selected);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `filter-option${isActive ? ' active' : ''}`;
        btn.textContent = label;
        btn.addEventListener('click', () => onChange(value, btn));
        opts.appendChild(btn);
    });

    wrap.appendChild(opts);
    container.appendChild(wrap);
}

export function initFilters({
    getStore,
    getFilterState,
    setFilterState,
    onApply,
    onClear,
    getActiveTab,
    switchTab
}) {
    const drawer = document.getElementById('filter-drawer');
    const backdrop = document.getElementById('filter-backdrop');
    const openBtn = document.getElementById('btn-filters');
    const closeBtn = document.getElementById('filter-close');
    const applyBtn = document.getElementById('filter-apply');
    const clearBtn = document.getElementById('filter-clear');
    const panelBody = document.getElementById('filter-panel-body');
    const chipsBar = document.getElementById('filter-chips-bar');
    const badge = document.getElementById('filter-badge');
    const countEl = document.getElementById('filter-active-count');
    const impactEl = document.getElementById('filter-impact');
    const toast = document.getElementById('filter-toast');
    const presetsEl = document.getElementById('filter-presets');

    let draftState = cloneState(getFilterState());
    let toastTimer = null;

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
    }

    function updateChrome(state) {
        const count = countActiveFilters(state);
        if (badge) {
            badge.textContent = String(count);
            badge.classList.toggle('hidden', count === 0);
        }
        if (countEl) countEl.textContent = `${count} filtro${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}`;
        if (impactEl) {
            impactEl.textContent = count
                ? `Afeta: ${getFilterImpactTabs(state).join(', ')}`
                : 'Nenhum recorte aplicado — visão consolidada da safra.';
        }
        if (chipsBar) {
            const summary = formatFilterSummary(state);
            chipsBar.innerHTML = count
                ? `<span class="filter-chips-label">Filtros:</span><span class="filter-chips-text">${summary}</span>`
                : `<span class="filter-chips-text filter-chips-text--muted">${summary}</span>`;
        }
    }

    function renderPanel() {
        if (!panelBody) return;
        const store = getStore();
        const options = buildFilterOptions(store, draftState);
        panelBody.innerHTML = '';

        renderOptionGroup(panelBody, {
            title: 'Safra',
            options: [null, ...options.safras],
            selected: draftState.safra,
            multi: false,
            labelFn: opt => opt == null ? 'Todas' : opt,
            onChange: value => {
                draftState.safra = value;
                draftState.culturas = draftState.culturas.filter(c => options.culturas.includes(c));
                draftState.talhoes = draftState.talhoes.filter(t => buildFilterOptions(store, draftState).talhoes.includes(t));
                renderPanel();
            }
        });

        renderOptionGroup(panelBody, {
            title: 'Cultura',
            options: options.culturas,
            selected: draftState.culturas,
            multi: true,
            onChange: value => {
                draftState.culturas = toggleArrayValue(draftState.culturas, value);
                draftState.talhoes = draftState.talhoes.filter(t => buildFilterOptions(store, draftState).talhoes.includes(t));
                renderPanel();
            }
        });

        renderOptionGroup(panelBody, {
            title: 'Talhão',
            options: options.talhoes,
            selected: draftState.talhoes,
            multi: true,
            onChange: value => {
                draftState.talhoes = toggleArrayValue(draftState.talhoes, value);
                renderPanel();
            }
        });

        renderOptionGroup(panelBody, {
            title: 'Período',
            options: options.meses,
            selected: draftState.meses,
            multi: true,
            labelFn: opt => opt.label,
            onChange: value => {
                draftState.meses = toggleArrayValue(draftState.meses, value);
                renderPanel();
            }
        });

        if (options.categorias.length) {
            renderOptionGroup(panelBody, {
                title: 'Categoria',
                options: options.categorias,
                selected: draftState.categorias,
                multi: true,
                onChange: value => {
                    draftState.categorias = toggleArrayValue(draftState.categorias, value);
                    renderPanel();
                }
            });
        }

        if (options.operacoes.length) {
            renderOptionGroup(panelBody, {
                title: 'Operação / recurso',
                options: options.operacoes.slice(0, 12),
                selected: draftState.operacoes,
                multi: true,
                onChange: value => {
                    draftState.operacoes = toggleArrayValue(draftState.operacoes, value);
                    renderPanel();
                }
            });
        }

        renderOptionGroup(panelBody, {
            title: 'Status comercial',
            options: STATUS_COMERCIAL,
            selected: draftState.status,
            multi: true,
            labelFn: opt => opt.label,
            onChange: value => {
                draftState.status = toggleArrayValue(draftState.status, value);
                renderPanel();
            }
        });

        renderOptionGroup(panelBody, {
            title: 'Tipo de visão',
            options: VISAO_OPTIONS,
            selected: draftState.visao,
            multi: false,
            labelFn: opt => opt.label,
            onChange: value => {
                draftState.visao = value;
                renderPanel();
            }
        });

        updateChrome(draftState);
    }

    function renderPresets() {
        if (!presetsEl) return;
        const presets = buildFilterPresets(getStore());
        presetsEl.innerHTML = presets.map(p => `
            <button type="button" class="filter-preset" data-preset="${p.id}">${p.label}</button>
        `).join('');
        presetsEl.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = presets.find(p => p.id === btn.dataset.preset);
                if (!preset) return;
                draftState = preset.build();
                setFilterState(cloneState(draftState));
                saveFilterState(getFilterState());
                updateChrome(getFilterState());
                closePanel();
                onApply?.();
                showToast(`Recorte: ${preset.label}`);
                if (preset.tab && switchTab) switchTab(preset.tab);
            });
        });
    }

    function openPanel() {
        draftState = cloneState(getFilterState());
        renderPresets();
        renderPanel();
        backdrop?.classList.add('open');
        drawer?.classList.add('open');
        drawer?.setAttribute('aria-hidden', 'false');
        document.body.classList.add('filter-open');
    }

    function closePanel() {
        backdrop?.classList.remove('open');
        drawer?.classList.remove('open');
        drawer?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('filter-open');
    }

    openBtn?.addEventListener('click', openPanel);
    closeBtn?.addEventListener('click', closePanel);
    backdrop?.addEventListener('click', closePanel);

    applyBtn?.addEventListener('click', () => {
        setFilterState(cloneState(draftState));
        saveFilterState(getFilterState());
        updateChrome(getFilterState());
        closePanel();
        onApply?.();
        showToast('Filtros aplicados');
        const visao = getFilterState().visao;
        if (visao && switchTab) {
            const map = {
                producao: 'culturas',
                'dre-gerencial': 'dre-gerencial',
                comercializacao: 'comercializacao',
                operacoes: 'operacoes',
                estoque: 'estoques'
            };
            if (map[visao]) switchTab(map[visao]);
        }
    });

    clearBtn?.addEventListener('click', () => {
        draftState = createEmptyFilterState();
        setFilterState(createEmptyFilterState());
        clearFilterStorage();
        renderPanel();
        updateChrome(getFilterState());
        closePanel();
        onClear?.();
        showToast('Filtros limpos');
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && drawer?.classList.contains('open')) closePanel();
    });

    chipsBar?.addEventListener('click', openPanel);

    updateChrome(getFilterState());

    return { updateChrome, showToast, openPanel, closePanel };
}
