-- =============================================================================
-- Views analíticas — DRE Gerencial Contábil (competência)
-- CREATE OR REPLACE · compatível com agro_mock_readonly
-- =============================================================================
SET search_path TO agro, public;

-- Base: valor gerencial por partida contábil
CREATE OR REPLACE VIEW vw_dre_partidas_base AS
SELECT
    EXTRACT(YEAR FROM lc.data_lancamento)::INTEGER AS ano,
    EXTRACT(MONTH FROM lc.data_lancamento)::INTEGER AS mes,
    TO_CHAR(lc.data_lancamento, 'Mon/YY') AS periodo_label,
    f.id AS fechamento_contabil_id,
    s.codigo AS safra_codigo,
    COALESCE(cult.nome, m.cultura_nome) AS cultura_nome,
    cc.id AS centro_custo_id,
    cc.nome AS centro_custo_nome,
    m.grupo_dre,
    m.subgrupo_dre,
    m.ordem_grupo,
    m.ordem_subgrupo,
    pc.id AS conta_contabil_id,
    pc.codigo AS conta_codigo,
    pc.nome AS conta_nome,
    pc.natureza,
    lc.id AS lancamento_id,
    lc.numero AS documento_origem,
    lc.origem_tipo,
    lc.data_lancamento,
    COALESCE(lc.historico_complementar, hp.descricao) AS historico,
    CASE m.tipo_linha
        WHEN 'receita' THEN CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE -pl.valor END
        WHEN 'deducao' THEN CASE WHEN pl.tipo = 'debito' THEN -pl.valor ELSE pl.valor END
        WHEN 'financeiro_receita' THEN CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE -pl.valor END
        WHEN 'financeiro_despesa' THEN CASE WHEN pl.tipo = 'debito' THEN -pl.valor ELSE pl.valor END
        ELSE CASE WHEN pl.tipo = 'debito' THEN -pl.valor ELSE pl.valor END
    END AS valor
FROM partidas_lancamento pl
JOIN lancamentos_contabeis lc ON lc.id = pl.lancamento_id
JOIN plano_contas pc ON pc.id = pl.conta_id
JOIN mapeamento_conta_dre m ON m.conta_codigo = pc.codigo
LEFT JOIN historicos_padrao hp ON hp.id = lc.historico_id
LEFT JOIN safras s ON s.id = lc.safra_id
LEFT JOIN culturas cult ON cult.id = lc.cultura_id
LEFT JOIN centros_custo cc ON cc.id = pl.centro_custo_id
LEFT JOIN fechamentos_contabeis f
    ON f.ano = EXTRACT(YEAR FROM lc.data_lancamento)::INTEGER
   AND f.mes = EXTRACT(MONTH FROM lc.data_lancamento)::INTEGER
WHERE lc.status = 'lançado'
  AND pc.analitica = TRUE;

