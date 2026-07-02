-- =============================================================================
-- Seed complementar — contabilidade e DRE gerencial (idempotente)
-- Dados fictícios gerenciais · partidas dobradas balanceadas
-- =============================================================================
SET search_path TO agro, public;

-- Vínculos analíticos opcionais nos lançamentos
ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS cultura_id BIGINT REFERENCES culturas(id);
ALTER TABLE lancamentos_contabeis ADD COLUMN IF NOT EXISTS talhao_id BIGINT REFERENCES talhoes(id);

-- Mapeamento conta → grupo DRE gerencial
CREATE TABLE IF NOT EXISTS mapeamento_conta_dre (
    conta_codigo      VARCHAR(20) PRIMARY KEY,
    grupo_dre         VARCHAR(120) NOT NULL,
    subgrupo_dre      VARCHAR(150),
    ordem_grupo       INTEGER NOT NULL,
    ordem_subgrupo    INTEGER NOT NULL DEFAULT 0,
    tipo_linha        VARCHAR(40) NOT NULL,
    cultura_nome      VARCHAR(50)
);

-- ─── Plano de contas complementar ───
INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica)
SELECT '4.2', 'Deduções da Receita', 'receita', 'devedora', id, 2, FALSE FROM plano_contas WHERE codigo = '4'
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica)
SELECT v.codigo, v.nome, 'receita', 'devedora', p.id, 3, TRUE
FROM (VALUES
    ('4.2.01', 'Funrural / contribuição rural'),
    ('4.2.02', 'Descontos comerciais'),
    ('4.2.03', 'Quebras e descontos de classificação')
) v(codigo, nome)
JOIN plano_contas p ON p.codigo = '4.2'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica)
SELECT v.codigo, v.nome, 'despesa', 'devedora', p.id, 3, TRUE
FROM (VALUES
    ('5.1.05', 'Defensivos agrícolas'),
    ('5.1.06', 'Sementes e mudas'),
    ('5.1.07', 'Operações mecanizadas'),
    ('5.1.08', 'Beneficiamento e secagem'),
    ('5.1.09', 'Frete e logística operacional'),
    ('5.1.10', 'Arrendamentos e custos fixos agrícolas'),
    ('5.1.11', 'Manutenção estrutural'),
    ('5.1.12', 'Supervisão técnica'),
    ('5.1.13', 'Depreciação de benfeitorias')
) v(codigo, nome)
JOIN plano_contas p ON p.codigo = '5.1'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica)
SELECT v.codigo, v.nome, 'despesa', 'devedora', p.id, 3, TRUE
FROM (VALUES
    ('5.2.03', 'Despesas comerciais'),
    ('5.2.04', 'Comissões sobre vendas'),
    ('5.2.05', 'Fretes comerciais'),
    ('5.2.06', 'Armazenagem comercial'),
    ('5.2.07', 'Taxas de comercialização'),
    ('5.2.08', 'Serviços profissionais'),
    ('5.2.09', 'Sistemas e tecnologia'),
    ('5.2.10', 'Tributos estimados sobre resultado')
) v(codigo, nome)
JOIN plano_contas p ON p.codigo = '5.2'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica)
SELECT '4.3', 'Resultado Financeiro', 'receita', 'credora', id, 2, FALSE FROM plano_contas WHERE codigo = '4'
ON CONFLICT (codigo) DO NOTHING;
INSERT INTO plano_contas (codigo, nome, tipo, natureza, conta_pai_id, nivel, analitica)
SELECT '4.3.01', 'Juros e rendimentos financeiros', 'receita', 'credora', id, 3, TRUE FROM plano_contas WHERE codigo = '4.3'
ON CONFLICT (codigo) DO NOTHING;

-- Renomear contas analíticas existentes para subgrupos DRE
UPDATE plano_contas SET nome = 'Fertilizantes e corretivos' WHERE codigo = '5.1.01';

