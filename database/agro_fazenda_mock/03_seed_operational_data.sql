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