-- 4.1 DRE analítica por grupo/conta/período
CREATE OR REPLACE VIEW vw_dre_gerencial_contabil AS
WITH agg AS (
    SELECT
        ano, mes, periodo_label, fechamento_contabil_id,
        safra_codigo, cultura_nome, centro_custo_id, centro_custo_nome,
        grupo_dre, subgrupo_dre, ordem_grupo, ordem_subgrupo,
        conta_contabil_id, conta_codigo, conta_nome, natureza,
        origem_tipo,
        SUM(valor) AS valor,
        COUNT(DISTINCT lancamento_id) AS qtd_lancamentos
    FROM vw_dre_partidas_base
    GROUP BY
        ano, mes, periodo_label, fechamento_contabil_id,
        safra_codigo, cultura_nome, centro_custo_id, centro_custo_nome,
        grupo_dre, subgrupo_dre, ordem_grupo, ordem_subgrupo,
        conta_contabil_id, conta_codigo, conta_nome, natureza, origem_tipo
),
rl AS (
    SELECT ano, mes, safra_codigo,
        COALESCE(cultura_nome, 'Consolidado') AS cultura_nome,
        SUM(CASE WHEN ordem_grupo <= 20 THEN valor ELSE 0 END) AS receita_liquida
    FROM agg
    GROUP BY ano, mes, safra_codigo, COALESCE(cultura_nome, 'Consolidado')
),
rb AS (
    SELECT ano, mes, safra_codigo,
        COALESCE(cultura_nome, 'Consolidado') AS cultura_nome,
        SUM(CASE WHEN ordem_grupo = 10 THEN valor ELSE 0 END) AS receita_bruta
    FROM agg
    GROUP BY ano, mes, safra_codigo, COALESCE(cultura_nome, 'Consolidado')
),
area_cult AS (
    SELECT
        s.codigo AS safra_codigo,
        c.nome AS cultura_nome,
        SUM(ps.area_planejada_ha) AS area_ha,
        SUM(COALESCE(pt.quantidade_sc, 0)) AS producao_sc
    FROM planejamento_safra ps
    JOIN safras s ON s.id = ps.safra_id
    JOIN culturas c ON c.id = ps.cultura_id
    LEFT JOIN producao_talhao pt ON pt.planejamento_safra_id = ps.id
    GROUP BY s.codigo, c.nome
)
SELECT
    a.ano,
    a.mes,
    a.periodo_label,
    a.fechamento_contabil_id,
    a.safra_codigo,
    a.cultura_nome,
    a.centro_custo_id,
    a.centro_custo_nome,
    a.grupo_dre,
    a.subgrupo_dre,
    a.ordem_grupo,
    a.ordem_subgrupo,
    a.conta_contabil_id,
    a.conta_codigo,
    a.conta_nome,
    a.natureza,
    ROUND(a.valor, 2) AS valor,
    ROUND(ABS(a.valor), 2) AS valor_abs,
    CASE WHEN a.valor >= 0 THEN '+' ELSE '-' END AS sinal_dre,
    ROUND(100.0 * a.valor / NULLIF(rl.receita_liquida, 0), 2) AS percentual_receita_liquida,
    ROUND(100.0 * a.valor / NULLIF(rb.receita_bruta, 0), 2) AS percentual_receita_bruta,
    ROUND(a.valor / NULLIF(ac.area_ha, 0), 2) AS valor_por_ha,
    ROUND(a.valor / NULLIF(ac.producao_sc, 0), 2) AS valor_por_sc,
    a.origem_tipo,
    a.qtd_lancamentos
FROM agg a
LEFT JOIN rl ON rl.ano = a.ano AND rl.mes = a.mes
    AND COALESCE(rl.safra_codigo, '') = COALESCE(a.safra_codigo, '')
    AND rl.cultura_nome = COALESCE(a.cultura_nome, 'Consolidado')
LEFT JOIN rb ON rb.ano = a.ano AND rb.mes = a.mes
    AND COALESCE(rb.safra_codigo, '') = COALESCE(a.safra_codigo, '')
    AND rb.cultura_nome = COALESCE(a.cultura_nome, 'Consolidado')
LEFT JOIN area_cult ac ON ac.safra_codigo = a.safra_codigo AND ac.cultura_nome = a.cultura_nome;

