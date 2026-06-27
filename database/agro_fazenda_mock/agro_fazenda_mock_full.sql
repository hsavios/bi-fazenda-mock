-- agro_fazenda_mock_full.sql
-- Gerado automaticamente em 2026-06-27T15:59:25-03:00
-- NÃO editar manualmente — altere os arquivos modulares e regenere.

-- >>> BEGIN 00_drop_create_schema.sql
-- 00_drop_create_schema.sql
-- Recria o schema agro (destrutivo). Executar apenas no banco agro_fazenda_mock.

DROP SCHEMA IF EXISTS agro CASCADE;

CREATE SCHEMA agro;
SET search_path TO agro, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMENT ON SCHEMA agro IS 'Schema mock agrícola — Fazenda Boa Esperança Agro Ltda.';

-- <<< END 00_drop_create_schema.sql

-- >>> BEGIN 01_schema.sql
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

-- <<< END 01_schema.sql

-- >>> BEGIN 02_seed_master_data.sql
-- 02_seed_master_data.sql — dados mestres fictícios
SET search_path TO agro, public;

-- Unidades de medida
INSERT INTO unidades_medida (sigla, descricao) VALUES
    ('kg', 'Quilograma'),
    ('L', 'Litro'),
    ('sc', 'Saca 60 kg'),
    ('t', 'Tonelada'),
    ('un', 'Unidade'),
    ('ha', 'Hectare'),
    ('cx', 'Caixa'),
    ('bag', 'Bag 1000 kg');

-- Categorias de insumo
INSERT INTO categorias_insumo (codigo, nome, tipo) VALUES
    ('CAT-DEF', 'Defensivos', 'defensivo'),
    ('CAT-FERT', 'Fertilizantes', 'fertilizante'),
    ('CAT-SEM', 'Sementes', 'semente'),
    ('CAT-CORR', 'Corretivos', 'corretivo'),
    ('CAT-ADJ', 'Adjuvantes', 'adjuvante');

-- Fazenda
INSERT INTO fazendas (codigo, razao_social, nome_fantasia, cnpj, inscricao_estadual, municipio, uf, area_total_ha)
VALUES ('FAZ-001', 'Fazenda Boa Esperança Agro Ltda.', 'Boa Esperança Agro', '12.345.678/0001-90', '109876543', 'Rio Verde', 'GO', 4850.0000);

-- Unidades produtivas
INSERT INTO unidades_produtivas (fazenda_id, codigo, nome, tipo, area_ha) VALUES
    (1, 'UP-GRAOS', 'Unidade Grãos Norte', 'grãos', 3200.0000),
    (1, 'UP-CAFE', 'Unidade Café Sul', 'café', 1650.0000);

-- Culturas (5)
INSERT INTO culturas (codigo, nome, tipo, unidade_producao, peso_saca_kg) VALUES
    ('SOJA', 'Soja', 'grão', 'saca', 60.00),
    ('MILHO', 'Milho', 'grão', 'saca', 60.00),
    ('SORGO', 'Sorgo', 'grão', 'saca', 60.00),
    ('FEIJAO', 'Feijão', 'leguminosa', 'saca', 60.00),
    ('CAFE', 'Café', 'perene', 'saca', 60.00);

-- Variedades
INSERT INTO variedades (cultura_id, codigo, nome, ciclo_dias, produtividade_esperada_sc_ha) VALUES
    (1, 'SOJA-BMX', 'BMX Potência RR', 115, 62.00),
    (1, 'SOJA-MG', 'MG/BR 790 RR', 118, 58.00),
    (1, 'SOJA-NS', 'NS 6909 IPRO', 112, 65.00),
    (2, 'MILHO-AG', 'AG 8088 PRO3', 130, 110.00),
    (2, 'MILHO-P3', 'P3707VYH', 125, 105.00),
    (3, 'SORGO-BRS', 'BRS 655', 105, 80.00),
    (3, 'SORGO-ADV', 'ADV 9101', 100, 85.00),
    (4, 'FEIJAO-BRS', 'BRS Estilo', 85, 35.00),
    (4, 'FEIJAO-CV', 'CV Moreno', 90, 32.00),
    (5, 'CAFE-ARAB', 'Arábica Mundo Novo', 365, 25.00),
    (5, 'CAFE-CAT', 'Catuaí Vermelho', 365, 28.00);

-- Safras (cadastro mestre; dados operacionais em 03)
INSERT INTO safras (codigo, nome, data_inicio, data_fim, status) VALUES
    ('2023/24', 'Safra 2023/2024', '2023-09-01', '2024-08-31', 'encerrada'),
    ('2024/25', 'Safra 2024/2025', '2024-09-01', '2025-08-31', 'encerrada'),
    ('2025/26', 'Safra 2025/2026', '2025-09-01', '2026-08-31', 'em_andamento');

-- Talhões (20)
INSERT INTO talhoes (unidade_produtiva_id, codigo, nome, area_ha, latitude, longitude, tipo_solo) VALUES
    (1, 'T-001', 'Talhão Norte 1', 180.5000, -17.7850, -50.9200, 'Latossolo Vermelho'),
    (1, 'T-002', 'Talhão Norte 2', 195.2500, -17.7860, -50.9180, 'Latossolo Vermelho'),
    (1, 'T-003', 'Talhão Norte 3', 210.0000, -17.7870, -50.9160, 'Latossolo Vermelho'),
    (1, 'T-004', 'Talhão Norte 4', 175.7500, -17.7880, -50.9140, 'Argissolo'),
    (1, 'T-005', 'Talhão Norte 5', 220.0000, -17.7890, -50.9120, 'Latossolo Vermelho'),
    (1, 'T-006', 'Talhão Central 1', 165.0000, -17.7900, -50.9100, 'Latossolo Vermelho'),
    (1, 'T-007', 'Talhão Central 2', 188.5000, -17.7910, -50.9080, 'Latossolo Vermelho'),
    (1, 'T-008', 'Talhão Central 3', 200.0000, -17.7920, -50.9060, 'Argissolo'),
    (1, 'T-009', 'Talhão Central 4', 192.2500, -17.7930, -50.9040, 'Latossolo Vermelho'),
    (1, 'T-010', 'Talhão Sul Grãos 1', 178.0000, -17.7940, -50.9020, 'Latossolo Vermelho'),
    (1, 'T-011', 'Talhão Sul Grãos 2', 205.5000, -17.7950, -50.9000, 'Latossolo Vermelho'),
    (1, 'T-012', 'Talhão Sul Grãos 3', 190.7500, -17.7960, -50.8980, 'Argissolo'),
    (1, 'T-013', 'Talhão Oeste 1', 155.0000, -17.7970, -50.8960, 'Latossolo Vermelho'),
    (1, 'T-014', 'Talhão Oeste 2', 168.2500, -17.7980, -50.8940, 'Latossolo Vermelho'),
    (1, 'T-015', 'Talhão Oeste 3', 142.5000, -17.7990, -50.8920, 'Neossolo'),
    (2, 'T-C01', 'Talhão Café 1', 320.0000, -17.8100, -50.8800, 'Latossolo Vermelho'),
    (2, 'T-C02', 'Talhão Café 2', 285.5000, -17.8110, -50.8780, 'Latossolo Vermelho'),
    (2, 'T-C03', 'Talhão Café 3', 310.0000, -17.8120, -50.8760, 'Argissolo'),
    (2, 'T-C04', 'Talhão Café 4', 275.2500, -17.8130, -50.8740, 'Latossolo Vermelho'),
    (2, 'T-C05', 'Talhão Café 5', 459.2500, -17.8140, -50.8720, 'Latossolo Vermelho');

-- Armazéns
INSERT INTO armazens (codigo, nome, tipo, capacidade_t, unidade_produtiva_id) VALUES
    ('ARM-INS', 'Armazém Insumos Central', 'insumos', 500.00, NULL),
    ('ARM-GRAOS', 'Armazém Grãos Norte', 'producao', 12000.00, 1),
    ('ARM-CAFE', 'Armazém Café Sul', 'producao', 3000.00, 2),
    ('ARM-MISTO', 'Galpão Misto Operacional', 'misto', 800.00, 1);

