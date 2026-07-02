# agro-fazenda-mock

Base PostgreSQL mock completa para uma fazenda produtora de **soja, milho, sorgo, feijão e café** — com rastreabilidade entre fazenda, talhões, safras, culturas, operações, insumos, máquinas, pessoas, estoques, comercialização, financeiro, custos e contabilidade.

Projeto versionável para desenvolvimento, testes, demonstrações, BI, APIs e futuras aplicações de gestão agrícola.

---

## O que é

O banco `agro_fazenda_mock` (schema `agro`) representa a operação fictícia **Fazenda Boa Esperança Agro Ltda.** em Rio Verde/GO, com dados coerentes do plantio ao balancete contábil.

| Componente | Descrição |
|------------|-----------|
| Banco | `agro_fazenda_mock` |
| Usuário | `agro_mock_user` |
| Schema | `agro` |
| Container | `postgres` (Docker, `postgres:16`) |

---

## Estrutura do projeto

```
agro-fazenda-mock/
├── database/agro_fazenda_mock/   # SQL modular + consolidado
│   ├── 00_drop_create_schema.sql
│   ├── 01_schema.sql
│   ├── 02_seed_master_data.sql
│   ├── 03_seed_operational_data.sql
│   ├── 04_views_kpis.sql
│   ├── 05_validation_queries.sql
│   ├── agro_fazenda_mock_full.sql
│   └── README.md
├── scripts/
│   ├── deploy_agro_fazenda_mock_vps.sh
│   ├── validate_agro_fazenda_mock.sh
│   ├── connect_agro_fazenda_mock.sh
│   ├── backup_agro_fazenda_mock.sh
│   ├── grant_agro_fazenda_mock.sh
│   ├── build_agro_fazenda_mock_full.sh
│   ├── deploy_bi_vps.sh
│   ├── validate_bi_vps.sh
│   └── lib/agro_secrets.sh
├── docs/
│   ├── deploy-agro-fazenda-mock-postgresql.md
│   ├── modelo-dados-agro-fazenda-mock.md
│   └── operacao-e-manutencao.md
├── bi/                           # Dashboard BI (opcional)
├── logs/                         # logs de deploy/validação (gitignored)
├── backups/                      # dumps (gitignored)
├── .gitignore
├── DEPLOY_OK.md
└── README.md
```

---

## Início rápido

### 1. Clonar e preparar

```bash
git clone <repo-url> agro-fazenda-mock
cd agro-fazenda-mock
chmod +x scripts/*.sh
```

### 2. Deploy na VPS

Requisitos: Docker com container `postgres` rodando.

```bash
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
```

> **Atenção:** sem `--yes`, o script pede confirmação porque o SQL pode apagar e recriar o schema `agro` (`DROP CASCADE`).

### 3. Validar

```bash
./scripts/validate_agro_fazenda_mock.sh
```

### 4. Conectar

```bash
./scripts/connect_agro_fazenda_mock.sh
```

### 5. Backup

```bash
./scripts/backup_agro_fazenda_mock.sh
```

### 6. Dashboard BI (opcional)

```bash
ss -tlnp | grep -E '3000|3010|8088|8090' || true
BI_PGRST_PORT=3010 BI_NGINX_PORT=8088 ./scripts/deploy_bi_vps.sh
./scripts/validate_bi_vps.sh
```

Acesse: http://127.0.0.1:8088 (PostgREST em :3010 — **não usa :3000**)

Túnel SSH a partir do seu PC: `ssh -L 8088:127.0.0.1:8088 helio@srv1535465`

---

## Credenciais

Arquivo: `~/.secrets/agro_fazenda_mock.env` (chmod 600, **não commitar**)

```bash
source ~/.secrets/agro_fazenda_mock.env
# AGRO_DB, AGRO_USER, AGRO_PASS, AGRO_SCHEMA
```

---

## Evitar o PostgreSQL errado

| Container | Status |
|-----------|--------|
| `postgres` | **Usar** — base agro |
| `gesto-app-postgres-1` | **Não usar** — outro projeto |

Todos os scripts bloqueiam uso acidental do container errado.

---

## Logs

| Tipo | Padrão |
|------|--------|
| Deploy | `logs/agro_fazenda_mock_deploy_*.log` |
| Validação | `logs/validacao_agro_fazenda_mock_*.log` |

---

## Recriar a base

```bash
./scripts/backup_agro_fazenda_mock.sh          # recomendado antes
./scripts/deploy_agro_fazenda_mock_vps.sh --yes
./scripts/validate_agro_fazenda_mock.sh
```

---

## Documentação

- [Deploy na VPS](docs/deploy-agro-fazenda-mock-postgresql.md)
- [Deploy do BI](docs/deploy-bi-vps.md)
- [Modelo de dados](docs/modelo-dados-agro-fazenda-mock.md)
- [Operação e manutenção](docs/operacao-e-manutencao.md)
- [Deploy validado na VPS](DEPLOY_OK.md)

---

## Métricas (versão atual do repositório)

| Métrica | Valor |
|---------|-------|
| Tabelas | 69 |
| Views KPI | 14 |
| Talhões | 20 |
| Culturas | 5 |

---

## Licença

Projeto de demonstração / estudo. Dados fictícios — uso livre para fins educacionais e prototipagem.