-- 4.2 DRE resumo (linhas sintéticas)
CREATE OR REPLACE VIEW vw_dre_gerencial_resumo AS
WITH det AS (
    SELECT * FROM vw_dre_gerencial_contabil
),
grupo AS (
    -- Consolidado: soma todas as culturas e lançamentos sem cultura
    SELECT
        ano, mes, safra_codigo,
        'Consolidado' AS cultura_nome,
        grupo_dre,
        ordem_grupo,
        SUM(valor) AS valor
    FROM det
    GROUP BY ano, mes, safra_codigo, grupo_dre, ordem_grupo
    UNION ALL
    -- Por cultura: receitas/custos vinculados + rateio zero de linhas sem cultura
    SELECT
        ano, mes, safra_codigo,
        cultura_nome,
        grupo_dre,
        ordem_grupo,
        SUM(valor) AS valor
    FROM det
    WHERE cultura_nome IS NOT NULL
    GROUP BY ano, mes, safra_codigo, cultura_nome, grupo_dre, ordem_grupo
),
pivot AS (
    SELECT
        ano, mes, safra_codigo, cultura_nome,
        SUM(CASE WHEN ordem_grupo = 10 THEN valor ELSE 0 END) AS receita_bruta,
        SUM(CASE WHEN ordem_grupo = 20 THEN valor ELSE 0 END) AS deducoes,
        SUM(CASE WHEN ordem_grupo = 40 THEN valor ELSE 0 END) AS custos_variaveis,
        SUM(CASE WHEN ordem_grupo = 60 THEN valor ELSE 0 END) AS custos_fixos,
        SUM(CASE WHEN ordem_grupo = 80 THEN valor ELSE 0 END) AS despesas_comerciais,
        SUM(CASE WHEN ordem_grupo = 90 THEN valor ELSE 0 END) AS despesas_admin,
        SUM(CASE WHEN ordem_grupo = 110 THEN valor ELSE 0 END) AS depreciacao,
        SUM(CASE WHEN ordem_grupo = 120 THEN valor ELSE 0 END) AS resultado_financeiro,
        SUM(CASE WHEN ordem_grupo = 140 THEN valor ELSE 0 END) AS tributos
    FROM grupo
    GROUP BY ano, mes, safra_codigo, cultura_nome
),
calc AS (
    SELECT
        *,
        receita_bruta + deducoes AS receita_liquida,
        receita_bruta + deducoes + custos_variaveis AS margem_bruta,
        receita_bruta + deducoes + custos_variaveis + custos_fixos AS resultado_atividade,
        receita_bruta + deducoes + custos_variaveis + custos_fixos + despesas_comerciais + despesas_admin AS ebitda,
        receita_bruta + deducoes + custos_variaveis + custos_fixos + despesas_comerciais + despesas_admin + depreciacao AS resultado_operacional,
        receita_bruta + deducoes + custos_variaveis + custos_fixos + despesas_comerciais + despesas_admin + depreciacao + resultado_financeiro AS resultado_antes_impostos,
        receita_bruta + deducoes + custos_variaveis + custos_fixos + despesas_comerciais + despesas_admin + depreciacao + resultado_financeiro + tributos AS resultado_liquido
    FROM pivot
),
linhas AS (
    SELECT ano, mes, safra_codigo, cultura_nome, 'Receita bruta' AS linha_dre, 10 AS ordem, receita_bruta AS valor FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Deduções', 20, deducoes FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Receita líquida', 30, receita_liquida FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Custos variáveis', 40, custos_variaveis FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Margem bruta', 50, margem_bruta FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Custos fixos', 60, custos_fixos FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Resultado atividade agrícola', 70, resultado_atividade FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Despesas comerciais', 80, despesas_comerciais FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Despesas administrativas', 90, despesas_admin FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'EBITDA', 100, ebitda FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Depreciação/amortização', 110, depreciacao FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Resultado operacional', 120, resultado_operacional FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Resultado financeiro', 130, resultado_financeiro FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Resultado antes impostos', 140, resultado_antes_impostos FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Tributos', 150, tributos FROM calc
    UNION ALL SELECT ano, mes, safra_codigo, cultura_nome, 'Resultado líquido gerencial', 160, resultado_liquido FROM calc
),
rl_ref AS (
    SELECT ano, mes, safra_codigo, cultura_nome,
        MAX(CASE WHEN ordem = 30 THEN valor END) AS receita_liquida_ref
    FROM linhas GROUP BY 1,2,3,4
)
SELECT
    l.ano,
    l.mes,
    l.safra_codigo,
    l.cultura_nome,
    l.linha_dre,
    l.ordem,
    ROUND(l.valor, 2) AS valor,
    ROUND(100.0 * l.valor / NULLIF(r.receita_liquida_ref, 0), 2) AS percentual_receita_liquida,
    CASE
        WHEN l.ordem IN (50, 100, 120, 160) THEN ROUND(100.0 * l.valor / NULLIF(r.receita_liquida_ref, 0), 2)
        ELSE NULL
    END AS margem_percentual,
    NULL::NUMERIC AS valor_por_ha,
    NULL::NUMERIC AS valor_por_sc
FROM linhas l
JOIN rl_ref r USING (ano, mes, safra_codigo, cultura_nome);