-- Fornecedores (12)
INSERT INTO fornecedores (codigo, razao_social, cnpj, municipio, uf, telefone, email) VALUES
    ('FOR-001', 'AgroInsumos Rio Verde Ltda.', '11.111.111/0001-11', 'Rio Verde', 'GO', '(64) 3611-1000', 'vendas@agroinsumosrv.com.br'),
    ('FOR-002', 'Cooperativa Campo Forte', '22.222.222/0001-22', 'Jataí', 'GO', '(64) 3632-2000', 'compras@campoforte.coop.br'),
    ('FOR-003', 'Sementes Premium GO', '33.333.333/0001-33', 'Rio Verde', 'GO', '(64) 3611-3000', 'contato@sementespremium.com.br'),
    ('FOR-004', 'Defensivos AgroTech SA', '44.444.444/0001-44', 'São Paulo', 'SP', '(11) 3000-4000', 'vendas@agrotech.com.br'),
    ('FOR-005', 'Fertilizantes Brasil Central', '55.555.555/0001-55', 'Uberaba', 'MG', '(34) 3311-5000', 'vendas@fertbrasil.com.br'),
    ('FOR-006', 'Posto Combustível BR-060', '66.666.666/0001-66', 'Rio Verde', 'GO', '(64) 3611-6000', NULL),
    ('FOR-007', 'Mecânica Agrícola Sul', '77.777.777/0001-77', 'Jataí', 'GO', '(64) 3632-7000', 'oficina@mecagrisul.com.br'),
    ('FOR-008', 'Transportadora Grãos Express', '88.888.888/0001-88', 'Rio Verde', 'GO', '(64) 3611-8000', 'logistica@graosexpress.com.br'),
    ('FOR-009', 'Laboratório Solo Análise', '99.999.999/0001-99', 'Goiânia', 'GO', '(62) 3200-9000', 'lab@soloanalise.com.br'),
    ('FOR-010', 'Consultoria Agronômica Verde', '10.101.010/0001-10', 'Rio Verde', 'GO', '(64) 3611-1010', 'contato@verdeagro.com.br'),
    ('FOR-011', 'Energia Solar Rural Ltda.', '20.202.020/0001-20', 'Goiânia', 'GO', '(62) 3200-2020', 'vendas@solarrural.com.br'),
    ('FOR-012', 'Peças Trator Peças GO', '30.303.030/0001-30', 'Rio Verde', 'GO', '(64) 3611-3030', 'pecas@tratorpecasgo.com.br');

-- Clientes (10)
INSERT INTO clientes (codigo, razao_social, cnpj_cpf, municipio, uf, telefone, email) VALUES
    ('CLI-001', 'Trading Grãos Internacional SA', '91.111.111/0001-91', 'Santos', 'SP', '(13) 3200-1000', 'compras@tradinggraos.com.br'),
    ('CLI-002', 'Cooperativa Exportadora Sul', '92.222.222/0001-92', 'Paranaguá', 'PR', '(41) 3400-2000', 'export@sulcoop.com.br'),
    ('CLI-003', 'Indústria Alimentícia Norte', '93.333.333/0001-93', 'Goiânia', 'GO', '(62) 3200-3000', 'suprimentos@alimenticianorte.com.br'),
    ('CLI-004', 'Café Premium Export Ltda.', '94.444.444/0001-94', 'Vitória', 'ES', '(27) 3300-4000', 'export@cafePremium.com.br'),
    ('CLI-005', 'Armazém Geral Centro-Oeste', '95.555.555/0001-95', 'Rio Verde', 'GO', '(64) 3611-5000', 'armazem@cgomes.com.br'),
    ('CLI-006', 'Cooperativa Produtores Jataí', '96.666.666/0001-96', 'Jataí', 'GO', '(64) 3632-6000', 'comercial@coopjatai.coop.br'),
    ('CLI-007', 'Mercado Interno Grãos GO', '97.777.777/0001-97', 'Goiânia', 'GO', '(62) 3200-7000', 'vendas@migrãosgo.com.br'),
    ('CLI-008', 'Usina Etanol Cana Verde', '98.888.888/0001-98', 'Rio Verde', 'GO', '(64) 3611-8000', 'compras@canaverde.com.br'),
    ('CLI-009', 'Distribuidora Feijão Brasil', '99.999.999/0001-99', 'Brasília', 'DF', '(61) 3200-9000', 'pedidos@feijaobrasil.com.br'),
    ('CLI-010', 'Cerealista Planalto Central', '10.010.101/0001-10', 'Anápolis', 'GO', '(62) 3200-1010', 'compras@cerealista.com.br');

-- Insumos (35)
INSERT INTO insumos (codigo, nome, categoria_id, unidade_medida_id, principio_ativo, registro_mapa) VALUES
    ('INS-001', 'Glifosato 480 SL', 1, 2, 'Glifosato', 'MAP-001'),
    ('INS-002', '2,4-D Amine 806', 1, 2, '2,4-D', 'MAP-002'),
    ('INS-003', 'Atrazina 500 SC', 1, 2, 'Atrazina', 'MAP-003'),
    ('INS-004', 'Lambda-Cialotrina 50 EC', 1, 2, 'Lambda-Cialotrina', 'MAP-004'),
    ('INS-005', 'Clorimuron 250 WG', 1, 1, 'Clorimuron', 'MAP-005'),
    ('INS-006', 'Fomesafem 250 EC', 1, 2, 'Fomesafem', 'MAP-006'),
    ('INS-007', 'Trifluralina 440 EC', 1, 2, 'Trifluralina', 'MAP-007'),
    ('INS-008', 'Mancozeb 800 WP', 1, 1, 'Mancozeb', 'MAP-008'),
    ('INS-009', 'Azoxistrobina + Ciproconazol', 1, 2, 'Azoxistrobina', 'MAP-009'),
    ('INS-010', 'Imidacloprid 200 SL', 1, 2, 'Imidacloprid', 'MAP-010'),
    ('INS-011', 'Ureia 45% N', 2, 1, 'Nitrogênio', NULL),
    ('INS-012', 'Superfosfato Simples', 2, 1, 'Fósforo', NULL),
    ('INS-013', 'Cloreto de Potássio 60%', 2, 1, 'Potássio', NULL),
    ('INS-014', 'MAP 11-52-00', 2, 1, 'NPK', NULL),
    ('INS-015', 'KCl Granulado', 2, 1, 'Potássio', NULL),
    ('INS-016', 'NPK 08-28-16', 2, 1, 'NPK', NULL),
    ('INS-017', 'Sulfato de Amônio', 2, 1, 'Nitrogênio', NULL),
    ('INS-018', 'Micronutrientes Foliar', 2, 2, 'Micro', NULL),
    ('INS-019', 'Calcário Dolomítico PRNT 85', 4, 1, 'Ca+Mg', NULL),
    ('INS-020', 'Gesso Agrícola', 4, 1, 'Enxofre', NULL),
    ('INS-021', 'Semente Soja BMX Potência RR', 3, 1, NULL, NULL),
    ('INS-022', 'Semente Milho AG 8088 PRO3', 3, 1, NULL, NULL),
    ('INS-023', 'Semente Sorgo BRS 655', 3, 1, NULL, NULL),
    ('INS-024', 'Semente Feijão BRS Estilo', 3, 1, NULL, NULL),
    ('INS-025', 'Muda Café Arábica', 3, 5, NULL, NULL),
    ('INS-026', 'Óleo Mineral', 5, 2, 'Adjuvante', NULL),
    ('INS-027', 'Espalhante Adesivo', 5, 2, 'Adjuvante', NULL),
    ('INS-028', 'Inoculante Bradyrhizobium', 3, 7, 'Inoculante', NULL),
    ('INS-029', 'Herbicida Dicamba 480 SL', 1, 2, 'Dicamba', 'MAP-011'),
    ('INS-030', 'Fungicida Protioconazol', 1, 2, 'Protioconazol', 'MAP-012'),
    ('INS-031', 'Inseticida Tiametoxam', 1, 2, 'Tiametoxam', 'MAP-013'),
    ('INS-032', 'Fertilizante Foliar NPK', 2, 2, 'NPK', NULL),
    ('INS-033', 'Bioestimulante Algas', 2, 2, 'Bioestimulante', NULL),
    ('INS-034', 'Herbicida S-Metolaclore', 1, 2, 'S-Metolaclore', 'MAP-014'),
    ('INS-035', 'Regulador Crescimento', 1, 2, 'Trinexapac', 'MAP-015');

-- Lotes de insumo (amostra inicial)
INSERT INTO lotes_insumo (insumo_id, fornecedor_id, numero_lote, data_fabricacao, data_validade, quantidade_inicial, custo_unitario) VALUES
    (1, 4, 'LOT-G001', '2024-06-01', '2026-06-01', 5000.0000, 18.50),
    (11, 5, 'LOT-U001', '2024-08-01', '2026-08-01', 80000.0000, 2.80),
    (14, 5, 'LOT-MAP01', '2024-07-01', '2026-07-01', 50000.0000, 3.20),
    (21, 3, 'LOT-SBMX', '2024-09-01', '2025-09-01', 12000.0000, 85.00),
    (22, 3, 'LOT-M8088', '2024-10-01', '2025-10-01', 8000.0000, 420.00),
    (19, 5, 'LOT-CAL01', '2024-05-01', '2027-05-01', 200000.0000, 0.35),
    (6, 4, 'LOT-FOM01', '2024-07-15', '2026-07-15', 3000.0000, 45.00),
    (9, 4, 'LOT-AZO01', '2024-08-15', '2026-08-15', 2500.0000, 95.00);

-- Estoque insumos inicial
INSERT INTO estoque_insumos (armazem_id, lote_insumo_id, quantidade_atual) VALUES
    (1, 1, 3200.0000), (1, 2, 65000.0000), (1, 3, 42000.0000),
    (1, 4, 8500.0000), (1, 5, 5200.0000), (1, 6, 180000.0000),
    (1, 7, 2100.0000), (1, 8, 1800.0000);

-- Categorias equipamento
INSERT INTO categorias_equipamento (codigo, nome, tipo) VALUES
    ('CAT-TRAT', 'Trator', 'trator'),
    ('CAT-COLH', 'Colheitadeira', 'colheitadeira'),
    ('CAT-PULV', 'Pulverizador', 'pulverizador'),
    ('CAT-PLANT', 'Plantadeira', 'plantadeira'),
    ('CAT-CAM', 'Caminhão', 'caminhao'),
    ('CAT-IMP', 'Implemento', 'implemento');

