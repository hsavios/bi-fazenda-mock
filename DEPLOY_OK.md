# Deploy validado — agro_fazenda_mock

Registro dos deploys na VPS `srv1535465`.

## Ambiente

| Item | Valor |
|------|-------|
| Host | `srv1535465` |
| Usuário Linux | `helio` |
| Pasta do projeto | `/home/helio/projects/agro-fazenda-mock` |
| Container PostgreSQL | `postgres` (imagem `postgres:16`) |
| Porta PostgreSQL | `127.0.0.1:5432` |

## Banco provisionado

| Item | Valor |
|------|-------|
| Banco | `agro_fazenda_mock` |
| Usuário app | `agro_mock_user` |
| Role readonly BI | `agro_mock_readonly` |
| Schema | `agro` |
| Credenciais | `~/.secrets/agro_fazenda_mock.env` (chmod 600) |

## Validação do banco (2026-07-02)

| Métrica | Resultado |
|---------|-----------|
| Tabelas | 69 |
| Views KPI | 14 |
| Lançamentos desbalanceados | 0 |

### Views KPI

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

## BI / API readonly

> Preencher após `./scripts/deploy_bi_vps.sh` na VPS.

| Item | Valor esperado |
|------|----------------|
| Dashboard | http://127.0.0.1:8088 |
| PostgREST | http://127.0.0.1:3010 |
| API via nginx | http://127.0.0.1:8088/api/ |
| Containers | `fazenda-mock-postgrest`, `fazenda-mock-bi-nginx` |
| Bind | somente `127.0.0.1` (não expõe em `0.0.0.0`) |
| Porta 3000 | **não usada** (evita conflito com `gesto-app-frontend-1`) |

### Comando de deploy BI (VPS)

```bash
ss -tlnp | grep -E '3000|3010|8088|8090' || true
BI_PGRST_PORT=3010 BI_NGINX_PORT=8088 ./scripts/deploy_bi_vps.sh
./scripts/validate_bi_vps.sh
```

Se `8088` estiver ocupada:

```bash
BI_PGRST_PORT=3010 BI_NGINX_PORT=8090 ./scripts/deploy_bi_vps.sh
```

## Logs

| Tipo | Padrão |
|------|--------|
| Banco | `logs/validacao_agro_fazenda_mock_*.log` |
| BI | `logs/validacao_bi_*.log` |
| Deploy BI | saída de `deploy_bi_vps.sh` |

## Comandos úteis

```bash
./scripts/validate_agro_fazenda_mock.sh
./scripts/validate_bi_vps.sh
./scripts/connect_agro_fazenda_mock.sh
docker compose -f docker-compose.bi.yml down   # parar BI
```