-- 4.3 Comparativo por cultura
CREATE OR REPLACE VIEW vw_dre_cultura_comparativo AS
WITH res AS (
    SELECT safra_codigo, cultura_nome, ordem, SUM(valor) AS valor
    FROM vw_dre_gerencial_resumo
    WHERE cultura_nome <> 'Consolidado'
    GROUP BY safra_codigo, cultura_nome, ordem
),
agg AS (
    SELECT
        safra_codigo,
        cultura_nome,
        MAX(CASE WHEN ordem = 10 THEN valor END) AS receita_bruta,
        MAX(CASE WHEN ordem = 30 THEN valor END) AS receita_liquida,
        MAX(CASE WHEN ordem = 40 THEN valor END) AS custos_variaveis,
        MAX(CASE WHEN ordem = 50 THEN valor END) AS margem_bruta,
        MAX(CASE WHEN ordem = 60 THEN valor END) AS custos_fixos,
        COALESCE(MAX(CASE WHEN ordem = 80 THEN valor END), 0)
            + COALESCE(MAX(CASE WHEN ordem = 90 THEN valor END), 0) AS despesas,
        MAX(CASE WHEN ordem = 100 THEN valor END) AS ebitda,
        MAX(CASE WHEN ordem = 110 THEN valor END) AS depreciacao,
        MAX(CASE WHEN ordem = 120 THEN valor END) AS resultado_operacional,
        MAX(CASE WHEN ordem = 130 THEN valor END) AS resultado_financeiro,
        MAX(CASE WHEN ordem = 160 THEN valor END) AS resultado_liquido
    FROM res
    GROUP BY safra_codigo, cultura_nome
),
area_cult AS (
    SELECT
        s.codigo AS safra_codigo,
        c.nome AS cultura_nome,
        SUM(ps.area_planejada_ha) AS area_ha,
        SUM(COALESCE(pt.quantidade_sc, 0)) AS producao_sc
    FROM planejamento_safra ps
    JOIN safras s ON s.id = ps.safra_id
    JOIN culturas c ON c.id = ps.cultura_id
    LEFT JOIN producao_talhao pt ON pt.planejamento_safra_id = ps.id
    GROUP BY s.codigo, c.nome
)
SELECT
    a.safra_codigo,
    a.cultura_nome,
    ROUND(a.receita_bruta, 2) AS receita_bruta,
    ROUND(a.receita_liquida, 2) AS receita_liquida,
    ROUND(a.custos_variaveis, 2) AS custos_variaveis,
    ROUND(a.margem_bruta, 2) AS margem_bruta,
    ROUND(a.custos_fixos, 2) AS custos_fixos,
    ROUND(a.despesas, 2) AS despesas,
    ROUND(a.ebitda, 2) AS ebitda,
    ROUND(a.depreciacao, 2) AS depreciacao,
    ROUND(a.resultado_operacional, 2) AS resultado_operacional,
    ROUND(a.resultado_financeiro, 2) AS resultado_financeiro,
    ROUND(a.resultado_liquido, 2) AS resultado_liquido,
    ROUND(100.0 * a.margem_bruta / NULLIF(a.receita_liquida, 0), 2) AS margem_bruta_pct,
    ROUND(100.0 * a.resultado_liquido / NULLIF(a.receita_liquida, 0), 2) AS margem_liquida_pct,
    ROUND(ac.area_ha, 2) AS area_ha,
    ROUND(ac.producao_sc, 0) AS producao_sc,
    ROUND(a.receita_liquida / NULLIF(ac.area_ha, 0), 2) AS receita_ha,
    ROUND((ABS(a.custos_variaveis) + ABS(a.custos_fixos)) / NULLIF(ac.area_ha, 0), 2) AS custo_ha,
    ROUND(a.resultado_liquido / NULLIF(ac.area_ha, 0), 2) AS resultado_ha,
    ROUND(a.receita_liquida / NULLIF(ac.producao_sc, 0), 2) AS receita_sc,
    ROUND((ABS(a.custos_variaveis) + ABS(a.custos_fixos)) / NULLIF(ac.producao_sc, 0), 2) AS custo_sc,
    ROUND(a.resultado_liquido / NULLIF(ac.producao_sc, 0), 2) AS resultado_sc