-- Equipamentos (12)
INSERT INTO equipamentos (codigo, nome, categoria_id, marca, modelo, ano_fabricacao, horimetro_atual, status) VALUES
    ('EQ-TR01', 'Trator John Deere 7230R', 1, 'John Deere', '7230R', 2020, 4520.50, 'disponivel'),
    ('EQ-TR02', 'Trator Case IH Puma 185', 1, 'Case IH', 'Puma 185', 2019, 5100.00, 'disponivel'),
    ('EQ-TR03', 'Trator Valtra BH194i', 1, 'Valtra', 'BH194i', 2021, 3200.75, 'em_uso'),
    ('EQ-CO01', 'Colheitadeira John Deere S790', 2, 'John Deere', 'S790', 2022, 1850.00, 'disponivel'),
    ('EQ-CO02', 'Colheitadeira Case IH 8250', 2, 'Case IH', '8250', 2021, 2100.50, 'disponivel'),
    ('EQ-PU01', 'Pulverizador Jacto Uniport 3030', 3, 'Jacto', 'Uniport 3030', 2020, 2800.00, 'disponivel'),
    ('EQ-PU02', 'Pulverizador Stara Imperador 3000', 3, 'Stara', 'Imperador 3000', 2023, 950.00, 'disponivel'),
    ('EQ-PL01', 'Plantadeira Semeato PSE 8', 4, 'Semeato', 'PSE 8', 2019, 1200.00, 'disponivel'),
    ('EQ-PL02', 'Plantadeira Jumil JM 8090', 4, 'Jumil', 'JM 8090', 2022, 680.00, 'disponivel'),
    ('EQ-CA01', 'Caminhão Mercedes-Benz 2729', 5, 'Mercedes-Benz', '2729', 2018, 89000.00, 'disponivel'),
    ('EQ-CA02', 'Caminhão Volvo VM 330', 5, 'Volvo', 'VM 330', 2020, 62000.00, 'disponivel'),
    ('EQ-IM01', 'Grade Niveladora 48 discos', 6, 'Tatu', 'GCR 48', 2017, 800.00, 'disponivel');

-- Cargos
INSERT INTO cargos (codigo, nome, salario_base) VALUES
    ('CAR-OP', 'Operador de Máquinas', 4500.00),
    ('CAR-MEC', 'Mecânico Agrícola', 5200.00),
    ('CAR-AGRO', 'Agrônomo', 8500.00),
    ('CAR-ADM', 'Administrativo', 3800.00),
    ('CAR-FIN', 'Analista Financeiro', 6200.00),
    ('CAR-EST', 'Estoquista', 3200.00),
    ('CAR-MOT', 'Motorista', 4000.00),
    ('CAR-SUP', 'Supervisor de Campo', 5800.00);

-- Colaboradores (18)
INSERT INTO colaboradores (codigo, nome, cpf, cargo_id, data_admissao, status, telefone) VALUES
    ('COL-001', 'Carlos Eduardo Silva', '111.111.111-11', 1, '2018-03-15', 'ativo', '(64) 99901-0001'),
    ('COL-002', 'Roberto Almeida Santos', '222.222.222-22', 1, '2019-06-01', 'ativo', '(64) 99901-0002'),
    ('COL-003', 'Fernando Oliveira Costa', '333.333.333-33', 1, '2020-01-10', 'ativo', '(64) 99901-0003'),
    ('COL-004', 'Marcos Pereira Lima', '444.444.444-44', 1, '2017-08-20', 'ativo', '(64) 99901-0004'),
    ('COL-005', 'João Pedro Ferreira', '555.555.555-55', 2, '2016-05-12', 'ativo', '(64) 99901-0005'),
    ('COL-006', 'Antonio Carlos Souza', '666.666.666-66', 2, '2019-11-03', 'ativo', '(64) 99901-0006'),
    ('COL-007', 'Dra. Ana Paula Mendes', '777.777.777-77', 3, '2015-02-01', 'ativo', '(64) 99901-0007'),
    ('COL-008', 'Dr. Ricardo Nunes', '888.888.888-88', 3, '2021-07-15', 'ativo', '(64) 99901-0008'),
    ('COL-009', 'Patricia Gomes Rocha', '999.999.999-99', 4, '2018-09-01', 'ativo', '(64) 99901-0009'),
    ('COL-010', 'Lucas Martins Dias', '101.010.101-01', 5, '2020-04-20', 'ativo', '(64) 99901-0010'),
    ('COL-011', 'Juliana Costa Barbosa', '202.020.202-02', 6, '2019-02-14', 'ativo', '(64) 99901-0011'),
    ('COL-012', 'Paulo Henrique Dias', '303.030.303-03', 7, '2017-12-01', 'ativo', '(64) 99901-0012'),
    ('COL-013', 'Eduardo Ramos Vieira', '404.040.404-04', 7, '2022-03-10', 'ativo', '(64) 99901-0013'),
    ('COL-014', 'Marcelo Henrique Alves', '505.050.505-05', 8, '2016-01-15', 'ativo', '(64) 99901-0014'),
    ('COL-015', 'Felipe Augusto Nery', '606.060.606-06', 1, '2023-08-01', 'ativo', '(64) 99901-0015'),
    ('COL-016', 'Gabriel Santos Moura', '707.070.707-07', 1, '2024-01-15', 'ativo', '(64) 99901-0016'),
    ('COL-017', 'Renata Oliveira Pinto', '808.080.808-08', 4, '2021-11-01', 'ativo', '(64) 99901-0017'),
    ('COL-018', 'Bruno Carvalho Ribeiro', '909.090.909-09', 6, '2022-06-20', 'ativo', '(64) 99901-0018');

-- Equipes
INSERT INTO equipes (codigo, nome, lider_id, unidade_produtiva_id) VALUES
    ('EQP-01', 'Equipe Plantio Norte', 14, 1),
    ('EQP-02', 'Equipe Pulverização', 14, 1),
    ('EQP-03', 'Equipe Colheita', 4, 1),
    ('EQP-04', 'Equipe Café', 14, 2);

-- Operações agrícolas
INSERT INTO operacoes_agricolas (codigo, nome, tipo, descricao) VALUES
    ('OP-PREP', 'Preparo de Solo', 'preparo_solo', 'Gradagem e nivelamento'),
    ('OP-PLANT', 'Plantio', 'plantio', 'Semeadura direta'),
    ('OP-ADUB', 'Adubação de Base', 'adubacao', 'Aplicação NPK'),
    ('OP-ADUBC', 'Adubação de Cobertura', 'adubacao', 'Cobertura nitrogenada'),
    ('OP-HERB', 'Herbicida Pré-emergente', 'pulverizacao', 'Controle invasoras'),
    ('OP-HERBP', 'Herbicida Pós-emergente', 'pulverizacao', 'Dessecação'),
    ('OP-FUNG', 'Fungicida', 'pulverizacao', 'Controle doenças foliares'),
    ('OP-INSET', 'Inseticida', 'pulverizacao', 'Controle pragas'),
    ('OP-COLH', 'Colheita', 'colheita', 'Colheita mecanizada'),
    ('OP-BENEF', 'Beneficiamento', 'beneficiamento', 'Secagem e limpeza'),
    ('OP-CALC', 'Calagem', 'adubacao', 'Correção pH solo'),
    ('OP-GIPS', 'Gessagem', 'adubacao', 'Correção enxofre subsolo');

-- Centros de custo
INSERT INTO centros_custo (codigo, nome, unidade_produtiva_id) VALUES
    ('CC-GRAOS', 'Centro Custo Grãos', 1),
    ('CC-CAFE', 'Centro Custo Café', 2),
    ('CC-ADM', 'Centro Custo Administrativo', NULL),
    ('CC-MAN', 'Centro Custo Manutenção', NULL);

-- Categorias financeiras
INSERT INTO categorias_financeiras (codigo, nome, tipo, grupo) VALUES
    ('CF-VENDA', 'Venda de Produção', 'receita', 'operacional'),
    ('CF-SERV', 'Prestação de Serviços', 'receita', 'operacional'),
    ('CF-INS', 'Compra de Insumos', 'despesa', 'operacional'),
    ('CF-COMB', 'Combustível', 'despesa', 'operacional'),
    ('CF-MAN', 'Manutenção Equipamentos', 'despesa', 'operacional'),
    ('CF-RH', 'Folha de Pagamento', 'despesa', 'pessoal'),
    ('CF-ADM', 'Despesas Administrativas', 'despesa', 'administrativo'),
    ('CF-FIN', 'Despesas Financeiras', 'despesa', 'financeiro'),
    ('CF-ARREND', 'Arrendamento', 'despesa', 'operacional'),
    ('CF-OUTREC', 'Outras Receitas', 'receita', 'outras');

-- Contas bancárias
INSERT INTO contas_bancarias (codigo, banco, agencia, conta, tipo, saldo_atual) VALUES
    ('CB-BB', 'Banco do Brasil', '1234-5', '56789-0', 'corrente', 1250000.00),
    ('CB-SIC', 'Sicredi', '0810', '12345-6', 'corrente', 380000.00),
    ('CB-APL', 'Banco do Brasil', '1234-5', '56790-1', 'aplicacao', 2500000.00);