-- ─── Mapeamento DRE (idempotente) ───
INSERT INTO mapeamento_conta_dre (conta_codigo, grupo_dre, subgrupo_dre, ordem_grupo, ordem_subgrupo, tipo_linha, cultura_nome) VALUES
    ('4.1.01', 'Receita Operacional Bruta', 'Venda Soja', 10, 1, 'receita', 'Soja'),
    ('4.1.02', 'Receita Operacional Bruta', 'Venda Milho', 10, 2, 'receita', 'Milho'),
    ('4.1.03', 'Receita Operacional Bruta', 'Venda Sorgo', 10, 3, 'receita', 'Sorgo'),
    ('4.1.04', 'Receita Operacional Bruta', 'Venda Feijão', 10, 4, 'receita', 'Feijão'),
    ('4.1.05', 'Receita Operacional Bruta', 'Venda Café', 10, 5, 'receita', 'Café'),
    ('4.2.01', 'Deduções da Receita', 'Funrural', 20, 1, 'deducao', NULL),
    ('4.2.02', 'Deduções da Receita', 'Descontos comerciais', 20, 2, 'deducao', NULL),
    ('4.2.03', 'Deduções da Receita', 'Quebras/classificação', 20, 3, 'deducao', NULL),
    ('5.1.01', 'Custos Variáveis / CPV Agrícola', 'Fertilizantes e corretivos', 40, 1, 'custo_variavel', NULL),
    ('5.1.05', 'Custos Variáveis / CPV Agrícola', 'Defensivos', 40, 2, 'custo_variavel', NULL),
    ('5.1.06', 'Custos Variáveis / CPV Agrícola', 'Sementes e mudas', 40, 3, 'custo_variavel', NULL),
    ('5.1.02', 'Custos Variáveis / CPV Agrícola', 'Combustíveis e lubrificantes', 40, 4, 'custo_variavel', NULL),
    ('5.1.07', 'Custos Variáveis / CPV Agrícola', 'Operações mecanizadas', 40, 5, 'custo_variavel', NULL),
    ('5.1.03', 'Custos Variáveis / CPV Agrícola', 'Mão de obra direta', 40, 6, 'custo_variavel', NULL),
    ('5.1.08', 'Custos Variáveis / CPV Agrícola', 'Beneficiamento e secagem', 40, 7, 'custo_variavel', NULL),
    ('5.1.09', 'Custos Variáveis / CPV Agrícola', 'Frete operacional', 40, 8, 'custo_variavel', NULL),
    ('5.1.10', 'Custos Fixos Agrícolas', 'Arrendamentos', 60, 1, 'custo_fixo', NULL),
    ('5.1.11', 'Custos Fixos Agrícolas', 'Manutenção estrutural', 60, 2, 'custo_fixo', NULL),
    ('5.1.12', 'Custos Fixos Agrícolas', 'Supervisão técnica', 60, 3, 'custo_fixo', NULL),
    ('5.2.03', 'Despesas Comerciais', 'Despesas comerciais', 80, 1, 'despesa_comercial', NULL),
    ('5.2.04', 'Despesas Comerciais', 'Comissões', 80, 2, 'despesa_comercial', NULL),
    ('5.2.05', 'Despesas Comerciais', 'Fretes comerciais', 80, 3, 'despesa_comercial', NULL),
    ('5.2.06', 'Despesas Comerciais', 'Armazenagem', 80, 4, 'despesa_comercial', NULL),
    ('5.2.07', 'Despesas Comerciais', 'Taxas de comercialização', 80, 5, 'despesa_comercial', NULL),
    ('5.2.01', 'Despesas Administrativas', 'Administrativo', 90, 1, 'despesa_admin', NULL),
    ('5.2.08', 'Despesas Administrativas', 'Serviços profissionais', 90, 2, 'despesa_admin', NULL),
    ('5.2.09', 'Despesas Administrativas', 'Sistemas', 90, 3, 'despesa_admin', NULL),
    ('5.1.04', 'Depreciação e Amortização', 'Depreciação de máquinas', 110, 1, 'depreciacao', NULL),
    ('5.1.13', 'Depreciação e Amortização', 'Depreciação de benfeitorias', 110, 2, 'depreciacao', NULL),
    ('4.3.01', 'Resultado Financeiro', 'Juros ativos', 120, 1, 'financeiro_receita', NULL),
    ('5.2.02', 'Resultado Financeiro', 'Juros passivos e tarifas', 120, 2, 'financeiro_despesa', NULL),
    ('5.2.10', 'Tributos sobre Resultado', 'IR/CS estimado', 140, 1, 'tributo', NULL)
