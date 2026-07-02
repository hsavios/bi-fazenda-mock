# Operação e manutenção — agro_fazenda_mock

Procedimentos para validar, recarregar, fazer backup e evoluir a base mock agrícola com segurança.

---

## Pré-requisitos

- Container Docker `postgres` rodando (não usar `gesto-app-postgres-1`)
- Credenciais em `~/.secrets/agro_fazenda_mock.env`
- Scripts com permissão de execução: `chmod +x scripts/*.sh`

---

## Validar a base

```bash
./scripts/validate_agro_fazenda_mock.sh
```

O script:

1. Carrega credenciais de `~/.secrets/agro_fazenda_mock.env`
2. Executa `database/agro_fazenda_mock/05_validation_queries.sql`
3. Conta tabelas e views no schema `agro`
4. Verifica lançamentos contábeis desbalanceados
5. Salva log em `logs/validacao_agro_fazenda_mock_*.log`
6. Retorna código de erro se houver falhas

### Forçar contagens esperadas

```bash
EXPECTED_TABLES=69 EXPECTED_VIEWS=14 ./scripts/validate_agro_fazenda_mock.sh
```

### Validação manual rápida

```bash
source ~/.secrets/agro_fazenda_mock.env

docker exec -i -e PGPASSWORD="$AGRO_PASS" postgres \
  psql -U "$AGRO_USER" -d "$AGRO_DB" -P pager=off -c "
SELECT current_database(), current_user,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema='agro' AND table_type='BASE TABLE') AS tabelas,
  (SELECT COUNT(*) FROM information_schema.views
   WHERE table_schema='agro') AS views;
"
```

---

## Recarregar a base (deploy completo)

**Atenção:** o deploy executa `DROP SCHEMA IF EXISTS agro CASCADE`, apagando todos os dados do schema.

```bash
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
```

Opções:

| Opção | Efeito |
|-------|--------|
| `--yes` | Obrigatório — confirma operação destrutiva |
| `--reset-password` | Gera nova senha para `agro_mock_user` |
| `--skip-validation` | Pula validação ao final |

---

## Conectar ao banco

```bash
./scripts/connect_agro_fazenda_mock.sh
```

Dentro do `psql`:

```sql
SET search_path TO agro, public;
\dt
SELECT * FROM fazendas LIMIT 5;
```

---

## Fazer backup

```bash
./scripts/backup_agro_fazenda_mock.sh
```

Gera em `backups/`:

- `agro_fazenda_mock_YYYYMMDD_HHMMSS.dump` (formato custom, para `pg_restore`)
- `agro_fazenda_mock_YYYYMMDD_HHMMSS.sql` (formato plain)

O backup usa o usuário admin do container (`POSTGRES_USER`) para garantir permissões completas no schema `agro`.

Somente dump custom:

```bash
./scripts/backup_agro_fazenda_mock.sh --format dump
```

---

## Restaurar backup

### A partir de `.dump` (custom)

```bash
source ~/.secrets/agro_fazenda_mock.env

cat backups/agro_fazenda_mock_YYYYMMDD_HHMMSS.dump | \
  docker exec -i -e PGPASSWORD="$AGRO_PASS" postgres \
  pg_restore -U "$AGRO_USER" -d "$AGRO_DB" --clean --if-exists --no-owner
```

### A partir de `.sql` (plain)

```bash
source ~/.secrets/agro_fazenda_mock.env

cat backups/agro_fazenda_mock_YYYYMMDD_HHMMSS.sql | \
  docker exec -i -e PGPASSWORD="$AGRO_PASS" postgres \
  psql -U "$AGRO_USER" -d "$AGRO_DB" -v ON_ERROR_STOP=1
```

---

## Conferir tabelas e views

```bash
source ~/.secrets/agro_fazenda_mock.env

docker exec -i -e PGPASSWORD="$AGRO_PASS" postgres \
  psql -U "$AGRO_USER" -d "$AGRO_DB" -P pager=off -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema='agro' AND table_type='BASE TABLE'
ORDER BY table_name;
"

docker exec -i -e PGPASSWORD="$AGRO_PASS" postgres \
  psql -U "$AGRO_USER" -d "$AGRO_DB" -P pager=off -c "
SELECT table_name FROM information_schema.views
WHERE table_schema='agro' ORDER BY table_name;
"
```

---

## Conferir partidas contábeis

```bash
source ~/.secrets/agro_fazenda_mock.env

docker exec -i -e PGPASSWORD="$AGRO_PASS" postgres \
  psql -U "$AGRO_USER" -d "$AGRO_DB" -P pager=off -c "
SELECT 'lancamentos_desbalanceados' AS validacao, COUNT(*) AS quantidade
FROM (
  SELECT lc.id
  FROM agro.lancamentos_contabeis lc
  JOIN agro.partidas_lancamento pl ON pl.lancamento_id = lc.id
  GROUP BY lc.id
  HAVING SUM(CASE WHEN pl.tipo = 'debito' THEN pl.valor ELSE 0 END) <>
         SUM(CASE WHEN pl.tipo = 'credito' THEN pl.valor ELSE 0 END)
) x;
"
```

Resultado esperado: `quantidade = 0`.

---

## Adicionar novos dados mockados

1. Edite os arquivos modulares em `database/agro_fazenda_mock/`:
   - Cadastros: `02_seed_master_data.sql`
   - Operacionais: `03_seed_operational_data.sql`
2. Regenere o consolidado:

   ```bash
   ./scripts/build_agro_fazenda_mock_full.sh
   ```

3. Para aplicar sem alterar schema, execute apenas os INSERTs novos via `psql`.
4. Para recarga completa: `./scripts/deploy_agro_fazenda_mock_vps.sh --yes`

**Dica:** mantenha FKs e datas coerentes com safras e talhões existentes.

---

## Evoluir schema com segurança

1. **Nunca** altere `agro_fazenda_mock_full.sql` manualmente — ele é gerado.
2. Faça alterações em `01_schema.sql` (ou crie `06_migration_YYYYMMDD_descricao.sql`).
3. Para bases já implantadas, prefira scripts incrementais:

   ```sql
   -- 06_migration_20260702_add_campo.sql
   ALTER TABLE agro.talhoes ADD COLUMN IF NOT EXISTS irrigado BOOLEAN DEFAULT FALSE;
   ```

4. Atualize seeds e views conforme necessário.
5. Regenere o full SQL e valide:

   ```bash
   ./scripts/build_agro_fazenda_mock_full.sh
   ./scripts/deploy_agro_fazenda_mock_vps.sh --yes
   ./scripts/validate_agro_fazenda_mock.sh
   ```

6. Faça backup antes de deploys destrutivos:

   ```bash
   ./scripts/backup_agro_fazenda_mock.sh
   ```

---

## Evitar o PostgreSQL errado

| Container | Uso |
|-----------|-----|
| `postgres` | **Usar** — base agro_fazenda_mock |
| `gesto-app-postgres-1` | **Não usar** — projeto gesto-app/riscos-app-online |

Os scripts abortam se detectarem tentativa de usar `gesto-app-postgres-1`.

---

## Logs

| Tipo | Local |
|------|-------|
| Deploy | `logs/agro_fazenda_mock_deploy_*.log` |
| Validação | `logs/validacao_agro_fazenda_mock_*.log` |

Logs não são versionados (`.gitignore`).