-- Plano de contas agrícola
INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica) VALUES
    ('1', 'ATIVO', 'ativo', 'devedora', NULL, 1, FALSE),
    ('1.1', 'ATIVO CIRCULANTE', 'ativo', 'devedora', 1, 2, FALSE),
    ('1.1.01', 'Caixa e Equivalentes', 'ativo', 'devedora', 2, 3, FALSE),
    ('1.1.01.001', 'Banco Conta Corrente BB', 'ativo', 'devedora', 3, 4, TRUE),
    ('1.1.01.002', 'Banco Conta Corrente Sicredi', 'ativo', 'devedora', 3, 4, TRUE),
    ('1.1.02', 'Estoques', 'ativo', 'devedora', 2, 3, FALSE),
    ('1.1.02.001', 'Estoque de Insumos', 'ativo', 'devedora', 6, 4, TRUE),
    ('1.1.02.002', 'Estoque de Produção', 'ativo', 'devedora', 6, 4, TRUE),
    ('1.1.03', 'Contas a Receber', 'ativo', 'devedora', 2, 3, TRUE),
    ('1.2', 'ATIVO NÃO CIRCULANTE', 'ativo', 'devedora', 1, 2, FALSE),
    ('1.2.01', 'Imobilizado', 'ativo', 'devedora', 10, 3, FALSE),
    ('1.2.01.001', 'Máquinas e Equipamentos', 'ativo', 'devedora', 11, 4, TRUE),
    ('2', 'PASSIVO', 'passivo', 'credora', NULL, 1, FALSE),
    ('2.1', 'PASSIVO CIRCULANTE', 'passivo', 'credora', 13, 2, FALSE),
    ('2.1.01', 'Contas a Pagar', 'passivo', 'credora', 14, 3, TRUE),
    ('2.1.02', 'Empréstimos CP', 'passivo', 'credora', 14, 3, TRUE),
    ('3', 'PATRIMÔNIO LÍQUIDO', 'patrimonio', 'credora', NULL, 1, FALSE),
    ('3.1', 'Capital Social', 'patrimonio', 'credora', 17, 2, TRUE),
    ('3.2', 'Lucros Acumulados', 'patrimonio', 'credora', 17, 2, TRUE),
    ('4', 'RECEITAS', 'receita', 'credora', NULL, 1, FALSE),
    ('4.1', 'Receita Operacional Bruta', 'receita', 'credora', 20, 2, FALSE),
    ('4.1.01', 'Venda Soja', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.02', 'Venda Milho', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.03', 'Venda Sorgo', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.04', 'Venda Feijão', 'receita', 'credora', 21, 3, TRUE),
    ('4.1.05', 'Venda Café', 'receita', 'credora', 21, 3, TRUE),
    ('5', 'DESPESAS', 'despesa', 'devedora', NULL, 1, FALSE),
    ('5.1', 'Custos da Produção', 'despesa', 'devedora', 27, 2, FALSE),
    ('5.1.01', 'Insumos Agrícolas', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.1.02', 'Combustível', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.1.03', 'Mão de Obra Direta', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.1.04', 'Depreciação Máquinas', 'despesa', 'devedora', 28, 3, TRUE),
    ('5.2', 'Despesas Operacionais', 'despesa', 'devedora', 27, 2, FALSE),
    ('5.2.01', 'Despesas Administrativas', 'despesa', 'devedora', 33, 3, TRUE),
    ('5.2.02', 'Despesas Financeiras', 'despesa', 'devedora', 33, 3, TRUE);

-- Históricos padrão
INSERT INTO historicos_padrao (codigo, descricao) VALUES
    ('HP01', 'Compra de insumos agrícolas'),
    ('HP02', 'Venda de produção agrícola'),
    ('HP03', 'Pagamento de folha de pagamento'),
    ('HP04', 'Depreciação mensal de equipamentos'),
    ('HP05', 'Recebimento de clientes'),
    ('HP06', 'Pagamento a fornecedores'),
    ('HP07', 'Aplicação de fertilizantes'),
    ('HP08', 'Consumo de combustível'),
    ('HP09', 'Manutenção de equipamentos'),
    ('HP10', 'Ajuste de estoque');

-- Análises de solo (amostra)
INSERT INTO analises_solo (talhao_id, data_coleta, laboratorio, ph, materia_organica_pct, fosforo_ppm, potassio_ppm, calcio_cmol, magnesio_cmol, recomendacao)
SELECT t.id, '2024-03-15', 'Laboratório Solo Análise', 5.8 + (t.id % 5) * 0.1, 2.5 + (t.id % 3) * 0.3,
       12.0 + t.id, 85.0 + t.id * 2, 3.5, 1.2, 'Calagem recomendada conforme análise'
FROM talhoes t WHERE t.unidade_produtiva_id = 1 LIMIT 10;

-- Custo hora equipamento (safra 2024/25)
INSERT INTO custo_hora_equipamento (equipamento_id, safra_id, custo_hora, vigencia_inicio) VALUES
    (1, 2, 285.00, '2024-09-01'), (2, 2, 270.00, '2024-09-01'), (4, 2, 850.00, '2024-09-01'),
    (6, 2, 320.00, '2024-09-01'), (8, 2, 180.00, '2024-09-01'), (1, 3, 295.00, '2025-09-01');

-- Custo hora colaborador (safra 2024/25)
INSERT INTO custo_hora_colaborador (colaborador_id, safra_id, custo_hora, vigencia_inicio) VALUES
    (1, 2, 35.00, '2024-09-01'), (2, 2, 32.00, '2024-09-01'), (3, 2, 34.00, '2024-09-01'),
    (4, 2, 38.00, '2024-09-01'), (7, 2, 65.00, '2024-09-01'), (14, 2, 48.00, '2024-09-01');

-- <<< END 02_seed_master_data.sql

-- >>> BEGIN 03_seed_operational_data.sql
-- 03_seed_operational_data.sql — dados operacionais fictícios
SET search_path TO agro, public;

-- Planejamento safra 2024/25 (talhões grãos)
INSERT INTO planejamento_safra (safra_id, talhao_id, cultura_id, variedade_id, area_planejada_ha, produtividade_meta_sc_ha, data_plantio_prevista, status) VALUES
    (2, 1, 1, 1, 180.50, 62.00, '2024-10-05', 'colhido'),
    (2, 2, 1, 2, 195.25, 58.00, '2024-10-08', 'colhido'),
    (2, 3, 1, 3, 210.00, 65.00, '2024-10-10', 'colhido'),
    (2, 4, 2, 4, 175.75, 110.00, '2024-10-15', 'colhido'),
    (2, 5, 2, 5, 220.00, 105.00, '2024-10-18', 'colhido'),
    (2, 6, 1, 1, 165.00, 62.00, '2024-10-20', 'colhido'),
    (2, 7, 3, 6, 188.50, 80.00, '2024-10-22', 'colhido'),
    (2, 8, 2, 4, 200.00, 110.00, '2024-10-25', 'colhido'),
    (2, 9, 1, 2, 192.25, 58.00, '2024-10-28', 'colhido'),
    (2, 10, 4, 8, 178.00, 35.00, '2024-11-01', 'colhido'),
    (2, 11, 1, 3, 205.50, 65.00, '2024-11-05', 'colhido'),
    (2, 12, 2, 5, 190.75, 105.00, '2024-11-08', 'colhido'),
    (2, 13, 3, 7, 155.00, 85.00, '2024-11-10', 'colhido'),
    (2, 14, 1, 1, 168.25, 62.00, '2024-11-12', 'colhido'),
    (2, 15, 4, 9, 142.50, 32.00, '2024-11-15', 'colhido'),
    (2, 16, 5, 10, 320.00, 25.00, '2024-01-15', 'colhido'),
    (2, 17, 5, 11, 285.50, 28.00, '2024-01-20', 'colhido'),
    (2, 18, 5, 10, 310.00, 25.00, '2024-01-25', 'colhido');

-- Planejamento safra 2025/26 (parcial)
INSERT INTO planejamento_safra (safra_id, talhao_id, cultura_id, variedade_id, area_planejada_ha, produtividade_meta_sc_ha, data_plantio_prevista, status) VALUES
    (3, 1, 1, 1, 180.50, 63.00, '2025-10-05', 'em_execucao'),
    (3, 2, 1, 3, 195.25, 66.00, '2025-10-08', 'em_execucao'),
    (3, 3, 1, 1, 210.00, 62.00, '2025-10-10', 'planejado'),
    (3, 4, 2, 4, 175.75, 112.00, '2025-10-15', 'planejado'),
    (3, 5, 2, 5, 220.00, 108.00, '2025-10-18', 'planejado'),
    (3, 6, 1, 2, 165.00, 59.00, '2025-10-20', 'planejado');

-- Histórico uso solo
INSERT INTO historico_uso_solo (talhao_id, safra_id, cultura_id, variedade_id, data_registro)
SELECT ps.talhao_id, ps.safra_id, ps.cultura_id, ps.variedade_id, ps.data_plantio_prevista
FROM planejamento_safra ps WHERE ps.safra_id = 2;

-- Ordens de serviço e execuções (ciclo completo safra 2024/25 — amostra representativa)
-- OS Plantio talhão 1
INSERT INTO ordens_servico (numero, planejamento_safra_id, operacao_id, data_prevista, data_conclusao, status, responsavel_id)
VALUES ('OS-2024-001', 1, 2, '2024-10-05', '2024-10-05', 'concluida', 14);
INSERT INTO execucoes_operacao (ordem_servico_id, data_execucao, area_executada_ha, status)
VALUES (1, '2024-10-05', 180.50, 'concluida');
INSERT INTO plantios (execucao_id, variedade_id, populacao_plantas_ha, espacamento_cm, profundidade_cm, data_plantio)
VALUES (1, 1, 280000, 45.0, 3.5, '2024-10-05');
INSERT INTO apontamentos_equipamento (execucao_id, equipamento_id, horas_trabalhadas, horimetro_inicio, horimetro_fim, custo_total)
VALUES (1, 8, 18.5, 1180.00, 1198.50, 3330.00);
INSERT INTO apontamentos_mao_obra (execucao_id, colaborador_id, equipe_id, horas, custo_total)
VALUES (1, 1, 1, 18.5, 647.50);

-- OS Adubação talhão 1
INSERT INTO ordens_servico (numero, planejamento_safra_id, operacao_id, data_prevista, data_conclusao, status, responsavel_id)
VALUES ('OS-2024-002', 1, 3, '2024-10-06', '2024-10-06', 'concluida', 14);
INSERT INTO execucoes_operacao (ordem_servico_id, data_execucao, area_executada_ha, status) VALUES (2, '2024-10-06', 180.50, 'concluida');
INSERT INTO aplicacoes_insumos (execucao_id, insumo_id, lote_insumo_id, dose_ha, quantidade_total, custo_total)
VALUES (2, 14, 3, 350.0000, 63175.0000, 202160.00);
INSERT INTO apontamentos_equipamento (execucao_id, equipamento_id, horas_trabalhadas, custo_total) VALUES (2, 6, 8.0, 2560.00);

-- OS Herbicida talhão 1
INSERT INTO ordens_servico (numero, planejamento_safra_id, operacao_id, data_prevista, data_conclusao, status, responsavel_id)
VALUES ('OS-2024-003', 1, 5, '2024-11-15', '2024-11-15', 'concluida', 14);
INSERT INTO execucoes_operacao (ordem_servico_id, data_execucao, area_executada_ha, status) VALUES (3, '2024-11-15', 180.50, 'concluida');
INSERT INTO aplicacoes_insumos (execucao_id, insumo_id, lote_insumo_id, dose_ha, quantidade_total, custo_total)
VALUES (3, 1, 1, 2.5000, 451.2500, 8348.13);
INSERT INTO apontamentos_equipamento (execucao_id, equipamento_id, horas_trabalhadas, custo_total) VALUES (3, 6, 6.5, 2080.00);

-- OS Colheita talhão 1
INSERT INTO ordens_servico (numero, planejamento_safra_id, operacao_id, data_prevista, data_conclusao, status, responsavel_id)
VALUES ('OS-2024-004', 1, 9, '2025-02-20', '2025-02-20', 'concluida', 4);
INSERT INTO execucoes_operacao (ordem_servico_id, data_execucao, area_executada_ha, status) VALUES (4, '2025-02-20', 180.50, 'concluida');
INSERT INTO colheitas (execucao_id, data_colheita, umidade_pct, impureza_pct, quantidade_bruta_kg, quantidade_liquida_kg)
VALUES (4, '2025-02-20', 13.5, 1.2, 680000.00, 665000.00);
INSERT INTO producao_talhao (planejamento_safra_id, colheita_id, quantidade_sc, produtividade_sc_ha, data_registro)
VALUES (1, 1, 11083.33, 61.40, '2025-02-20');
INSERT INTO apontamentos_equipamento (execucao_id, equipamento_id, horas_trabalhadas, custo_total) VALUES (4, 4, 22.0, 18700.00);

-- Gerar OS/execuções para demais talhões (plantio + colheita simplificado via loop)
DO $$
DECLARE
    ps RECORD;
    os_id BIGINT;
    ex_id BIGINT;
    colh_id BIGINT;
    prod_sc NUMERIC;
BEGIN
    FOR ps IN SELECT id, talhao_id, cultura_id, variedade_id, area_planejada_ha, produtividade_meta_sc_ha
              FROM planejamento_safra WHERE safra_id = 2 AND id > 1
    LOOP
        INSERT INTO ordens_servico (numero, planejamento_safra_id, operacao_id, data_prevista, data_conclusao, status, responsavel_id)
        VALUES ('OS-2024-P' || ps.id, ps.id, 2, '2024-10-10', '2024-10-10', 'concluida', 14)
        RETURNING id INTO os_id;
        INSERT INTO execucoes_operacao (ordem_servico_id, data_execucao, area_executada_ha, status)
        VALUES (os_id, '2024-10-10', ps.area_planejada_ha, 'concluida') RETURNING id INTO ex_id;
        INSERT INTO plantios (execucao_id, variedade_id, populacao_plantas_ha, data_plantio)
        VALUES (ex_id, ps.variedade_id, 250000, '2024-10-10');

        INSERT INTO ordens_servico (numero, planejamento_safra_id, operacao_id, data_prevista, data_conclusao, status, responsavel_id)
        VALUES ('OS-2024-C' || ps.id, ps.id, 9, '2025-02-25', '2025-02-25', 'concluida', 4)
        RETURNING id INTO os_id;
        INSERT INTO execucoes_operacao (ordem_servico_id, data_execucao, area_executada_ha, status)
        VALUES (os_id, '2025-02-25', ps.area_planejada_ha, 'concluida') RETURNING id INTO ex_id;
        prod_sc := ps.area_planejada_ha * (ps.produtividade_meta_sc_ha * (0.95 + (ps.id % 5) * 0.02));
        INSERT INTO colheitas (execucao_id, data_colheita, umidade_pct, impureza_pct, quantidade_bruta_kg, quantidade_liquida_kg)
        VALUES (ex_id, '2025-02-25', 13.0, 1.0, prod_sc * 60, prod_sc * 60 * 0.98);
        INSERT INTO producao_talhao (planejamento_safra_id, colheita_id, quantidade_sc, produtividade_sc_ha, data_registro)
        VALUES (ps.id, currval('colheitas_id_seq'), prod_sc, prod_sc / ps.area_planejada_ha, '2025-02-25');
    END LOOP;
END $$;

-- Perdas produção
INSERT INTO perdas_producao (planejamento_safra_id, tipo, quantidade_sc, percentual, data_registro, observacao) VALUES
    (1, 'colheita', 120.00, 1.07, '2025-02-20', 'Perda mecânica colheitadeira'),
    (3, 'praga', 85.00, 0.62, '2025-02-25', 'Lagarta do cartucho'),
    (7, 'seca', 200.00, 1.32, '2025-02-25', 'Estresse hídrico período crítico');

-- Indicadores agronômicos
INSERT INTO indicadores_agronomicos (planejamento_safra_id, indicador, valor, unidade, data_medicao) VALUES
    (1, 'stand_plantas_ha', 265000, 'plantas/ha', '2024-11-30'),
    (1, 'altura_planta', 95.5, 'cm', '2025-01-15'),
    (1, 'infestacao_pragas_pct', 3.2, '%', '2025-01-20'),
    (3, 'stand_plantas_ha', 272000, 'plantas/ha', '2024-12-01'),
    (5, 'produtividade_estimada', 108.00, 'sc/ha', '2025-01-10');

-- Lotes produção e estoque
INSERT INTO lotes_producao (codigo, cultura_id, safra_id, talhao_id, data_colheita, quantidade_inicial_sc, umidade_pct)
SELECT 'LP-S' || ps.id, ps.cultura_id, 2, ps.talhao_id, '2025-02-25', pt.quantidade_sc, 13.0
FROM producao_talhao pt JOIN planejamento_safra ps ON pt.planejamento_safra_id = ps.id;

INSERT INTO estoque_producao (armazem_id, lote_producao_id, quantidade_atual_sc)
SELECT CASE WHEN lp.cultura_id = 5 THEN 3 ELSE 2 END, lp.id, lp.quantidade_inicial_sc * 0.85
FROM lotes_producao lp WHERE lp.safra_id = 2;

INSERT INTO movimentacoes_estoque_producao (estoque_producao_id, tipo, quantidade_sc, data_movimento, documento_ref)
SELECT ep.id, 'entrada', ep.quantidade_atual_sc, '2025-02-26 08:00:00', 'ENT-' || ep.id
FROM estoque_producao ep;

-- Classificação produção
INSERT INTO classificacao_producao (lote_producao_id, tipo, quantidade_sc, desconto_pct)
SELECT lp.id, 'tipo_1', lp.quantidade_inicial_sc * 0.90, 0 FROM lotes_producao lp WHERE lp.cultura_id IN (1,2,3);

-- Beneficiamento
INSERT INTO beneficiamento_producao (lote_producao_id, data_beneficiamento, tipo, quantidade_entrada_sc, quantidade_saida_sc, perda_pct, custo_total)
SELECT lp.id, '2025-03-01', 'Secagem', lp.quantidade_inicial_sc, lp.quantidade_inicial_sc * 0.98, 2.0, lp.quantidade_inicial_sc * 8.50
FROM lotes_producao lp WHERE lp.cultura_id IN (1,2) LIMIT 5;

-- Consumo combustível
INSERT INTO consumo_combustivel (equipamento_id, safra_id, data_abastecimento, litros, valor_total, horimetro, posto)
VALUES
    (1, 2, '2024-10-05 07:00:00', 450.000, 2925.00, 4500.00, 'Posto BR-060'),
    (4, 2, '2025-02-20 06:00:00', 800.000, 5200.00, 1830.00, 'Posto BR-060'),
    (6, 2, '2024-11-15 08:00:00', 320.000, 2080.00, 2780.00, 'Posto BR-060'),
    (1, 3, '2025-10-05 07:00:00', 380.000, 2470.00, 4520.00, 'Posto BR-060');

-- Manutenções
INSERT INTO manutencoes_equipamento (equipamento_id, tipo, data_manutencao, descricao, custo_total, horimetro, fornecedor_id) VALUES
    (4, 'preventiva', '2024-09-20', 'Revisão pré-colheita', 18500.00, 1800.00, 7),
    (1, 'corretiva', '2024-12-10', 'Troca embreagem', 8200.00, 4510.00, 7),
    (6, 'preventiva', '2025-01-15', 'Calibração bicos', 3500.00, 2790.00, 7);

-- Custos planejados e realizados
INSERT INTO custos_planejados (planejamento_safra_id, categoria, descricao, valor_planejado)
SELECT ps.id, 'insumos', 'Insumos agrícolas planejados', ps.area_planejada_ha * 2800.00
FROM planejamento_safra ps WHERE ps.safra_id = 2;

INSERT INTO custos_realizados (planejamento_safra_id, safra_id, categoria, descricao, valor_realizado, data_custo, origem_tipo)
SELECT ps.id, 2, 'insumos', 'Insumos realizados', ps.area_planejada_ha * 2650.00, '2024-12-31', 'aplicacao'
FROM planejamento_safra ps WHERE ps.safra_id = 2;

INSERT INTO rateios_custo (custo_realizado_id, talhao_id, percentual, valor_rateado)
SELECT cr.id, ps.talhao_id, 100.00, cr.valor_realizado
FROM custos_realizados cr JOIN planejamento_safra ps ON cr.planejamento_safra_id = ps.id;

-- Custo por talhão/cultura/operação
INSERT INTO custo_por_talhao (safra_id, talhao_id, cultura_id, custo_total, area_ha)
SELECT ps.safra_id, ps.talhao_id, ps.cultura_id, ps.area_planejada_ha * 2650.00, ps.area_planejada_ha
FROM planejamento_safra ps WHERE ps.safra_id = 2;

INSERT INTO custo_por_cultura (safra_id, cultura_id, custo_total, area_total_ha)
SELECT 2, ps.cultura_id, SUM(ps.area_planejada_ha * 2650.00), SUM(ps.area_planejada_ha)
FROM planejamento_safra ps WHERE ps.safra_id = 2 GROUP BY ps.cultura_id;

INSERT INTO custo_por_operacao (safra_id, operacao_id, custo_total, area_total_ha)
VALUES (2, 2, 450000.00, 3200.00), (2, 3, 680000.00, 3200.00), (2, 9, 520000.00, 3200.00), (2, 5, 180000.00, 3200.00);

-- Contratos venda
INSERT INTO contratos_venda (numero, cliente_id, cultura_id, safra_id, quantidade_sc, preco_sc, valor_total, data_contrato, data_entrega_prevista, status) VALUES
    ('CV-2024-001', 1, 1, 2, 50000.0000, 138.00, 6900000.00, '2024-11-01', '2025-03-31', 'entregue'),
    ('CV-2024-002', 2, 1, 2, 30000.0000, 140.00, 4200000.00, '2024-11-15', '2025-04-15', 'parcial'),
    ('CV-2024-003', 3, 2, 2, 25000.0000, 72.00, 1800000.00, '2024-12-01', '2025-04-30', 'entregue'),
    ('CV-2024-004', 4, 5, 2, 8000.0000, 850.00, 6800000.00, '2024-10-01', '2025-05-31', 'parcial'),
    ('CV-2024-005', 7, 3, 2, 10000.0000, 58.00, 580000.00, '2025-01-10', '2025-05-15', 'ativo'),
    ('CV-2024-006', 9, 4, 2, 5000.0000, 220.00, 1100000.00, '2025-01-20', '2025-06-30', 'ativo');

-- Entregas
INSERT INTO entregas_venda (contrato_id, data_entrega, quantidade_sc, placa_veiculo) VALUES
    (1, '2025-03-10', 25000.0000, 'ABC1D23'),
    (1, '2025-03-25', 25000.0000, 'DEF4G56'),
    (2, '2025-04-01', 15000.0000, 'GHI7J89'),
    (3, '2025-04-15', 25000.0000, 'KLM0N12'),
    (4, '2025-03-01', 4000.0000, 'OPQ3R45');

-- Notas fiscais mock
INSERT INTO notas_fiscais_mock (numero, serie, contrato_id, cliente_id, data_emissao, valor_total, status) VALUES
    ('000001', '1', 1, 1, '2025-03-10', 3450000.00, 'emitida'),
    ('000002', '1', 1, 1, '2025-03-25', 3450000.00, 'emitida'),
    ('000003', '1', 3, 3, '2025-04-15', 1800000.00, 'emitida');

-- Recebimentos venda
INSERT INTO recebimentos_venda (contrato_id, nota_fiscal_id, data_recebimento, valor, forma_pagamento) VALUES
    (1, 1, '2025-03-20', 3450000.00, 'ted'),
    (1, 2, '2025-04-05', 3450000.00, 'ted'),
    (3, 3, '2025-04-25', 1800000.00, 'pix');

-- Contas a pagar
INSERT INTO contas_pagar (numero_documento, fornecedor_id, categoria_id, centro_custo_id, safra_id, descricao, valor_original, valor_pago, data_emissao, data_vencimento, status) VALUES
    ('NF-1001', 4, 3, 1, 2, 'Defensivos agrícolas', 185000.00, 185000.00, '2024-10-15', '2024-11-15', 'pago'),
    ('NF-1002', 5, 3, 1, 2, 'Fertilizantes NPK', 420000.00, 420000.00, '2024-10-20', '2024-11-20', 'pago'),
    ('NF-1003', 3, 3, 1, 2, 'Sementes soja e milho', 680000.00, 680000.00, '2024-09-25', '2024-10-25', 'pago'),
    ('NF-1004', 6, 4, 1, 2, 'Combustível diesel', 95000.00, 95000.00, '2024-11-01', '2024-12-01', 'pago'),
    ('NF-1005', 7, 5, 4, 2, 'Manutenção colheitadeira', 18500.00, 18500.00, '2024-09-20', '2024-10-20', 'pago'),
    ('NF-2001', 4, 3, 1, 3, 'Defensivos safra 25/26', 95000.00, 0, '2025-10-01', '2025-11-01', 'aberto'),
    ('NF-2002', 5, 3, 1, 3, 'Fertilizantes safra 25/26', 210000.00, 0, '2025-10-05', '2025-11-05', 'aberto');

-- Contas a receber
INSERT INTO contas_receber (numero_documento, cliente_id, categoria_id, contrato_id, descricao, valor_original, valor_recebido, data_emissao, data_vencimento, status) VALUES
    ('CR-001', 1, 1, 1, 'Venda soja CV-2024-001', 6900000.00, 6900000.00, '2025-03-10', '2025-04-10', 'recebido'),
    ('CR-002', 2, 1, 2, 'Venda soja CV-2024-002 parcial', 2100000.00, 2100000.00, '2025-04-01', '2025-05-01', 'recebido'),
    ('CR-003', 3, 1, 3, 'Venda milho CV-2024-003', 1800000.00, 1800000.00, '2025-04-15', '2025-05-15', 'recebido'),
    ('CR-004', 4, 1, 4, 'Venda café CV-2024-004', 3400000.00, 0, '2025-03-01', '2025-06-01', 'aberto'),
    ('CR-005', 7, 1, 5, 'Venda sorgo CV-2024-005', 580000.00, 0, '2025-05-01', '2025-06-15', 'aberto');

-- Pagamentos
INSERT INTO pagamentos (conta_pagar_id, conta_bancaria_id, data_pagamento, valor, forma_pagamento)
SELECT cp.id, 1, cp.data_vencimento, cp.valor_pago, 'ted' FROM contas_pagar cp WHERE cp.status = 'pago';

-- Recebimentos
INSERT INTO recebimentos (conta_receber_id, conta_bancaria_id, data_recebimento, valor, forma_pagamento)
SELECT cr.id, 1, cr.data_vencimento + 5, cr.valor_recebido, 'ted' FROM contas_receber cr WHERE cr.status = 'recebido';

-- Fluxo de caixa (6 meses)
INSERT INTO fluxo_caixa (conta_bancaria_id, data_movimento, tipo, categoria_id, descricao, valor) VALUES
    (1, '2024-10-15', 'saida', 3, 'Pagamento defensivos', 185000.00),
    (1, '2024-10-25', 'saida', 3, 'Pagamento sementes', 680000.00),
    (1, '2024-11-20', 'saida', 3, 'Pagamento fertilizantes', 420000.00),
    (1, '2024-12-01', 'saida', 4, 'Combustível', 95000.00),
    (1, '2025-01-31', 'saida', 6, 'Folha pagamento janeiro', 125000.00),
    (1, '2025-02-28', 'saida', 6, 'Folha pagamento fevereiro', 125000.00),
    (1, '2025-03-20', 'entrada', 1, 'Recebimento venda soja', 3450000.00),
    (1, '2025-04-05', 'entrada', 1, 'Recebimento venda soja', 3450000.00),
    (1, '2025-04-25', 'entrada', 1, 'Recebimento venda milho', 1800000.00),
    (1, '2025-04-01', 'entrada', 1, 'Recebimento venda soja parcial', 2100000.00);

-- Apropriações de custo
INSERT INTO apropriacoes_custo (centro_custo_id, safra_id, talhao_id, cultura_id, origem_tipo, origem_id, valor, data_apropriacao)
SELECT 1, 2, ps.talhao_id, ps.cultura_id, 'custo_realizado', cr.id, cr.valor_realizado, cr.data_custo
FROM custos_realizados cr JOIN planejamento_safra ps ON cr.planejamento_safra_id = ps.id LIMIT 10;

-- Lançamentos contábeis (partidas dobradas balanceadas)
-- LC-001 Compra insumos
INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2024-001', '2024-10-20', 1, 'Compra fertilizantes NF-1002', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
    (1, 7, 'debito', 420000.00, 1),
    (1, 15, 'credito', 420000.00, NULL);

INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2024-002', '2024-10-25', 1, 'Compra sementes NF-1003', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
    (2, 7, 'debito', 680000.00, 1),
    (2, 15, 'credito', 680000.00, NULL);

INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2025-001', '2025-03-20', 2, 'Venda soja parcial CV-2024-001', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
    (3, 4, 'debito', 3450000.00),
    (3, 22, 'credito', 3450000.00);

INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2025-002', '2025-04-05', 2, 'Venda soja CV-2024-001', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
    (4, 4, 'debito', 3450000.00),
    (4, 22, 'credito', 3450000.00);

INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2025-003', '2025-04-25', 2, 'Venda milho CV-2024-003', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
    (5, 4, 'debito', 1800000.00),
    (5, 23, 'credito', 1800000.00);

INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2024-003', '2024-12-01', 8, 'Combustível operacional', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
    (6, 30, 'debito', 95000.00, 1),
    (6, 4, 'credito', 95000.00, NULL);

INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2025-004', '2025-01-31', 3, 'Folha pagamento janeiro/2025', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
    (7, 31, 'debito', 125000.00),
    (7, 4, 'credito', 125000.00);

INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, status)
VALUES ('LC-2025-005', '2025-02-28', 3, 'Folha pagamento fevereiro/2025', 2, 'lançado');
INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
    (8, 31, 'debito', 125000.00),
    (8, 4, 'credito', 125000.00);

-- Fechamentos contábeis (8 meses)
INSERT INTO fechamentos_contabeis (ano, mes, status) VALUES
    (2024, 10, 'fechado'), (2024, 11, 'fechado'), (2024, 12, 'fechado'),
    (2025, 1, 'fechado'), (2025, 2, 'fechado'), (2025, 3, 'fechado'),
    (2025, 4, 'fechado'), (2025, 5, 'fechado');

-- Balancetes por fechamento (amostra contas principais)
INSERT INTO balancetes (fechamento_id, conta_id, saldo_anterior, debitos, creditos, saldo_final)
SELECT f.id, c.id,
    CASE c.codigo WHEN '1.1.01.001' THEN 800000.00 WHEN '4.1.01' THEN 0 WHEN '5.1.01' THEN 0 ELSE 0 END,
    CASE c.codigo WHEN '1.1.01.001' THEN 8700000.00 WHEN '5.1.01' THEN 1100000.00 ELSE 0 END,
    CASE c.codigo WHEN '1.1.01.001' THEN 1285000.00 WHEN '4.1.01' THEN 6900000.00 ELSE 0 END,
    CASE c.codigo WHEN '1.1.01.001' THEN 8215000.00 WHEN '4.1.01' THEN 6900000.00 WHEN '5.1.01' THEN 1100000.00 ELSE 0 END
FROM fechamentos_contabeis f
CROSS JOIN plano_contas c
WHERE f.ano = 2025 AND f.mes = 4 AND c.codigo IN ('1.1.01.001', '4.1.01', '5.1.01');

-- DRE gerencial
INSERT INTO dre_gerencial (fechamento_id, safra_id, cultura_id, receita_bruta, custos_variaveis, custos_fixos) VALUES
    (7, 2, 1, 11100000.00, 6200000.00, 850000.00),
    (7, 2, 2, 1800000.00, 980000.00, 120000.00),
    (7, 2, 3, 580000.00, 320000.00, 45000.00),
    (7, 2, 4, 1100000.00, 620000.00, 80000.00),
    (7, 2, 5, 3400000.00, 1800000.00, 250000.00);

-- Movimentações estoque insumos (saídas operacionais)
INSERT INTO movimentacoes_estoque_insumos (estoque_insumo_id, tipo, quantidade, data_movimento, documento_ref, observacao)
VALUES (3, 'saida', 21175.0000, '2024-10-06 10:00:00', 'OS-2024-002', 'Adubação base talhão 1'),
       (1, 'saida', 451.2500, '2024-11-15 14:00:00', 'OS-2024-003', 'Herbicida talhão 1');

-- OS safra 2025/26 (parcial — plantio em andamento)
INSERT INTO ordens_servico (numero, planejamento_safra_id, operacao_id, data_prevista, status, responsavel_id)
VALUES ('OS-2025-001', 19, 2, '2025-10-05', 'em_andamento', 14);
INSERT INTO execucoes_operacao (ordem_servico_id, data_execucao, area_executada_ha, status) VALUES (currval('ordens_servico_id_seq'), '2025-10-05', 180.50, 'em_andamento');
INSERT INTO plantios (execucao_id, variedade_id, populacao_plantas_ha, data_plantio)
VALUES (currval('execucoes_operacao_id_seq'), 1, 285000, '2025-10-05');

-- <<< END 03_seed_operational_data.sql

-- >>> BEGIN 04_views_kpis.sql
-- 04_views_kpis.sql — views analíticas para BI
SET search_path TO agro, public;

-- 1. Custo por hectare por cultura e safra
CREATE OR REPLACE VIEW vw_custo_hectare_cultura_safra AS
SELECT
    s.id AS safra_id,
    s.codigo AS safra_codigo,
    c.id AS cultura_id,
    c.nome AS cultura_nome,
    cpc.custo_total,
    cpc.area_total_ha,
    cpc.custo_ha,
    ROUND(cpc.custo_ha, 2) AS custo_hectare
FROM custo_por_cultura cpc
JOIN safras s ON s.id = cpc.safra_id
JOIN culturas c ON c.id = cpc.cultura_id;

-- 2. Custo por saca por cultura e safra
CREATE OR REPLACE VIEW vw_custo_saca_cultura_safra AS
SELECT
    s.codigo AS safra_codigo,
    c.nome AS cultura_nome,
    cpc.custo_total,
    COALESCE(SUM(pt.quantidade_sc), 0) AS producao_total_sc,
    CASE WHEN COALESCE(SUM(pt.quantidade_sc), 0) > 0
         THEN ROUND(cpc.custo_total / SUM(pt.quantidade_sc), 2)
         ELSE NULL END AS custo_por_saca
FROM custo_por_cultura cpc
JOIN safras s ON s.id = cpc.safra_id
JOIN culturas c ON c.id = cpc.cultura_id
LEFT JOIN planejamento_safra ps ON ps.safra_id = cpc.safra_id AND ps.cultura_id = cpc.cultura_id
LEFT JOIN producao_talhao pt ON pt.planejamento_safra_id = ps.id
GROUP BY s.codigo, c.nome, cpc.custo_total, cpc.safra_id, cpc.cultura_id;

-- 3. Resultado gerencial por cultura
CREATE OR REPLACE VIEW vw_resultado_gerencial_cultura AS
SELECT
    s.codigo AS safra_codigo,
    c.nome AS cultura_nome,
    d.receita_bruta,
    d.custos_variaveis,
    d.custos_fixos,
    d.resultado,
    ROUND(d.resultado / NULLIF(d.receita_bruta, 0) * 100, 2) AS margem_pct
FROM dre_gerencial d
JOIN fechamentos_contabeis f ON f.id = d.fechamento_id
JOIN safras s ON s.id = d.safra_id
JOIN culturas c ON c.id = d.cultura_id
WHERE f.status = 'fechado';

-- 4. Resultado por talhão
CREATE OR REPLACE VIEW vw_resultado_talhao AS
SELECT
    s.codigo AS safra_codigo,
    t.codigo AS talhao_codigo,
    t.nome AS talhao_nome,
    c.nome AS cultura_nome,
    cpt.custo_total,
    COALESCE(pt.quantidade_sc, 0) AS producao_sc,
    COALESCE(cv.preco_sc, 0) AS preco_medio_sc,
    ROUND(COALESCE(pt.quantidade_sc, 0) * COALESCE(cv.preco_sc, 0) - cpt.custo_total, 2) AS resultado_estimado
FROM custo_por_talhao cpt
JOIN safras s ON s.id = cpt.safra_id
JOIN talhoes t ON t.id = cpt.talhao_id
JOIN culturas c ON c.id = cpt.cultura_id
LEFT JOIN producao_talhao pt ON pt.planejamento_safra_id IN (
    SELECT ps.id FROM planejamento_safra ps
    WHERE ps.safra_id = cpt.safra_id AND ps.talhao_id = cpt.talhao_id AND ps.cultura_id = cpt.cultura_id
)
LEFT JOIN (
    SELECT cultura_id, safra_id, AVG(preco_sc) AS preco_sc
    FROM contratos_venda GROUP BY cultura_id, safra_id
) cv ON cv.cultura_id = cpt.cultura_id AND cv.safra_id = cpt.safra_id;

-- 5. Estoque atual de insumos
CREATE OR REPLACE VIEW vw_estoque_insumos_atual AS
SELECT
    a.codigo AS armazem_codigo,
    a.nome AS armazem_nome,
    i.codigo AS insumo_codigo,
    i.nome AS insumo_nome,
    ci.nome AS categoria,
    um.sigla AS unidade,
    li.numero_lote,
    ei.quantidade_atual,
    li.custo_unitario,
    ROUND(ei.quantidade_atual * li.custo_unitario, 2) AS valor_estoque
FROM estoque_insumos ei
JOIN armazens a ON a.id = ei.armazem_id
JOIN lotes_insumo li ON li.id = ei.lote_insumo_id
JOIN insumos i ON i.id = li.insumo_id
JOIN categorias_insumo ci ON ci.id = i.categoria_id
JOIN unidades_medida um ON um.id = i.unidade_medida_id
WHERE ei.quantidade_atual > 0;

-- 6. Estoque atual de produção
CREATE OR REPLACE VIEW vw_estoque_producao_atual AS
SELECT
    a.codigo AS armazem_codigo,
    c.nome AS cultura_nome,
    s.codigo AS safra_codigo,
    lp.codigo AS lote_codigo,
    t.codigo AS talhao_codigo,
    ep.quantidade_atual_sc,
    lp.umidade_pct,
    lp.data_colheita
FROM estoque_producao ep
JOIN armazens a ON a.id = ep.armazem_id
JOIN lotes_producao lp ON lp.id = ep.lote_producao_id
JOIN culturas c ON c.id = lp.cultura_id
JOIN safras s ON s.id = lp.safra_id
LEFT JOIN talhoes t ON t.id = lp.talhao_id
WHERE ep.quantidade_atual_sc > 0;

-- 7. Uso de máquinas por safra
CREATE OR REPLACE VIEW vw_uso_maquinas_safra AS
SELECT
    s.codigo AS safra_codigo,
    e.codigo AS equipamento_codigo,
    e.nome AS equipamento_nome,
    ce.nome AS categoria,
    SUM(ae.horas_trabalhadas) AS horas_totais,
    SUM(ae.custo_total) AS custo_total,
    COUNT(ae.id) AS apontamentos
FROM apontamentos_equipamento ae
JOIN execucoes_operacao ex ON ex.id = ae.execucao_id
JOIN ordens_servico os ON os.id = ex.ordem_servico_id
JOIN planejamento_safra ps ON ps.id = os.planejamento_safra_id
JOIN safras s ON s.id = ps.safra_id
JOIN equipamentos e ON e.id = ae.equipamento_id
JOIN categorias_equipamento ce ON ce.id = e.categoria_id
GROUP BY s.codigo, e.codigo, e.nome, ce.nome;

-- 8. Horas de mão de obra por safra
CREATE OR REPLACE VIEW vw_horas_mao_obra_safra AS
SELECT
    s.codigo AS safra_codigo,
    col.codigo AS colaborador_codigo,
    col.nome AS colaborador_nome,
    car.nome AS cargo,
    eq.nome AS equipe,
    SUM(am.horas) AS horas_totais,
    SUM(am.custo_total) AS custo_total
FROM apontamentos_mao_obra am
JOIN execucoes_operacao ex ON ex.id = am.execucao_id
JOIN ordens_servico os ON os.id = ex.ordem_servico_id
JOIN planejamento_safra ps ON ps.id = os.planejamento_safra_id
JOIN safras s ON s.id = ps.safra_id
JOIN colaboradores col ON col.id = am.colaborador_id
JOIN cargos car ON car.id = col.cargo_id
LEFT JOIN equipes eq ON eq.id = am.equipe_id
GROUP BY s.codigo, col.codigo, col.nome, car.nome, eq.nome;

-- 9. Fluxo de caixa realizado
CREATE OR REPLACE VIEW vw_fluxo_caixa_realizado AS
SELECT
    fc.data_movimento,
    fc.tipo,
    cf.nome AS categoria,
    fc.descricao,
    fc.valor,
    cb.codigo AS conta_bancaria,
    SUM(CASE WHEN fc.tipo = 'entrada' THEN fc.valor ELSE -fc.valor END)
        OVER (ORDER BY fc.data_movimento, fc.id) AS saldo_acumulado
FROM fluxo_caixa fc
JOIN contas_bancarias cb ON cb.id = fc.conta_bancaria_id
LEFT JOIN categorias_financeiras cf ON cf.id = fc.categoria_id
ORDER BY fc.data_movimento, fc.id;

-- 10. Balancete contábil
CREATE OR REPLACE VIEW vw_balancete_contabil AS
SELECT
    f.ano,
    f.mes,
    pc.codigo AS conta_codigo,
    pc.nome AS conta_nome,
    pc.tipo AS conta_tipo,
    b.saldo_anterior,
    b.debitos,
    b.creditos,
    b.saldo_final
FROM balancetes b
JOIN fechamentos_contabeis f ON f.id = b.fechamento_id
JOIN plano_contas pc ON pc.id = b.conta_id
WHERE f.status = 'fechado';

-- 11. DRE gerencial
CREATE OR REPLACE VIEW vw_dre_gerencial AS
SELECT
    f.ano,
    f.mes,
    s.codigo AS safra_codigo,
    c.nome AS cultura_nome,
    d.receita_bruta,
    d.custos_variaveis,
    d.custos_fixos,
    d.resultado,
    ROUND(d.resultado / NULLIF(d.receita_bruta, 0) * 100, 2) AS margem_liquida_pct
FROM dre_gerencial d
JOIN fechamentos_contabeis f ON f.id = d.fechamento_id
LEFT JOIN safras s ON s.id = d.safra_id
LEFT JOIN culturas c ON c.id = d.cultura_id
WHERE f.status = 'fechado';

-- 12. Margem bruta por cultura
CREATE OR REPLACE VIEW vw_margem_bruta_cultura AS
SELECT
    s.codigo AS safra_codigo,
    c.nome AS cultura_nome,
    d.receita_bruta,
    d.custos_variaveis,
    d.receita_bruta - d.custos_variaveis AS margem_bruta,
    ROUND((d.receita_bruta - d.custos_variaveis) / NULLIF(d.receita_bruta, 0) * 100, 2) AS margem_bruta_pct
FROM dre_gerencial d
JOIN fechamentos_contabeis f ON f.id = d.fechamento_id
JOIN safras s ON s.id = d.safra_id
JOIN culturas c ON c.id = d.cultura_id
WHERE f.status = 'fechado';

-- 13. Produtividade por talhão
CREATE OR REPLACE VIEW vw_produtividade_talhao AS
SELECT
    s.codigo AS safra_codigo,
    t.codigo AS talhao_codigo,
    t.nome AS talhao_nome,
    c.nome AS cultura_nome,
    ps.area_planejada_ha,
    ps.produtividade_meta_sc_ha,
    pt.quantidade_sc AS producao_sc,
    pt.produtividade_sc_ha,
    ROUND((pt.produtividade_sc_ha / NULLIF(ps.produtividade_meta_sc_ha, 0) - 1) * 100, 2) AS variacao_meta_pct
FROM producao_talhao pt
JOIN planejamento_safra ps ON ps.id = pt.planejamento_safra_id
JOIN safras s ON s.id = ps.safra_id
JOIN talhoes t ON t.id = ps.talhao_id
JOIN culturas c ON c.id = ps.cultura_id;

-- 14. Comercialização por cultura
CREATE OR REPLACE VIEW vw_comercializacao_cultura AS
SELECT
    s.codigo AS safra_codigo,
    c.nome AS cultura_nome,
    COUNT(cv.id) AS qtd_contratos,
    SUM(cv.quantidade_sc) AS volume_contratado_sc,
    SUM(cv.valor_total) AS valor_contratado,
    COALESCE(SUM(ev.quantidade_sc), 0) AS volume_entregue_sc,
    ROUND(COALESCE(SUM(ev.quantidade_sc), 0) / NULLIF(SUM(cv.quantidade_sc), 0) * 100, 2) AS pct_entregue
FROM contratos_venda cv
JOIN culturas c ON c.id = cv.cultura_id
JOIN safras s ON s.id = cv.safra_id
LEFT JOIN entregas_venda ev ON ev.contrato_id = cv.id
GROUP BY s.codigo, c.nome, c.id, s.id;

-- Role read-only para BI (PostgREST)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agro_mock_readonly') THEN
        CREATE ROLE agro_mock_readonly NOLOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA agro TO agro_mock_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA agro TO agro_mock_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA agro GRANT SELECT ON TABLES TO agro_mock_readonly;

-- Nota: GRANT agro_mock_readonly TO agro_mock_user é feito no script de deploy

-- <<< END 04_views_kpis.sql