FROM agg a
LEFT JOIN area_cult ac USING (safra_codigo, cultura_nome);

-- 4.4 Drill-down conta → lançamento
CREATE OR REPLACE VIEW vw_dre_conta_drilldown AS
SELECT
    m.grupo_dre,
    m.subgrupo_dre,
    pc.codigo AS conta_codigo,
    pc.nome AS conta_nome,
    lc.id AS lancamento_id,
    lc.data_lancamento,
    COALESCE(lc.historico_complementar, hp.descricao) AS historico,
    lc.numero AS documento_origem,
    lc.origem_tipo,
    cc.nome AS centro_custo_nome,
    COALESCE(cult.nome, m.cultura_nome) AS cultura_nome,
    NULL::VARCHAR AS talhao_codigo,
    CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END AS valor_debito,
    CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END AS valor_credito,
    CASE m.tipo_linha
        WHEN 'receita' THEN CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE -pl.valor END
        WHEN 'deducao' THEN CASE WHEN pl.tipo = 'debito' THEN -pl.valor ELSE pl.valor END
        WHEN 'financeiro_receita' THEN CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE -pl.valor END
        WHEN 'financeiro_despesa' THEN CASE WHEN pl.tipo = 'debito' THEN -pl.valor ELSE pl.valor END
        ELSE CASE WHEN pl.tipo = 'debito' THEN -pl.valor ELSE pl.valor END
    END AS valor_dre,
    s.codigo AS safra_codigo,
    EXTRACT(MONTH FROM lc.data_lancamento)::INTEGER AS mes,
    EXTRACT(YEAR FROM lc.data_lancamento)::INTEGER AS ano
FROM partidas_lancamento pl
JOIN lancamentos_contabeis lc ON lc.id = pl.lancamento_id
JOIN plano_contas pc ON pc.id = pl.conta_id
JOIN mapeamento_conta_dre m ON m.conta_codigo = pc.codigo
LEFT JOIN historicos_padrao hp ON hp.id = lc.historico_id
LEFT JOIN safras s ON s.id = lc.safra_id
LEFT JOIN culturas cult ON cult.id = lc.cultura_id
LEFT JOIN centros_custo cc ON cc.id = pl.centro_custo_id
WHERE lc.status = 'lançado' AND pc.analitica = TRUE;

-- 4.5 Balancete gerencial
CREATE OR REPLACE VIEW vw_balancete_gerencial AS
WITH mov AS (
    SELECT
        EXTRACT(YEAR FROM lc.data_lancamento)::INTEGER AS ano,
        EXTRACT(MONTH FROM lc.data_lancamento)::INTEGER AS mes,
        TO_CHAR(lc.data_lancamento, 'Mon/YY') AS periodo_label,
        pc.codigo AS conta_codigo,
        pc.nome AS conta_nome,
        pc.tipo,
        pc.natureza,
        cc.nome AS centro_custo_nome,
        SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) AS debitos,
        SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END) AS creditos
    FROM partidas_lancamento pl
    JOIN lancamentos_contabeis lc ON lc.id = pl.lancamento_id
    JOIN plano_contas pc ON pc.id = pl.conta_id
    LEFT JOIN centros_custo cc ON cc.id = pl.centro_custo_id
    WHERE lc.status = 'lançado' AND pc.analitica = TRUE
    GROUP BY 1,2,3,4,5,6,7,8
)
SELECT
    m.ano,
    m.mes,
    m.periodo_label,
    m.conta_codigo,
    m.conta_nome,
    m.tipo,
    m.natureza,
    0::NUMERIC AS saldo_inicial,
    ROUND(m.debitos, 2) AS debitos,
    ROUND(m.creditos, 2) AS creditos,
    ROUND(
        CASE m.natureza
            WHEN 'devedora' THEN m.debitos - m.creditos
            ELSE m.creditos - m.debitos
        END, 2
    ) AS saldo_final,
    CASE m.tipo
        WHEN 'ativo' THEN 'Ativo'
        WHEN 'passivo' THEN 'Passivo'
        WHEN 'patrimonio' THEN 'Patrimônio'
        WHEN 'receita' THEN 'Receita'
        WHEN 'despesa' THEN 'Despesa'
        ELSE m.tipo
    END AS grupo_contabil,
    COALESCE(map.grupo_dre, 'Fora da DRE') AS grupo_dre,
    m.centro_custo_nome
