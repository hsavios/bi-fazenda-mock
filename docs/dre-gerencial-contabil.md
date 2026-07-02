# DRE Gerencial Contábil — BI Agro (demo)

## Diferença DRE × Caixa

| Conceito | Regime | Pergunta | Fonte na demo |
|----------|--------|----------|---------------|
| **DRE Gerencial** | Competência | Qual resultado econômico a operação gerou? | Lançamentos contábeis (`lancamentos_contabeis` / `partidas_lancamento`) |
| **Fluxo de Caixa** | Caixa | Quando o dinheiro entrou ou saiu? | `vw_fluxo_caixa_realizado` |

Não misturar os dois na mesma leitura gerencial.

## Estrutura da DRE

Ordem gerencial implementada em `vw_dre_gerencial_resumo`:

1. Receita Operacional Bruta  
2. (−) Deduções da Receita  
3. (=) Receita Operacional Líquida  
4. (−) Custos Variáveis / CPV Agrícola  
5. (=) Margem Bruta  
6. (−) Custos Fixos Agrícolas  
7. (=) Resultado Operacional da Atividade Agrícola  
8. (−) Despesas Comerciais  
9. (−) Despesas Administrativas  
10. (=) EBITDA  
11. (−) Depreciação e Amortização  
12. (=) Resultado Operacional  
13. (+/−) Resultado Financeiro  
14. (=) Resultado antes de Impostos  
15. (−) Tributos sobre Resultado  
16. (=) Resultado Líquido Gerencial  

## Views criadas

| View | Objetivo |
|------|----------|
| `vw_dre_partidas_base` | Base analítica por partida |
| `vw_dre_gerencial_contabil` | DRE detalhada por grupo/conta/período |
| `vw_dre_gerencial_resumo` | Linhas sintéticas da DRE |
| `vw_dre_cultura_comparativo` | Comparativo por cultura |
| `vw_dre_conta_drilldown` | Drill-down conta → lançamento |
| `vw_balancete_gerencial` | Balancete por conta e período |
| `vw_kpis_contabeis` | KPIs executivos contábeis |

## Origem dos dados

- **Plano de contas:** `agro.plano_contas`  
- **Lançamentos:** `agro.lancamentos_contabeis` + `agro.partidas_lancamento`  
- **Mapeamento DRE:** `agro.mapeamento_conta_dre`  
- **Centros de custo:** `agro.centros_custo`  
- **Safra / cultura:** vínculo em lançamentos e contas de receita  

A view legada `vw_dre_gerencial` (tabela `dre_gerencial`) permanece para compatibilidade com abas operacionais; a aba **DRE Gerencial** usa exclusivamente as views contábeis novas.

## Seed complementar

Arquivo: `database/agro_fazenda_mock/06_seed_contabilidade_dre_gerencial.sql`

- Idempotente (`ON CONFLICT`, `WHERE NOT EXISTS` em lançamentos `DRE-LC-*`)  
- Partidas dobradas balanceadas  
- Novas contas analíticas (deduções, CPV detalhado, despesas, financeiro, tributos)  
- ~17 lançamentos complementares distribuídos na safra 2024/25  

**Dados fictícios gerenciais** — não representam operação real.

## Regras de sinal

- Receitas: positivas na DRE  
- Deduções, custos, despesas, depreciação, tributos: negativos  
- Resultado financeiro: sinal conforme natureza (juros ativos +, passivos −)  

## Validações

```bash
./scripts/validate_dre_contabil.sh
./scripts/validate_bi_vps.sh
```

- Lançamentos desbalanceados = 0  
- Contas analíticas de receita/despesa mapeadas  
- `agro_mock_readonly`: SELECT nas views, INSERT bloqueado  

## Limitações

- Rateio de custos sem cultura para linhas por cultura ainda parcial (custos corporativos ficam no consolidado).  
- Balancete gerencial calculado a partir de movimentos do período (saldo inicial simplificado).  
- Sem Balanço Patrimonial, DFC indireta, razão completo ou livro diário nesta sprint.

## Próximos passos

- Balanço Patrimonial demonstrativo  
- DFC indireta a partir do resultado + variações no BP  
- Razão contábil e livro diário com paginação  
- Rateio automático de custos fixos por hectare/cultura  
