# Banco agro_fazenda_mock

Base mock agrícola para BI — schema `agro` no banco PostgreSQL `agro_fazenda_mock`.

## Ordem de execução

| Arquivo | Descrição |
|---------|-----------|
| `00_drop_create_schema.sql` | Drop/create schema `agro` (destrutivo) |
| `01_schema.sql` | DDL — 69 tabelas |
| `02_seed_master_data.sql` | Cadastros mestres |
| `03_seed_operational_data.sql` | Dados operacionais e contábeis |
| `04_views_kpis.sql` | 14 views analíticas + role read-only |
| `05_validation_queries.sql` | Queries de integridade |

O arquivo `agro_fazenda_mock_full.sql` é gerado automaticamente:

```bash
./scripts/build_agro_fazenda_mock_full.sh
```

## Execução manual

```bash
psql -U admin -d agro_fazenda_mock -v ON_ERROR_STOP=1 -f database/agro_fazenda_mock/agro_fazenda_mock_full.sql
```

## Domínios modelados

- Estrutura agrícola (fazendas, talhões, safras, culturas)
- Produção (planejamento, operações, plantio, colheita)
- Insumos e estoques
- Máquinas e equipamentos
- Recursos humanos
- Estoques de produção
- Comercialização
- Financeiro
- Custos
- Contabilidade (partidas dobradas)

## Views KPI

- `vw_custo_hectare_cultura_safra`
- `vw_custo_saca_cultura_safra`
- `vw_resultado_gerencial_cultura`
- `vw_resultado_talhao`
- `vw_estoque_insumos_atual`
- `vw_estoque_producao_atual`
- `vw_uso_maquinas_safra`
- `vw_horas_mao_obra_safra`
- `vw_fluxo_caixa_realizado`
- `vw_balancete_contabil`
- `vw_dre_gerencial`
- `vw_margem_bruta_cultura`
- `vw_produtividade_talhao`
- `vw_comercializacao_cultura`

## Dados fictícios

Fazenda **Boa Esperança Agro Ltda.** — Rio Verde/GO. Culturas: soja, milho, sorgo, feijão, café.
