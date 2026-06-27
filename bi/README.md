# Dashboard BI — HTML5/CSS/JavaScript

Dashboard analítico para a base mock `agro_fazenda_mock`.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | HTML5, CSS3, vanilla JavaScript (ES modules) |
| Gráficos | Apache ECharts (CDN) |
| API | PostgREST v12 (read-only) |
| Servidor | nginx:alpine |

## Deploy

Pré-requisito: banco provisionado com `./scripts/deploy_agro_fazenda_mock_vps.sh --yes`

```bash
./scripts/deploy_bi_vps.sh
```

Acesse: http://127.0.0.1:8088

## Desenvolvimento local

1. Suba PostgREST + nginx: `docker compose -f docker-compose.bi.yml up -d`
2. Abra http://127.0.0.1:8088

## Páginas

- Visão geral — KPIs e receita por cultura
- Produção — produtividade por talhão
- Custos — custo/hectare e margem bruta
- Estoques — insumos e produção
- Financeiro — fluxo de caixa
- Contabilidade — DRE gerencial

## Segurança

PostgREST usa a role `agro_mock_readonly` com SELECT apenas nas views do schema `agro`.
