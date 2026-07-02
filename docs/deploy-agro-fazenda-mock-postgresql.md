# Deploy do banco agro_fazenda_mock na VPS

Guia para provisionar a base mock agrícola no container PostgreSQL genérico da VPS `srv1535465`.

## Ambiente da VPS

| Item | Valor |
|------|-------|
| Host | `srv1535465` |
| Usuário Linux | `helio` |
| Pasta do projeto | `/home/helio/projects/agro-fazenda-mock` |
| Container | `postgres` (`postgres:16`) |
| Porta | `127.0.0.1:5432` |
| Admin do container | `app_user` |

## Container correto

```bash
PG_CONTAINER=postgres   # usar
```

**Não usar:**

```bash
gesto-app-postgres-1   # pertence ao projeto gesto-app / riscos-app-online
```

## Banco e credenciais

| Item | Valor |
|------|-------|
| Banco | `agro_fazenda_mock` |
| Usuário app | `agro_mock_user` |
| Schema | `agro` |
| Credenciais | `~/.secrets/agro_fazenda_mock.env` (chmod 600) |

Variáveis no arquivo de secrets:

```
AGRO_DB=agro_fazenda_mock
AGRO_USER=agro_mock_user
AGRO_PASS=<gerada automaticamente>
AGRO_SCHEMA=agro
```

## Deploy automatizado

```bash
cd /home/helio/projects/agro-fazenda-mock
chmod +x scripts/*.sh
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
```

### Opções

| Opção | Descrição |
|-------|-----------|
| `--yes` | Obrigatório — confirma DROP SCHEMA agro CASCADE |
| `--reset-password` | Gera nova senha para `agro_mock_user` |
| `--skip-validation` | Pula validações ao final |
| `--help` | Ajuda |

## O que o script de deploy faz

1. Valida Docker e container `postgres`
2. Bloqueia uso de `gesto-app-postgres-1`
3. Lê `POSTGRES_USER` do container
4. Cria banco `agro_fazenda_mock` (se não existir)
5. Cria/atualiza usuário `agro_mock_user`
6. Gera ou reutiliza senha em `~/.secrets/agro_fazenda_mock.env`
7. Regenera e executa `database/agro_fazenda_mock/agro_fazenda_mock_full.sql`
8. Injeta guard clause: `current_database() = 'agro_fazenda_mock'`
9. Concede permissões no schema `agro`
10. Executa validação (salvo `--skip-validation`)
11. Salva log em `logs/` e imprime resumo

## Validação

```bash
./scripts/validate_agro_fazenda_mock.sh
```

Com contagens esperadas (versão atual do repositório):

```bash
EXPECTED_TABLES=69 EXPECTED_VIEWS=14 ./scripts/validate_agro_fazenda_mock.sh
```

## Conexão

```bash
./scripts/connect_agro_fazenda_mock.sh
```

## Backup

```bash
./scripts/backup_agro_fazenda_mock.sh
```

## Evidências do deploy realizado (2026-07-02)

Deploy manual validado na VPS. Ver [DEPLOY_OK.md](../DEPLOY_OK.md).

| Métrica | Resultado |
|---------|-----------|
| Tabelas | 60 |
| Views | 7 |
| Lançamentos desbalanceados | 0 |
| Log | `logs/validacao_agro_fazenda_mock_20260702_073225.log` |

## Risco do DROP SCHEMA

O arquivo `00_drop_create_schema.sql` executa:

```sql
DROP SCHEMA IF EXISTS agro CASCADE;
```

Isso **apaga permanentemente** todas as tabelas, views, dados e objetos do schema `agro`. O banco `agro_fazenda_mock` permanece, mas o conteúdo do schema é recriado do zero.

Sempre faça backup antes de re-deploy:

```bash
./scripts/backup_agro_fazenda_mock.sh
```

## Troubleshooting

### Container postgres não encontrado

```bash
docker ps | grep postgres
```

Confirme que o container genérico se chama `postgres`.

### Erro de locale ao criar banco

O script tenta `en_US.utf8` e faz fallback para UTF8 padrão.

### Re-deploy completo

```bash
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
```

## Documentação relacionada

- [Modelo de dados](modelo-dados-agro-fazenda-mock.md)
- [Operação e manutenção](operacao-e-manutencao.md)