ON CONFLICT (conta_codigo) DO UPDATE SET
    grupo_dre = EXCLUDED.grupo_dre,
    subgrupo_dre = EXCLUDED.subgrupo_dre,
    ordem_grupo = EXCLUDED.ordem_grupo,
    ordem_subgrupo = EXCLUDED.ordem_subgrupo,
    tipo_linha = EXCLUDED.tipo_linha,
    cultura_nome = EXCLUDED.cultura_nome;

-- Históricos complementares
INSERT INTO historicos_padrao (codigo, descricao) VALUES
    ('HP11', 'Dedução sobre receita agrícola'),
    ('HP12', 'Despesa comercial da safra'),
    ('HP13', 'Despesa administrativa'),
    ('HP14', 'Resultado financeiro'),
    ('HP15', 'Provisão tributária estimada')
ON CONFLICT (codigo) DO NOTHING;

-- ─── Lançamentos complementares (prefixo DRE-LC) ───
DO $$
DECLARE
    safra_id BIGINT := (SELECT id FROM safras WHERE codigo = '2024/25');
    cc_graos BIGINT := (SELECT id FROM centros_custo WHERE codigo = 'CC-GRAOS');
    cc_cafe BIGINT := (SELECT id FROM centros_custo WHERE codigo = 'CC-CAFE');
    cc_adm BIGINT := (SELECT id FROM centros_custo WHERE codigo = 'CC-ADM');
    c_soja BIGINT := (SELECT id FROM culturas WHERE nome = 'Soja');
    c_milho BIGINT := (SELECT id FROM culturas WHERE nome = 'Milho');
    c_cafe BIGINT := (SELECT id FROM culturas WHERE nome = 'Café');
    c_sorgo BIGINT := (SELECT id FROM culturas WHERE nome = 'Sorgo');
    c_feijao BIGINT := (SELECT id FROM culturas WHERE nome = 'Feijão');
    lid BIGINT;
