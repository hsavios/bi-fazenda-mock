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
| Rede Docker PostgreSQL | `heliosavio_net` |

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
| Commit Git | `bc4d0d5` |

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

## BI / API readonly (2026-07-02)

| Item | Resultado |
|------|-----------|
| Status | **Ativo e validado** |
| Dashboard | http://127.0.0.1:8088 |
| PostgREST | http://127.0.0.1:3010 |
| API via nginx | http://127.0.0.1:8088/api/ |
| Containers | `fazenda-mock-postgrest`, `fazenda-mock-bi-nginx` |
| Bind | somente `127.0.0.1` |
| Porta 3000 | **não usada** (`gesto-app-frontend-1` intacto) |
| Conexão PostgREST → PG | rede `heliosavio_net` → `postgres:5432` |
| Views KPI via API | 14/14 acessíveis |
| Readonly SELECT em views | OK |
| Readonly INSERT em tabelas | bloqueado |

### Comando de deploy BI usado

```bash
ss -tlnp | grep -E '3000|3010|8088|8090' || true
BI_PGRST_PORT=3010 BI_NGINX_PORT=8088 ./scripts/deploy_bi_vps.sh
./scripts/validate_bi_vps.sh
```

### Validação manual confirmada

```bash
curl -i http://127.0.0.1:8088/                                          # HTTP 200
curl -s "http://127.0.0.1:8088/api/vw_dre_gerencial?limit=1" | head     # JSON OK
```

### Túnel SSH (acesso do PC local)

```bash
ssh -L 8088:127.0.0.1:8088 helio@srv1535465
# abrir http://127.0.0.1:8088 no navegador
```

## Demo pública (demo-agro.heliosavio.com)

| Item | Valor |
|------|-------|
| URL pública | https://demo-agro.heliosavio.com |
| Tunnel | `demo-agro.heliosavio.com` → `http://127.0.0.1:8088` |
| Landing | https://heliosavio.com — seção “Demonstrações” |
| PostgREST público | **Não** — somente `/api/` via nginx |
| Dados | Fictícios — portfólio |

### Publicar / validar

Ver `docs/publicacao-demo-agro-bi.md` e `docs/checklist-seguranca-demo-publica.md`.

```bash
BI_PGRST_PORT=3010 BI_NGINX_PORT=8088 ./scripts/deploy_bi_vps.sh
./scripts/validate_bi_vps.sh
./scripts/validate_demo_public.sh
```

### Rollback publicação

Remover rota `demo-agro.heliosavio.com` do `/etc/cloudflared/config.yml` e `sudo systemctl restart cloudflared`.

## Logs

| Tipo | Arquivo |
|------|---------|
| Banco | `logs/validacao_agro_fazenda_mock_*.log` |
| BI | `logs/validacao_bi_20260702_084944.log` |

## Comandos úteis

```bash
./scripts/validate_agro_fazenda_mock.sh
./scripts/validate_bi_vps.sh
./scripts/connect_agro_fazenda_mock.sh
docker compose -f docker-compose.bi.yml -f docker-compose.bi.override.yml down   # parar BI
```
