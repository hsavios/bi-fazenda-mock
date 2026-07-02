# Deploy validado — agro_fazenda_mock

Registro do deploy manual realizado na VPS `srv1535465`.

## Ambiente

| Item | Valor |
|------|-------|
| Host | `srv1535465` |
| Usuário Linux | `helio` |
| Pasta do projeto | `/home/helio/projects/agro-fazenda-mock` |
| Container PostgreSQL | `postgres` (imagem `postgres:16`) |
| Porta | `127.0.0.1:5432` |

## Banco provisionado

| Item | Valor |
|------|-------|
| Banco | `agro_fazenda_mock` |
| Usuário | `agro_mock_user` |
| Schema | `agro` |
| Credenciais | `~/.secrets/agro_fazenda_mock.env` (chmod 600) |

## Validação (2026-07-02)

| Métrica | Resultado |
|---------|-----------|
| Tabelas | 60 |
| Views | 7 |
| Lançamentos desbalanceados | 0 |

### Views implantadas

- `v_area_safra_cultura`
- `v_balancete_periodo`
- `v_custo_talhao`
- `v_estoque_insumos`
- `v_estoque_produtos`
- `v_horas_equipamento_safra`
- `v_resultado_safra_cultura`

### Contabilidade

Tabelas: `agro.lancamento_contabil`, `agro.lancamento_contabil_item`

## Log de validação

```
logs/validacao_agro_fazenda_mock_20260702_073225.log
```

## Comandos usados no deploy manual

```bash
source ~/.secrets/agro_fazenda_mock.env

cat database/agro_fazenda_mock/agro_fazenda_mock_full.sql | docker exec -i -e PGPASSWORD="$AGRO_PASS" postgres \
  psql -U "$AGRO_USER" -d "$AGRO_DB" -v ON_ERROR_STOP=1
```

## Próximo deploy automatizado

```bash
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
./scripts/validate_agro_fazenda_mock.sh
```

> **Nota:** O repositório versionado pode evoluir (ex.: 69 tabelas e 14 views). Após sincronizar SQLs e rodar novo deploy, atualize este arquivo com as contagens validadas.