BEGIN
    -- helper via inline inserts

    -- Receitas adicionais por cultura (2025-03 a 2025-05)
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-010') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, cultura_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-010', '2025-03-15', 2, 'Venda soja safra 2024/25 — lote complementar', safra_id, c_soja, 'venda', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '1.1.01.001'), 'debito', 4200000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.1.01'), 'credito', 4200000.00, cc_graos);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-011') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, cultura_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-011', '2025-04-10', 2, 'Venda café arábica', safra_id, c_cafe, 'venda', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '1.1.01.001'), 'debito', 3400000.00, cc_cafe),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.1.05'), 'credito', 3400000.00, cc_cafe);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-012') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, cultura_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-012', '2025-04-18', 2, 'Venda sorgo', safra_id, c_sorgo, 'venda', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '1.1.01.001'), 'debito', 580000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.1.03'), 'credito', 580000.00, cc_graos);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-013') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, cultura_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-013', '2025-05-05', 2, 'Venda feijão', safra_id, c_feijao, 'venda', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '1.1.01.001'), 'debito', 1100000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.1.04'), 'credito', 1100000.00, cc_graos);
    END IF;

    -- Deduções
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-020') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-020', '2025-04-30', 11, 'Funrural safra 2024/25', safra_id, 'deducao', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.2.01'), 'debito', 268500.00),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '1.1.01.001'), 'credito', 268500.00);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-021') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-021', '2025-04-30', 11, 'Descontos comerciais e quebras', safra_id, 'deducao', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.2.02'), 'debito', 145000.00),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.2.03'), 'debito', 82000.00),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '1.1.01.001'), 'credito', 227000.00);
    END IF;

    -- Custos variáveis distribuídos
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2024-030') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, cultura_id, origem_tipo, status)
        VALUES ('DRE-LC-2024-030', '2024-11-10', 1, 'Defensivos soja/milho', safra_id, c_soja, 'custo', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.05'), 'debito', 890000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 890000.00, NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2024-031') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, cultura_id, origem_tipo, status)
        VALUES ('DRE-LC-2024-031', '2024-10-28', 1, 'Sementes soja', safra_id, c_soja, 'custo', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.06'), 'debito', 720000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 720000.00, NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2024-032') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2024-032', '2024-12-15', 8, 'Operações mecanizadas safra', safra_id, 'custo', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.07'), 'debito', 1250000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 1250000.00, NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-033') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, cultura_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-033', '2025-02-15', 7, 'Beneficiamento e secagem grãos', safra_id, c_milho, 'custo', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.08'), 'debito', 380000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 380000.00, NULL);
    END IF;

    -- Custos fixos
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-040') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-040', '2025-01-15', 6, 'Arrendamento áreas 2024/25', safra_id, 'custo_fixo', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.10'), 'debito', 420000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 420000.00, NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-041') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-041', '2025-02-28', 9, 'Manutenção estrutural e supervisão', safra_id, 'custo_fixo', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.11'), 'debito', 185000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.12'), 'debito', 95000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 280000.00, NULL);
    END IF;

    -- Despesas comerciais
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-050') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-050', '2025-04-20', 12, 'Comissões e fretes comerciais', safra_id, 'despesa_comercial', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.04'), 'debito', 210000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.05'), 'debito', 165000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.06'), 'debito', 98000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 473000.00, NULL);
    END IF;

    -- Despesas administrativas
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-051') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-051', '2025-03-31', 13, 'Administrativo, sistemas e consultoria', safra_id, 'despesa_admin', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.01'), 'debito', 145000.00, cc_adm),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.08'), 'debito', 62000.00, cc_adm),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.09'), 'debito', 48000.00, cc_adm),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 255000.00, NULL);
    END IF;

    -- Depreciação
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-060') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-060', '2025-04-30', 4, 'Depreciação mensal acumulada safra', safra_id, 'depreciacao', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor, centro_custo_id) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.04'), 'debito', 320000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.1.13'), 'debito', 85000.00, cc_graos),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '1.2.01.001'), 'credito', 405000.00, NULL);
    END IF;

    -- Financeiro
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-070') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-070', '2025-04-30', 14, 'Juros custeio e tarifas bancárias', safra_id, 'financeiro', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.02'), 'debito', 198000.00),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '4.3.01'), 'credito', 42000.00),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 156000.00);
    END IF;

    -- Tributos estimados
    IF NOT EXISTS (SELECT 1 FROM lancamentos_contabeis WHERE numero = 'DRE-LC-2025-080') THEN
        INSERT INTO lancamentos_contabeis (numero, data_lancamento, historico_id, historico_complementar, safra_id, origem_tipo, status)
        VALUES ('DRE-LC-2025-080', '2025-05-31', 15, 'Provisão IR/CS estimada demonstrativa', safra_id, 'tributo', 'lançado') RETURNING id INTO lid;
        INSERT INTO partidas_lancamento (lancamento_id, conta_id, tipo, valor) VALUES
            (lid, (SELECT id FROM plano_contas WHERE codigo = '5.2.10'), 'debito', 385000.00),
            (lid, (SELECT id FROM plano_contas WHERE codigo = '2.1.01'), 'credito', 385000.00);
    END IF;
END $$;

-- Atualizar cultura_id nos lançamentos antigos de venda
UPDATE lancamentos_contabeis SET cultura_id = (SELECT id FROM culturas WHERE nome = 'Soja')
WHERE numero IN ('LC-2025-001', 'LC-2025-002') AND cultura_id IS NULL;
UPDATE lancamentos_contabeis SET cultura_id = (SELECT id FROM culturas WHERE nome = 'Milho')
WHERE numero = 'LC-2025-003' AND cultura_id IS NULL;

COMMENT ON TABLE mapeamento_conta_dre IS 'Mapeamento gerencial do plano de contas para grupos da DRE demonstrativa';
