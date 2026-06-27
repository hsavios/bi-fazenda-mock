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
