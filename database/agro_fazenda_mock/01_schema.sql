-- 01_schema.sql — DDL completo do schema agro
SET search_path TO agro, public;

-- ============================================================
-- ESTRUTURA AGRÍCOLA
-- ============================================================

CREATE TABLE fazendas (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    razao_social    VARCHAR(200) NOT NULL,
    nome_fantasia   VARCHAR(200),
    cnpj            VARCHAR(18),
    inscricao_estadual VARCHAR(20),
    municipio       VARCHAR(100) NOT NULL,
    uf              CHAR(2) NOT NULL,
    area_total_ha   NUMERIC(18,4) NOT NULL CHECK (area_total_ha > 0),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE unidades_produtivas (
    id              BIGSERIAL PRIMARY KEY,
    fazenda_id      BIGINT NOT NULL REFERENCES fazendas(id),
    codigo          VARCHAR(20) NOT NULL,
    nome            VARCHAR(150) NOT NULL,
    tipo            VARCHAR(50) NOT NULL CHECK (tipo IN ('grãos', 'café', 'pecuária', 'mista')),
    area_ha         NUMERIC(18,4) NOT NULL CHECK (area_ha > 0),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (fazenda_id, codigo)
);
CREATE INDEX idx_unidades_produtivas_fazenda ON unidades_produtivas(fazenda_id);

CREATE TABLE culturas (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(50) NOT NULL CHECK (tipo IN ('grão', 'fibra', 'leguminosa', 'perene')),
    unidade_producao VARCHAR(20) NOT NULL DEFAULT 'saca',
    peso_saca_kg    NUMERIC(10,2),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE variedades (
    id              BIGSERIAL PRIMARY KEY,
    cultura_id      BIGINT NOT NULL REFERENCES culturas(id),
    codigo          VARCHAR(30) NOT NULL,
    nome            VARCHAR(150) NOT NULL,
    ciclo_dias      INTEGER,
    produtividade_esperada_sc_ha NUMERIC(10,2),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (cultura_id, codigo)
);
CREATE INDEX idx_variedades_cultura ON variedades(cultura_id);

CREATE TABLE safras (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    data_inicio     DATE NOT NULL,
    data_fim        DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'planejada'
                    CHECK (status IN ('planejada', 'em_andamento', 'encerrada')),
    CHECK (data_fim >= data_inicio)
);

CREATE TABLE talhoes (
    id                      BIGSERIAL PRIMARY KEY,
    unidade_produtiva_id    BIGINT NOT NULL REFERENCES unidades_produtivas(id),
    codigo                  VARCHAR(20) NOT NULL,
    nome                    VARCHAR(150) NOT NULL,
    area_ha                 NUMERIC(18,4) NOT NULL CHECK (area_ha > 0),
    latitude                NUMERIC(10,7),
    longitude               NUMERIC(10,7),
    tipo_solo               VARCHAR(50),
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unidade_produtiva_id, codigo)
);
CREATE INDEX idx_talhoes_unidade ON talhoes(unidade_produtiva_id);

CREATE TABLE historico_uso_solo (
    id              BIGSERIAL PRIMARY KEY,
    talhao_id       BIGINT NOT NULL REFERENCES talhoes(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    cultura_id      BIGINT NOT NULL REFERENCES culturas(id),
    variedade_id    BIGINT REFERENCES variedades(id),
    data_registro   DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao      TEXT
);
CREATE INDEX idx_historico_uso_solo_talhao ON historico_uso_solo(talhao_id);
CREATE INDEX idx_historico_uso_solo_safra ON historico_uso_solo(safra_id);

CREATE TABLE analises_solo (
    id              BIGSERIAL PRIMARY KEY,
    talhao_id       BIGINT NOT NULL REFERENCES talhoes(id),
    data_coleta     DATE NOT NULL,
    laboratorio     VARCHAR(150),
    ph              NUMERIC(4,2),
    materia_organica_pct NUMERIC(6,3),
    fosforo_ppm     NUMERIC(10,2),
    potassio_ppm    NUMERIC(10,2),
    calcio_cmol     NUMERIC(10,3),
    magnesio_cmol   NUMERIC(10,3),
    enxofre_ppm     NUMERIC(10,2),
    recomendacao    TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analises_solo_talhao ON analises_solo(talhao_id);

-- ============================================================
-- INSUMOS
-- ============================================================

CREATE TABLE unidades_medida (
    id              BIGSERIAL PRIMARY KEY,
    sigla           VARCHAR(10) NOT NULL UNIQUE,
    descricao       VARCHAR(100) NOT NULL
);

CREATE TABLE categorias_insumo (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(30) NOT NULL CHECK (tipo IN ('defensivo', 'fertilizante', 'semente', 'corretivo', 'adjuvante', 'outro'))
);

CREATE TABLE fornecedores (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    razao_social    VARCHAR(200) NOT NULL,
    cnpj            VARCHAR(18),
    municipio       VARCHAR(100),
    uf              CHAR(2),
    telefone        VARCHAR(20),
    email           VARCHAR(150),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE insumos (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    nome            VARCHAR(200) NOT NULL,
    categoria_id    BIGINT NOT NULL REFERENCES categorias_insumo(id),
    unidade_medida_id BIGINT NOT NULL REFERENCES unidades_medida(id),
    principio_ativo VARCHAR(150),
    registro_mapa   VARCHAR(50),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_insumos_categoria ON insumos(categoria_id);

CREATE TABLE lotes_insumo (
    id              BIGSERIAL PRIMARY KEY,
    insumo_id       BIGINT NOT NULL REFERENCES insumos(id),
    fornecedor_id   BIGINT REFERENCES fornecedores(id),
    numero_lote     VARCHAR(50) NOT NULL,
    data_fabricacao DATE,
    data_validade   DATE,
    quantidade_inicial NUMERIC(18,4) NOT NULL CHECK (quantidade_inicial >= 0),
    custo_unitario  NUMERIC(18,4) NOT NULL DEFAULT 0,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (insumo_id, numero_lote)
);
CREATE INDEX idx_lotes_insumo_insumo ON lotes_insumo(insumo_id);

CREATE TABLE armazens (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(150) NOT NULL,
    tipo            VARCHAR(30) NOT NULL CHECK (tipo IN ('insumos', 'producao', 'misto')),
    capacidade_t    NUMERIC(18,2),
    unidade_produtiva_id BIGINT REFERENCES unidades_produtivas(id),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE estoque_insumos (
    id              BIGSERIAL PRIMARY KEY,
    armazem_id      BIGINT NOT NULL REFERENCES armazens(id),
    lote_insumo_id  BIGINT NOT NULL REFERENCES lotes_insumo(id),
    quantidade_atual NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (armazem_id, lote_insumo_id)
);
CREATE INDEX idx_estoque_insumos_armazem ON estoque_insumos(armazem_id);

CREATE TABLE movimentacoes_estoque_insumos (
    id              BIGSERIAL PRIMARY KEY,
    estoque_insumo_id BIGINT NOT NULL REFERENCES estoque_insumos(id),
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'transferencia')),
    quantidade      NUMERIC(18,4) NOT NULL,
    data_movimento  TIMESTAMPTZ NOT NULL DEFAULT now(),
    documento_ref   VARCHAR(50),
    observacao      TEXT
);
CREATE INDEX idx_mov_estoque_insumos_data ON movimentacoes_estoque_insumos(data_movimento);

-- ============================================================
-- MÁQUINAS E EQUIPAMENTOS
-- ============================================================

CREATE TABLE categorias_equipamento (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(30) NOT NULL CHECK (tipo IN ('trator', 'colheitadeira', 'pulverizador', 'plantadeira', 'caminhao', 'implemento', 'outro'))
);

CREATE TABLE equipamentos (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(150) NOT NULL,
    categoria_id    BIGINT NOT NULL REFERENCES categorias_equipamento(id),
    marca           VARCHAR(80),
    modelo          VARCHAR(80),
    ano_fabricacao  INTEGER,
    horimetro_atual NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'disponivel'
                    CHECK (status IN ('disponivel', 'em_uso', 'manutencao', 'inativo')),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_equipamentos_categoria ON equipamentos(categoria_id);

CREATE TABLE custo_hora_equipamento (
    id              BIGSERIAL PRIMARY KEY,
    equipamento_id  BIGINT NOT NULL REFERENCES equipamentos(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    custo_hora      NUMERIC(18,4) NOT NULL CHECK (custo_hora >= 0),
    vigencia_inicio DATE NOT NULL,
    vigencia_fim    DATE,
    UNIQUE (equipamento_id, safra_id, vigencia_inicio)
);

CREATE TABLE manutencoes_equipamento (
    id              BIGSERIAL PRIMARY KEY,
    equipamento_id  BIGINT NOT NULL REFERENCES equipamentos(id),
    tipo            VARCHAR(30) NOT NULL CHECK (tipo IN ('preventiva', 'corretiva', 'revisao')),
    data_manutencao DATE NOT NULL,
    descricao       TEXT NOT NULL,
    custo_total     NUMERIC(18,2) NOT NULL DEFAULT 0,
    horimetro       NUMERIC(12,2),
    fornecedor_id   BIGINT REFERENCES fornecedores(id)
);
CREATE INDEX idx_manutencoes_equipamento ON manutencoes_equipamento(equipamento_id);

CREATE TABLE consumo_combustivel (
    id              BIGSERIAL PRIMARY KEY,
    equipamento_id  BIGINT NOT NULL REFERENCES equipamentos(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    data_abastecimento TIMESTAMPTZ NOT NULL,
    litros          NUMERIC(12,3) NOT NULL CHECK (litros > 0),
    valor_total     NUMERIC(18,2) NOT NULL,
    horimetro        NUMERIC(12,2),
    posto            VARCHAR(100)
);
CREATE INDEX idx_consumo_combustivel_equip ON consumo_combustivel(equipamento_id);
CREATE INDEX idx_consumo_combustivel_safra ON consumo_combustivel(safra_id);

-- ============================================================
-- RECURSOS HUMANOS
-- ============================================================

CREATE TABLE cargos (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    salario_base    NUMERIC(18,2),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE colaboradores (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(200) NOT NULL,
    cpf             VARCHAR(14),
    cargo_id        BIGINT NOT NULL REFERENCES cargos(id),
    data_admissao   DATE NOT NULL,
    data_demissao   DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo', 'afastado', 'demitido')),
    telefone        VARCHAR(20)
);
CREATE INDEX idx_colaboradores_cargo ON colaboradores(cargo_id);

CREATE TABLE equipes (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    lider_id        BIGINT REFERENCES colaboradores(id),
    unidade_produtiva_id BIGINT REFERENCES unidades_produtivas(id),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE custo_hora_colaborador (
    id              BIGSERIAL PRIMARY KEY,
    colaborador_id  BIGINT NOT NULL REFERENCES colaboradores(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    custo_hora      NUMERIC(18,4) NOT NULL CHECK (custo_hora >= 0),
    vigencia_inicio DATE NOT NULL,
    vigencia_fim    DATE
);
CREATE INDEX idx_custo_hora_colab ON custo_hora_colaborador(colaborador_id, safra_id);

-- ============================================================
-- PRODUÇÃO
-- ============================================================

CREATE TABLE planejamento_safra (
    id              BIGSERIAL PRIMARY KEY,
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    talhao_id       BIGINT NOT NULL REFERENCES talhoes(id),
    cultura_id      BIGINT NOT NULL REFERENCES culturas(id),
    variedade_id    BIGINT NOT NULL REFERENCES variedades(id),
    area_planejada_ha NUMERIC(18,4) NOT NULL CHECK (area_planejada_ha > 0),
    produtividade_meta_sc_ha NUMERIC(10,2),
    data_plantio_prevista DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'planejado'
                    CHECK (status IN ('planejado', 'em_execucao', 'colhido', 'cancelado')),
    UNIQUE (safra_id, talhao_id, cultura_id)
);
CREATE INDEX idx_planejamento_safra_safra ON planejamento_safra(safra_id);
CREATE INDEX idx_planejamento_safra_talhao ON planejamento_safra(talhao_id);

CREATE TABLE operacoes_agricolas (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    nome            VARCHAR(150) NOT NULL,
    tipo            VARCHAR(40) NOT NULL CHECK (tipo IN (
                        'preparo_solo', 'plantio', 'adubacao', 'pulverizacao',
                        'colheita', 'beneficiamento', 'irrigacao', 'outro'
                    )),
    descricao       TEXT
);

CREATE TABLE ordens_servico (
    id              BIGSERIAL PRIMARY KEY,
    numero          VARCHAR(30) NOT NULL UNIQUE,
    planejamento_safra_id BIGINT NOT NULL REFERENCES planejamento_safra(id),
    operacao_id     BIGINT NOT NULL REFERENCES operacoes_agricolas(id),
    data_prevista   DATE NOT NULL,
    data_conclusao  DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'aberta'
                    CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'cancelada')),
    responsavel_id  BIGINT REFERENCES colaboradores(id),
    observacao      TEXT
);
CREATE INDEX idx_ordens_servico_planejamento ON ordens_servico(planejamento_safra_id);

CREATE TABLE execucoes_operacao (
    id              BIGSERIAL PRIMARY KEY,
    ordem_servico_id BIGINT NOT NULL REFERENCES ordens_servico(id),
    data_execucao   DATE NOT NULL,
    area_executada_ha NUMERIC(18,4),
    status          VARCHAR(20) NOT NULL DEFAULT 'concluida'
                    CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada')),
    observacao      TEXT
);
CREATE INDEX idx_execucoes_operacao_os ON execucoes_operacao(ordem_servico_id);

CREATE TABLE plantios (
    id              BIGSERIAL PRIMARY KEY,
    execucao_id     BIGINT NOT NULL REFERENCES execucoes_operacao(id),
    variedade_id    BIGINT NOT NULL REFERENCES variedades(id),
    populacao_plantas_ha INTEGER,
    espacamento_cm  NUMERIC(6,2),
    profundidade_cm NUMERIC(6,2),
    data_plantio    DATE NOT NULL
);

CREATE TABLE aplicacoes_insumos (
    id              BIGSERIAL PRIMARY KEY,
    execucao_id     BIGINT NOT NULL REFERENCES execucoes_operacao(id),
    insumo_id       BIGINT NOT NULL REFERENCES insumos(id),
    lote_insumo_id  BIGINT REFERENCES lotes_insumo(id),
    dose_ha         NUMERIC(12,4) NOT NULL,
    quantidade_total NUMERIC(18,4) NOT NULL,
    custo_total     NUMERIC(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_aplicacoes_insumos_exec ON aplicacoes_insumos(execucao_id);

CREATE TABLE colheitas (
    id              BIGSERIAL PRIMARY KEY,
    execucao_id     BIGINT NOT NULL REFERENCES execucoes_operacao(id),
    data_colheita   DATE NOT NULL,
    umidade_pct     NUMERIC(6,2),
    impureza_pct    NUMERIC(6,2),
    quantidade_bruta_kg NUMERIC(18,4) NOT NULL,
    quantidade_liquida_kg NUMERIC(18,4) NOT NULL
);

CREATE TABLE producao_talhao (
    id              BIGSERIAL PRIMARY KEY,
    planejamento_safra_id BIGINT NOT NULL REFERENCES planejamento_safra(id),
    colheita_id     BIGINT REFERENCES colheitas(id),
    quantidade_sc   NUMERIC(18,4) NOT NULL,
    produtividade_sc_ha NUMERIC(10,4),
    data_registro   DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX idx_producao_talhao_planejamento ON producao_talhao(planejamento_safra_id);

CREATE TABLE perdas_producao (
    id              BIGSERIAL PRIMARY KEY,
    planejamento_safra_id BIGINT NOT NULL REFERENCES planejamento_safra(id),
    tipo            VARCHAR(40) NOT NULL CHECK (tipo IN ('geada', 'seca', 'praga', 'colheita', 'transporte', 'outro')),
    quantidade_sc   NUMERIC(18,4) NOT NULL,
    percentual      NUMERIC(6,2),
    data_registro   DATE NOT NULL,
    observacao      TEXT
);

CREATE TABLE indicadores_agronomicos (
    id              BIGSERIAL PRIMARY KEY,
    planejamento_safra_id BIGINT NOT NULL REFERENCES planejamento_safra(id),
    indicador       VARCHAR(80) NOT NULL,
    valor           NUMERIC(18,4) NOT NULL,
    unidade         VARCHAR(20),
    data_medicao    DATE NOT NULL
);

CREATE TABLE apontamentos_equipamento (
    id              BIGSERIAL PRIMARY KEY,
    execucao_id     BIGINT NOT NULL REFERENCES execucoes_operacao(id),
    equipamento_id  BIGINT NOT NULL REFERENCES equipamentos(id),
    horas_trabalhadas NUMERIC(10,2) NOT NULL CHECK (horas_trabalhadas >= 0),
    horimetro_inicio NUMERIC(12,2),
    horimetro_fim   NUMERIC(12,2),
    custo_total     NUMERIC(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_apontamentos_equip_exec ON apontamentos_equipamento(execucao_id);

CREATE TABLE apontamentos_mao_obra (
    id              BIGSERIAL PRIMARY KEY,
    execucao_id     BIGINT NOT NULL REFERENCES execucoes_operacao(id),
    colaborador_id  BIGINT NOT NULL REFERENCES colaboradores(id),
    equipe_id       BIGINT REFERENCES equipes(id),
    horas           NUMERIC(10,2) NOT NULL CHECK (horas >= 0),
    custo_total     NUMERIC(18,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_apontamentos_mo_exec ON apontamentos_mao_obra(execucao_id);

-- ============================================================
-- ESTOQUES DE PRODUÇÃO
-- ============================================================

CREATE TABLE lotes_producao (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(30) NOT NULL UNIQUE,
    cultura_id      BIGINT NOT NULL REFERENCES culturas(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    talhao_id       BIGINT REFERENCES talhoes(id),
    data_colheita   DATE NOT NULL,
    quantidade_inicial_sc NUMERIC(18,4) NOT NULL,
    umidade_pct     NUMERIC(6,2),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lotes_producao_cultura ON lotes_producao(cultura_id);

CREATE TABLE classificacao_producao (
    id              BIGSERIAL PRIMARY KEY,
    lote_producao_id BIGINT NOT NULL REFERENCES lotes_producao(id),
    tipo            VARCHAR(30) NOT NULL CHECK (tipo IN ('tipo_1', 'tipo_2', 'tipo_3', 'fora_padrao')),
    quantidade_sc   NUMERIC(18,4) NOT NULL,
    desconto_pct    NUMERIC(6,2) DEFAULT 0
);

CREATE TABLE estoque_producao (
    id              BIGSERIAL PRIMARY KEY,
    armazem_id      BIGINT NOT NULL REFERENCES armazens(id),
    lote_producao_id BIGINT NOT NULL REFERENCES lotes_producao(id),
    quantidade_atual_sc NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (quantidade_atual_sc >= 0),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (armazem_id, lote_producao_id)
);

CREATE TABLE movimentacoes_estoque_producao (
    id              BIGSERIAL PRIMARY KEY,
    estoque_producao_id BIGINT NOT NULL REFERENCES estoque_producao(id),
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'transferencia', 'venda')),
    quantidade_sc   NUMERIC(18,4) NOT NULL,
    data_movimento  TIMESTAMPTZ NOT NULL DEFAULT now(),
    documento_ref   VARCHAR(50),
    observacao      TEXT
);

CREATE TABLE beneficiamento_producao (
    id              BIGSERIAL PRIMARY KEY,
    lote_producao_id BIGINT NOT NULL REFERENCES lotes_producao(id),
    data_beneficiamento DATE NOT NULL,
    tipo            VARCHAR(50) NOT NULL,
    quantidade_entrada_sc NUMERIC(18,4) NOT NULL,
    quantidade_saida_sc NUMERIC(18,4) NOT NULL,
    perda_pct       NUMERIC(6,2),
    custo_total     NUMERIC(18,2) NOT NULL DEFAULT 0
);

-- ============================================================
-- COMERCIALIZAÇÃO
-- ============================================================

CREATE TABLE clientes (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    razao_social    VARCHAR(200) NOT NULL,
    cnpj_cpf        VARCHAR(18),
    municipio       VARCHAR(100),
    uf              CHAR(2),
    telefone        VARCHAR(20),
    email           VARCHAR(150),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE contratos_venda (
    id              BIGSERIAL PRIMARY KEY,
    numero          VARCHAR(30) NOT NULL UNIQUE,
    cliente_id      BIGINT NOT NULL REFERENCES clientes(id),
    cultura_id      BIGINT NOT NULL REFERENCES culturas(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    quantidade_sc   NUMERIC(18,4) NOT NULL,
    preco_sc        NUMERIC(18,4) NOT NULL,
    valor_total     NUMERIC(18,2) NOT NULL,
    data_contrato   DATE NOT NULL,
    data_entrega_prevista DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo', 'parcial', 'entregue', 'cancelado'))
);
CREATE INDEX idx_contratos_venda_cliente ON contratos_venda(cliente_id);

CREATE TABLE entregas_venda (
    id              BIGSERIAL PRIMARY KEY,
    contrato_id     BIGINT NOT NULL REFERENCES contratos_venda(id),
    data_entrega    DATE NOT NULL,
    quantidade_sc   NUMERIC(18,4) NOT NULL,
    lote_producao_id BIGINT REFERENCES lotes_producao(id),
    placa_veiculo   VARCHAR(10),
    observacao      TEXT
);
CREATE INDEX idx_entregas_venda_contrato ON entregas_venda(contrato_id);

CREATE TABLE notas_fiscais_mock (
    id              BIGSERIAL PRIMARY KEY,
    numero          VARCHAR(20) NOT NULL,
    serie           VARCHAR(5) NOT NULL DEFAULT '1',
    contrato_id     BIGINT REFERENCES contratos_venda(id),
    cliente_id      BIGINT NOT NULL REFERENCES clientes(id),
    data_emissao    DATE NOT NULL,
    valor_total     NUMERIC(18,2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'emitida'
                    CHECK (status IN ('emitida', 'cancelada')),
    UNIQUE (numero, serie)
);

CREATE TABLE recebimentos_venda (
    id              BIGSERIAL PRIMARY KEY,
    contrato_id     BIGINT NOT NULL REFERENCES contratos_venda(id),
    nota_fiscal_id  BIGINT REFERENCES notas_fiscais_mock(id),
    data_recebimento DATE NOT NULL,
    valor           NUMERIC(18,2) NOT NULL,
    forma_pagamento VARCHAR(30) NOT NULL CHECK (forma_pagamento IN ('pix', 'ted', 'boleto', 'cheque', 'outro'))
);

-- ============================================================
-- FINANCEIRO
-- ============================================================

CREATE TABLE centros_custo (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(150) NOT NULL,
    unidade_produtiva_id BIGINT REFERENCES unidades_produtivas(id),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE categorias_financeiras (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(100) NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
    grupo           VARCHAR(50)
);

CREATE TABLE contas_bancarias (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    banco           VARCHAR(80) NOT NULL,
    agencia         VARCHAR(10) NOT NULL,
    conta           VARCHAR(20) NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'aplicacao')),
    saldo_atual     NUMERIC(18,2) NOT NULL DEFAULT 0,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE contas_pagar (
    id              BIGSERIAL PRIMARY KEY,
    numero_documento VARCHAR(50),
    fornecedor_id   BIGINT REFERENCES fornecedores(id),
    categoria_id    BIGINT NOT NULL REFERENCES categorias_financeiras(id),
    centro_custo_id BIGINT REFERENCES centros_custo(id),
    safra_id        BIGINT REFERENCES safras(id),
    descricao       VARCHAR(255) NOT NULL,
    valor_original  NUMERIC(18,2) NOT NULL,
    valor_pago      NUMERIC(18,2) NOT NULL DEFAULT 0,
    data_emissao    DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'aberto'
                    CHECK (status IN ('aberto', 'parcial', 'pago', 'cancelado'))
);
CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX idx_contas_pagar_safra ON contas_pagar(safra_id);

CREATE TABLE contas_receber (
    id              BIGSERIAL PRIMARY KEY,
    numero_documento VARCHAR(50),
    cliente_id      BIGINT REFERENCES clientes(id),
    categoria_id    BIGINT NOT NULL REFERENCES categorias_financeiras(id),
    contrato_id     BIGINT REFERENCES contratos_venda(id),
    descricao       VARCHAR(255) NOT NULL,
    valor_original  NUMERIC(18,2) NOT NULL,
    valor_recebido  NUMERIC(18,2) NOT NULL DEFAULT 0,
    data_emissao    DATE NOT NULL,
    data_vencimento DATE NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'aberto'
                    CHECK (status IN ('aberto', 'parcial', 'recebido', 'cancelado'))
);
CREATE INDEX idx_contas_receber_vencimento ON contas_receber(data_vencimento);

CREATE TABLE pagamentos (
    id              BIGSERIAL PRIMARY KEY,
    conta_pagar_id  BIGINT NOT NULL REFERENCES contas_pagar(id),
    conta_bancaria_id BIGINT NOT NULL REFERENCES contas_bancarias(id),
    data_pagamento  DATE NOT NULL,
    valor           NUMERIC(18,2) NOT NULL CHECK (valor > 0),
    forma_pagamento VARCHAR(30) NOT NULL
);

CREATE TABLE recebimentos (
    id              BIGSERIAL PRIMARY KEY,
    conta_receber_id BIGINT NOT NULL REFERENCES contas_receber(id),
    conta_bancaria_id BIGINT NOT NULL REFERENCES contas_bancarias(id),
    data_recebimento DATE NOT NULL,
    valor           NUMERIC(18,2) NOT NULL CHECK (valor > 0),
    forma_pagamento VARCHAR(30) NOT NULL
);

CREATE TABLE fluxo_caixa (
    id              BIGSERIAL PRIMARY KEY,
    conta_bancaria_id BIGINT NOT NULL REFERENCES contas_bancarias(id),
    data_movimento  DATE NOT NULL,
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    categoria_id    BIGINT REFERENCES categorias_financeiras(id),
    descricao       VARCHAR(255) NOT NULL,
    valor           NUMERIC(18,2) NOT NULL CHECK (valor > 0),
    saldo_apos      NUMERIC(18,2)
);
CREATE INDEX idx_fluxo_caixa_data ON fluxo_caixa(data_movimento);

CREATE TABLE apropriacoes_custo (
    id              BIGSERIAL PRIMARY KEY,
    centro_custo_id BIGINT NOT NULL REFERENCES centros_custo(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    talhao_id       BIGINT REFERENCES talhoes(id),
    cultura_id      BIGINT REFERENCES culturas(id),
    origem_tipo     VARCHAR(40) NOT NULL,
    origem_id       BIGINT NOT NULL,
    valor           NUMERIC(18,2) NOT NULL,
    data_apropriacao DATE NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX idx_apropriacoes_custo_safra ON apropriacoes_custo(safra_id);
CREATE INDEX idx_apropriacoes_custo_talhao ON apropriacoes_custo(talhao_id);

-- ============================================================
-- CUSTOS
-- ============================================================

CREATE TABLE custos_planejados (
    id              BIGSERIAL PRIMARY KEY,
    planejamento_safra_id BIGINT NOT NULL REFERENCES planejamento_safra(id),
    categoria       VARCHAR(50) NOT NULL,
    descricao       VARCHAR(255),
    valor_planejado NUMERIC(18,2) NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE custos_realizados (
    id              BIGSERIAL PRIMARY KEY,
    planejamento_safra_id BIGINT REFERENCES planejamento_safra(id),
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    categoria       VARCHAR(50) NOT NULL,
    descricao       VARCHAR(255),
    valor_realizado NUMERIC(18,2) NOT NULL,
    data_custo      DATE NOT NULL,
    origem_tipo     VARCHAR(40),
    origem_id       BIGINT
);
CREATE INDEX idx_custos_realizados_safra ON custos_realizados(safra_id);

CREATE TABLE rateios_custo (
    id              BIGSERIAL PRIMARY KEY,
    custo_realizado_id BIGINT NOT NULL REFERENCES custos_realizados(id),
    talhao_id       BIGINT NOT NULL REFERENCES talhoes(id),
    percentual      NUMERIC(8,4) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
    valor_rateado   NUMERIC(18,2) NOT NULL
);

CREATE TABLE custo_por_talhao (
    id              BIGSERIAL PRIMARY KEY,
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    talhao_id       BIGINT NOT NULL REFERENCES talhoes(id),
    cultura_id      BIGINT NOT NULL REFERENCES culturas(id),
    custo_total     NUMERIC(18,2) NOT NULL,
    area_ha         NUMERIC(18,4) NOT NULL,
    custo_ha        NUMERIC(18,4) GENERATED ALWAYS AS (
                        CASE WHEN area_ha > 0 THEN custo_total / area_ha ELSE 0 END
                    ) STORED,
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (safra_id, talhao_id, cultura_id)
);

CREATE TABLE custo_por_cultura (
    id              BIGSERIAL PRIMARY KEY,
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    cultura_id      BIGINT NOT NULL REFERENCES culturas(id),
    custo_total     NUMERIC(18,2) NOT NULL,
    area_total_ha   NUMERIC(18,4) NOT NULL,
    custo_ha        NUMERIC(18,4) GENERATED ALWAYS AS (
                        CASE WHEN area_total_ha > 0 THEN custo_total / area_total_ha ELSE 0 END
                    ) STORED,
    UNIQUE (safra_id, cultura_id)
);

CREATE TABLE custo_por_operacao (
    id              BIGSERIAL PRIMARY KEY,
    safra_id        BIGINT NOT NULL REFERENCES safras(id),
    operacao_id     BIGINT NOT NULL REFERENCES operacoes_agricolas(id),
    custo_total     NUMERIC(18,2) NOT NULL,
    area_total_ha   NUMERIC(18,4),
    UNIQUE (safra_id, operacao_id)
);

-- ============================================================
-- CONTABILIDADE
-- ============================================================

CREATE TABLE plano_contas (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    nome            VARCHAR(200) NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('ativo', 'passivo', 'receita', 'despesa', 'patrimonio')),
    natureza        VARCHAR(10) NOT NULL CHECK (natureza IN ('devedora', 'credora')),
    conta_pai_id    BIGINT REFERENCES plano_contas(id),
    nivel           INTEGER NOT NULL DEFAULT 1,
    analitica       BOOLEAN NOT NULL DEFAULT FALSE,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_plano_contas_pai ON plano_contas(conta_pai_id);

CREATE TABLE historicos_padrao (
    id              BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(10) NOT NULL UNIQUE,
    descricao       VARCHAR(255) NOT NULL
);

CREATE TABLE lancamentos_contabeis (
    id              BIGSERIAL PRIMARY KEY,
    numero          VARCHAR(30) NOT NULL UNIQUE,
    data_lancamento DATE NOT NULL,
    historico_id    BIGINT REFERENCES historicos_padrao(id),
    historico_complementar TEXT,
    safra_id        BIGINT REFERENCES safras(id),
    origem_tipo     VARCHAR(40),
    origem_id       BIGINT,
    status          VARCHAR(20) NOT NULL DEFAULT 'lançado'
                    CHECK (status IN ('rascunho', 'lançado', 'estornado')),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lancamentos_contabeis_data ON lancamentos_contabeis(data_lancamento);

CREATE TABLE partidas_lancamento (
    id              BIGSERIAL PRIMARY KEY,
    lancamento_id   BIGINT NOT NULL REFERENCES lancamentos_contabeis(id) ON DELETE CASCADE,
    conta_id        BIGINT NOT NULL REFERENCES plano_contas(id),
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('debito', 'credito')),
    valor           NUMERIC(18,2) NOT NULL CHECK (valor > 0),
    centro_custo_id BIGINT REFERENCES centros_custo(id)
);
CREATE INDEX idx_partidas_lancamento ON partidas_lancamento(lancamento_id);
CREATE INDEX idx_partidas_conta ON partidas_lancamento(conta_id);

CREATE TABLE fechamentos_contabeis (
    id              BIGSERIAL PRIMARY KEY,
    ano             INTEGER NOT NULL,
    mes             INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    data_fechamento TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          VARCHAR(20) NOT NULL DEFAULT 'fechado'
                    CHECK (status IN ('aberto', 'fechado')),
    UNIQUE (ano, mes)
);

CREATE TABLE balancetes (
    id              BIGSERIAL PRIMARY KEY,
    fechamento_id   BIGINT NOT NULL REFERENCES fechamentos_contabeis(id),
    conta_id        BIGINT NOT NULL REFERENCES plano_contas(id),
    saldo_anterior  NUMERIC(18,2) NOT NULL DEFAULT 0,
    debitos         NUMERIC(18,2) NOT NULL DEFAULT 0,
    creditos        NUMERIC(18,2) NOT NULL DEFAULT 0,
    saldo_final     NUMERIC(18,2) NOT NULL DEFAULT 0,
    UNIQUE (fechamento_id, conta_id)
);

CREATE TABLE dre_gerencial (
    id              BIGSERIAL PRIMARY KEY,
    fechamento_id   BIGINT NOT NULL REFERENCES fechamentos_contabeis(id),
    safra_id        BIGINT REFERENCES safras(id),
    cultura_id      BIGINT REFERENCES culturas(id),
    receita_bruta   NUMERIC(18,2) NOT NULL DEFAULT 0,
    custos_variaveis NUMERIC(18,2) NOT NULL DEFAULT 0,
    custos_fixos    NUMERIC(18,2) NOT NULL DEFAULT 0,
    resultado       NUMERIC(18,2) GENERATED ALWAYS AS (
                        receita_bruta - custos_variaveis - custos_fixos
                    ) STORED,
    UNIQUE (fechamento_id, safra_id, cultura_id)
);
