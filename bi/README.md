# BI Agro — Fazenda Mock (demonstração comercial)

Demonstração interativa mobile-first para portfólio. Consome dados fictícios via `/api` (proxy nginx → leitura readonly).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | HTML5, CSS3, vanilla JavaScript (ES modules) |
| Gráficos | Apache ECharts (CDN) |
| Dados | Views KPI do schema `agro` (somente leitura) |
| Servidor | nginx:alpine |

## Deploy

```bash
./scripts/deploy_bi_vps.sh
./scripts/validate_bi_vps.sh
```

Acesse: http://127.0.0.1:8088 (VPS) ou a porta em `.env.bi`.

## Seções da demo

1. **Visão geral da safra** — receita, custo, margem, culturas, área
2. **Resultado por cultura** — cards por soja, milho, sorgo, feijão, café
3. **Estoques** — produção armazenada e insumos
4. **Financeiro e DRE** — KPIs, fluxo de caixa, DRE por cultura
5. **Custos e operações** — talhões, máquinas, mão de obra
6. **Bloco comercial** — CTA para contato

## Views consumidas

`vw_dre_gerencial`, `vw_margem_bruta_cultura`, `vw_resultado_gerencial_cultura`, `vw_custo_hectare_cultura_safra`, `vw_comercializacao_cultura`, `vw_produtividade_talhao`, `vw_estoque_insumos_atual`, `vw_estoque_producao_atual`, `vw_fluxo_caixa_realizado`, `vw_resultado_talhao`, `vw_uso_maquinas_safra`, `vw_horas_mao_obra_safra`

## Segurança

- Frontend usa apenas `/api` (nunca porta direta do backend de dados)
- Role readonly com SELECT somente nas views KPI
- Aviso de dados fictícios visível na página
