# Deploy do banco agro_fazenda_mock na VPS

Guia para provisionar a base mock agrícola no container PostgreSQL genérico da VPS `srv1535465`.

## Pré-requisitos

- Docker instalado e em execução
- Container `postgres` (`postgres:16`) rodando em `127.0.0.1:5432`
- Repositório clonado na VPS (ex.: `/home/helio/fazenda-mock-bi`)
- **Não** usar o container `gesto-app-postgres-1`

## Comando único

```bash
cd /caminho/fazenda-mock-bi
chmod +x scripts/*.sh
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
```

## Opções

| Opção | Descrição |
|-------|-----------|
| `--yes` | Obrigatório — confirma DROP SCHEMA agro CASCADE |
| `--reset-password` | Gera nova senha para `agro_mock_user` |
| `--skip-validation` | Pula validações ao final |
| `--help` | Ajuda |

## O que o script faz

1. Valida Docker e container `postgres`
2. Bloqueia uso acidental de `gesto-app-postgres-1`
3. Cria banco `agro_fazenda_mock` (se não existir)
4. Cria/atualiza usuário `agro_mock_user`
5. Salva credenciais em `~/.secrets/agro_fazenda_mock.env` (chmod 600)
6. Gera e executa SQL consolidado com guard clause de banco
7. Executa validações
8. Imprime resumo e salva log em `logs/`

## Credenciais

Arquivo: `~/.secrets/agro_fazenda_mock.env`

```
AGRO_MOCK_DB=agro_fazenda_mock
AGRO_MOCK_USER=agro_mock_user
AGRO_MOCK_PASSWORD=<gerada automaticamente>
AGRO_MOCK_HOST=127.0.0.1
AGRO_MOCK_PORT=5432
AGRO_MOCK_SCHEMA=agro
```

## Validação manual

```bash
./scripts/validate_agro_fazenda_mock.sh
```

## Conexão psql

```bash
source ~/.secrets/agro_fazenda_mock.env
docker exec -it postgres psql -U "$AGRO_MOCK_USER" -d "$AGRO_MOCK_DB"
```

## Troubleshooting

### Container postgres não encontrado

```bash
docker ps | grep postgres
```

Confirme que o container genérico se chama `postgres`, não `gesto-app-postgres-1`.

### Erro de locale ao criar banco

Se `en_US.utf8` não existir no container, ajuste o `CREATE DATABASE` no script de deploy ou crie manualmente:

```sql
CREATE DATABASE agro_fazenda_mock ENCODING 'UTF8' TEMPLATE template0;
```

### Re-deploy (reset completo do schema)

```bash
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
```

Isso executa `DROP SCHEMA agro CASCADE` e recria tudo.

## Rollback

Para remover apenas o banco mock (sem afetar outros bancos):

```bash
docker exec postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS agro_fazenda_mock;"
docker exec postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP USER IF EXISTS agro_mock_user;"
rm -f ~/.secrets/agro_fazenda_mock.env
```

## Deploy do dashboard BI

Após o banco provisionado:

```bash
./scripts/deploy_bi_vps.sh
```

Ver [bi/README.md](../bi/README.md).
