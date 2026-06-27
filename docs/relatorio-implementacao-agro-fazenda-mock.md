# Relatório de implementação — agro_fazenda_mock

**Data:** 2025-06-27  
**Projeto:** fazenda-mock-bi  
**Ambiente alvo:** VPS srv1535465, container `postgres` (postgres:16)

## Resumo executivo

Entrega completa de base mock agrícola em PostgreSQL com 69 tabelas, seeds coerentes, 14 views KPI, scripts de deploy/validação e dashboard BI em HTML5/CSS/JavaScript.

## Artefatos entregues

| Componente | Localização | Status |
|------------|-------------|--------|
| Schema DDL | `database/agro_fazenda_mock/01_schema.sql` | OK |
| Seed mestre | `database/agro_fazenda_mock/02_seed_master_data.sql` | OK |
| Seed operacional | `database/agro_fazenda_mock/03_seed_operational_data.sql` | OK |
| Views KPI | `database/agro_fazenda_mock/04_views_kpis.sql` | OK |
| Validação SQL | `database/agro_fazenda_mock/05_validation_queries.sql` | OK |
| SQL consolidado | `database/agro_fazenda_mock/agro_fazenda_mock_full.sql` | Gerado |
| Deploy VPS | `scripts/deploy_agro_fazenda_mock_vps.sh` | OK |
| Validação shell | `scripts/validate_agro_fazenda_mock.sh` | OK |
| Build SQL | `scripts/build_agro_fazenda_mock_full.sh` | OK |
| Dashboard BI | `bi/` + `docker-compose.bi.yml` | OK |

## Modelagem

### Tabelas por domínio (69 total)

| Domínio | Qtd |
|---------|-----|
| Estrutura agrícola | 8 |
| Insumos | 7 |
| Máquinas | 6 |
| RH | 5 |
| Produção | 12 |
| Estoque produção | 6 |
| Comercialização | 5 |
| Financeiro | 9 |
| Custos | 6 |
| Contabilidade | 7 |

### Integridade

- Primary keys em todas as tabelas
- Foreign keys com rastreabilidade fazenda → talhão → safra → cultura
- CHECK constraints em status e tipos
- Índices em FKs e campos de filtro
- NUMERIC(18,2/4) para valores monetários e quantidades

## Volumes de seed

| Entidade | Quantidade |
|----------|------------|
| Fazendas | 1 |
| Unidades produtivas | 2 |
| Talhões | 20 |
| Culturas | 5 |
| Variedades | 11 |
| Safras | 3 |
| Insumos | 35 |
| Equipamentos | 12 |
| Colaboradores | 18 |
| Fornecedores | 12 |
| Clientes | 10 |
| Contratos venda | 6 |
| Lançamentos contábeis | 8 |
| Fechamentos contábeis | 8 meses |
| Views KPI | 14 |

## Validações

- Partidas dobradas: todos os 8 lançamentos balanceados (débito = crédito)
- Contagens mínimas: OK em todos os checks
- Views KPI: 14 views retornando dados
- Teste local: SQL executado com sucesso em postgres:16

## Proteções de deploy

- Guard clause `current_database() = 'agro_fazenda_mock'`
- Exige `--yes` para operação destrutiva
- Blocklist do container `gesto-app-postgres-1`
- Senha nunca impressa no log
- Credenciais em `~/.secrets/agro_fazenda_mock.env` (600)

## Stack BI (fase 2)

- **API:** PostgREST (read-only via role `agro_mock_readonly`)
- **Frontend:** HTML5 + CSS + vanilla JavaScript + Apache ECharts
- **Servidor:** nginx:alpine na porta 8088
- **Deploy:** `scripts/deploy_bi_vps.sh`

## Próximos passos sugeridos

1. Executar deploy na VPS: `./scripts/deploy_agro_fazenda_mock_vps.sh --yes`
2. Subir dashboard BI: `./scripts/deploy_bi_vps.sh`
3. Conectar ferramentas externas (Metabase, Grafana) usando credenciais do arquivo de secrets
