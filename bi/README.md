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

## Seções da demo (navegação por abas)

Layout tipo aplicativo — uma tela por vez, sem scroll longo de landing.

1. **Visão Geral** — KPIs compactos + gráfico receita/resultado
2. **Culturas** — cards por cultura com status
3. **Estoques** — gráfico horizontal + insumos
4. **Financeiro** — DRE + fluxo de caixa
5. **Operações** — talhões, máquinas, mão de obra
6. **Sobre** — texto comercial e CTA

URLs com hash: `#visao-geral`, `#culturas`, `#estoques`, etc.

## Views consumidas

`vw_dre_gerencial`, `vw_margem_bruta_cultura`, `vw_resultado_gerencial_cultura`, `vw_custo_hectare_cultura_safra`, `vw_comercializacao_cultura`, `vw_produtividade_talhao`, `vw_estoque_insumos_atual`, `vw_estoque_producao_atual`, `vw_fluxo_caixa_realizado`, `vw_resultado_talhao`, `vw_uso_maquinas_safra`, `vw_horas_mao_obra_safra`

## Segurança

- Frontend usa apenas `/api` (nunca porta direta do backend de dados)
- Role readonly com SELECT somente nas views KPI
- Aviso de dados fictícios visível na página