FROM mov m
LEFT JOIN mapeamento_conta_dre map ON map.conta_codigo = m.conta_codigo;

-- 4.6 KPIs contábeis executivos
CREATE OR REPLACE VIEW vw_kpis_contabeis AS
WITH res AS (
    SELECT
        safra_codigo,
        ano,
        mes,
        MAX(CASE WHEN ordem = 10 THEN valor END) AS receita_bruta,
        MAX(CASE WHEN ordem = 30 THEN valor END) AS receita_liquida,
        MAX(CASE WHEN ordem = 50 THEN valor END) AS margem_bruta,
        MAX(CASE WHEN ordem = 100 THEN valor END) AS ebitda,
        MAX(CASE WHEN ordem = 120 THEN valor END) AS resultado_operacional,
        MAX(CASE WHEN ordem = 160 THEN valor END) AS resultado_liquido,
        MAX(CASE WHEN ordem = 40 THEN valor END) AS custos_variaveis,
        MAX(CASE WHEN ordem = 60 THEN valor END) AS custos_fixos,
        MAX(CASE WHEN ordem = 80 THEN valor END) AS despesas_comerciais,
        MAX(CASE WHEN ordem = 90 THEN valor END) AS despesas_admin
    FROM vw_dre_gerencial_resumo
    WHERE cultura_nome = 'Consolidado'
    GROUP BY safra_codigo, ano, mes
),
area AS (
    SELECT s.codigo AS safra_codigo, SUM(ps.area_planejada_ha) AS area_ha,
        SUM(COALESCE(pt.quantidade_sc, 0)) AS producao_sc
    FROM planejamento_safra ps
    JOIN safras s ON s.id = ps.safra_id
    LEFT JOIN producao_talhao pt ON pt.planejamento_safra_id = ps.id
    GROUP BY s.codigo
)
SELECT
    r.safra_codigo,
    r.ano,
    r.mes,
    ROUND(r.receita_bruta, 2) AS receita_bruta,
    ROUND(r.receita_liquida, 2) AS receita_liquida,
    ROUND(r.margem_bruta, 2) AS margem_bruta,
    ROUND(r.ebitda, 2) AS ebitda,
    ROUND(r.resultado_operacional, 2) AS resultado_operacional,
    ROUND(r.resultado_liquido, 2) AS resultado_liquido,
    ROUND(100.0 * r.margem_bruta / NULLIF(r.receita_liquida, 0), 2) AS margem_bruta_pct,
    ROUND(100.0 * r.ebitda / NULLIF(r.receita_liquida, 0), 2) AS margem_ebitda_pct,
    ROUND(100.0 * r.resultado_liquido / NULLIF(r.receita_liquida, 0), 2) AS margem_liquida_pct,
    ROUND(ABS(r.custos_variaveis) + ABS(r.custos_fixos), 2) AS custo_total,
    ROUND(ABS(r.despesas_comerciais) + ABS(r.despesas_admin), 2) AS despesas_total,
    ROUND(r.resultado_liquido / NULLIF(a.area_ha, 0), 2) AS resultado_por_ha,
    ROUND(r.resultado_liquido / NULLIF(a.producao_sc, 0), 2) AS resultado_por_sc
FROM res r
LEFT JOIN area a ON a.safra_codigo = r.safra_codigo;

-- Permissões readonly (views novas)
DO $$
DECLARE obj record;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agro_mock_readonly') THEN
        FOR obj IN
            SELECT table_name FROM information_schema.views
            WHERE table_schema = 'agro'
              AND table_name IN (
                'vw_dre_partidas_base',
                'vw_dre_gerencial_contabil',
                'vw_dre_gerencial_resumo',
                'vw_dre_cultura_comparativo',
                'vw_dre_conta_drilldown',
                'vw_balancete_gerencial',
                'vw_kpis_contabeis'
              )
        LOOP
            EXECUTE format('GRANT SELECT ON agro.%I TO agro_mock_readonly', obj.table_name);
        END LOOP;
    END IF;
END $$;
