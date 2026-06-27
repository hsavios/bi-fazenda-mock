-- 05_validation_queries.sql — consultas de validação de integridade
SET search_path TO agro, public;

\echo '=== VALIDAÇÃO: Contagens mínimas ==='

SELECT 'fazendas' AS entidade, COUNT(*) AS total, CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALHA' END AS status FROM fazendas
UNION ALL SELECT 'talhoes', COUNT(*), CASE WHEN COUNT(*) >= 15 THEN 'OK' ELSE 'FALHA' END FROM talhoes
UNION ALL SELECT 'culturas', COUNT(*), CASE WHEN COUNT(*) >= 5 THEN 'OK' ELSE 'FALHA' END FROM culturas
UNION ALL SELECT 'safras', COUNT(*), CASE WHEN COUNT(*) >= 2 THEN 'OK' ELSE 'FALHA' END FROM safras
UNION ALL SELECT 'variedades', COUNT(*), CASE WHEN COUNT(*) >= 5 THEN 'OK' ELSE 'FALHA' END FROM variedades
UNION ALL SELECT 'insumos', COUNT(*), CASE WHEN COUNT(*) >= 30 THEN 'OK' ELSE 'FALHA' END FROM insumos
UNION ALL SELECT 'equipamentos', COUNT(*), CASE WHEN COUNT(*) >= 10 THEN 'OK' ELSE 'FALHA' END FROM equipamentos
UNION ALL SELECT 'colaboradores', COUNT(*), CASE WHEN COUNT(*) >= 15 THEN 'OK' ELSE 'FALHA' END FROM colaboradores
UNION ALL SELECT 'fornecedores', COUNT(*), CASE WHEN COUNT(*) >= 10 THEN 'OK' ELSE 'FALHA' END FROM fornecedores
UNION ALL SELECT 'clientes', COUNT(*), CASE WHEN COUNT(*) >= 10 THEN 'OK' ELSE 'FALHA' END FROM clientes
UNION ALL SELECT 'operacoes_agricolas', COUNT(*), CASE WHEN COUNT(*) >= 5 THEN 'OK' ELSE 'FALHA' END FROM operacoes_agricolas
UNION ALL SELECT 'contratos_venda', COUNT(*), CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALHA' END FROM contratos_venda
UNION ALL SELECT 'contas_pagar', COUNT(*), CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALHA' END FROM contas_pagar
UNION ALL SELECT 'contas_receber', COUNT(*), CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALHA' END FROM contas_receber
UNION ALL SELECT 'lancamentos_contabeis', COUNT(*), CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALHA' END FROM lancamentos_contabeis
UNION ALL SELECT 'fechamentos_contabeis', COUNT(*), CASE WHEN COUNT(*) >= 6 THEN 'OK' ELSE 'FALHA' END FROM fechamentos_contabeis;

\echo '=== VALIDAÇÃO: Partidas dobradas (débito = crédito) ==='

SELECT
    lc.numero,
    lc.data_lancamento,
    SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) AS total_debito,
    SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END) AS total_credito,
    CASE WHEN SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) =
              SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END)
         THEN 'OK' ELSE 'FALHA' END AS status
FROM lancamentos_contabeis lc
JOIN partidas_lancamento pl ON pl.lancamento_id = lc.id
WHERE lc.status = 'lançado'
GROUP BY lc.id, lc.numero, lc.data_lancamento
ORDER BY lc.numero;

\echo '=== VALIDAÇÃO: Lançamentos desbalanceados (deve retornar 0 linhas) ==='

SELECT lc.numero, lc.data_lancamento,
    SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) AS debito,
    SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END) AS credito
FROM lancamentos_contabeis lc
JOIN partidas_lancamento pl ON pl.lancamento_id = lc.id
GROUP BY lc.id, lc.numero, lc.data_lancamento
HAVING SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) <>
       SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END);

\echo '=== VALIDAÇÃO: Views KPI retornam dados ==='

SELECT 'vw_custo_hectare_cultura_safra' AS view_name, COUNT(*) AS linhas FROM vw_custo_hectare_cultura_safra
UNION ALL SELECT 'vw_custo_saca_cultura_safra', COUNT(*) FROM vw_custo_saca_cultura_safra
UNION ALL SELECT 'vw_resultado_gerencial_cultura', COUNT(*) FROM vw_resultado_gerencial_cultura
UNION ALL SELECT 'vw_resultado_talhao', COUNT(*) FROM vw_resultado_talhao
UNION ALL SELECT 'vw_estoque_insumos_atual', COUNT(*) FROM vw_estoque_insumos_atual
UNION ALL SELECT 'vw_estoque_producao_atual', COUNT(*) FROM vw_estoque_producao_atual
UNION ALL SELECT 'vw_uso_maquinas_safra', COUNT(*) FROM vw_uso_maquinas_safra
UNION ALL SELECT 'vw_horas_mao_obra_safra', COUNT(*) FROM vw_horas_mao_obra_safra
UNION ALL SELECT 'vw_fluxo_caixa_realizado', COUNT(*) FROM vw_fluxo_caixa_realizado
UNION ALL SELECT 'vw_balancete_contabil', COUNT(*) FROM vw_balancete_contabil
UNION ALL SELECT 'vw_dre_gerencial', COUNT(*) FROM vw_dre_gerencial
UNION ALL SELECT 'vw_margem_bruta_cultura', COUNT(*) FROM vw_margem_bruta_cultura
UNION ALL SELECT 'vw_produtividade_talhao', COUNT(*) FROM vw_produtividade_talhao
UNION ALL SELECT 'vw_comercializacao_cultura', COUNT(*) FROM vw_comercializacao_cultura;

\echo '=== VALIDAÇÃO: Resumo schema ==='

SELECT
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'agro' AND table_type = 'BASE TABLE') AS total_tabelas,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'agro') AS total_views;
