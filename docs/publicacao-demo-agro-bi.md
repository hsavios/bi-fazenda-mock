# Publicação da demo BI Agro — `demo-agro.heliosavio.com`

Demonstração comercial pública da base mock `agro_fazenda_mock`, servida via Cloudflare Tunnel.

## Arquitetura

```text
Cliente (celular/desktop)
    ↓ HTTPS
Cloudflare (demo-agro.heliosavio.com)
    ↓ Cloudflared tunnel heliosavio-vps-prod
127.0.0.1:8088  →  fazenda-mock-bi-nginx
    ├── /           dashboard HTML (demo comercial)
    └── /api/*      proxy → postgrest:3000 (rede Docker interna)
                            ↓
                    127.0.0.1:3010 (host, NÃO publicado no tunnel)
                            ↓
                    postgres / agro_fazenda_mock (schema agro)
                            role: agro_mock_readonly (somente SELECT em views)
```

**Não exposto publicamente:** `127.0.0.1:3010`, PostgreSQL, tabelas operacionais.

## URLs

| URL | Função |
|-----|--------|
| https://demo-agro.heliosavio.com | Dashboard demo |
| https://demo-agro.heliosavio.com/api/vw_dre_gerencial?limit=1 | API readonly (exemplo) |
| https://heliosavio.com | Landing com card da demo |
| http://127.0.0.1:8088 | Acesso local na VPS (validação) |

## Pré-requisitos

- BI validado: `./scripts/validate_bi_vps.sh`
- `chmod -R a+rX bi/` após `git pull`
- Cloudflared ativo (`systemctl status cloudflared`)
- `heliosavio.com` já publicado em `127.0.0.1:9081` (não alterar)

## Fase 1 — Deploy nginx seguro

```bash
cd /home/helio/projects/agro-fazenda-mock
git pull
BI_PGRST_PORT=3010 BI_NGINX_PORT=8088 ./scripts/deploy_bi_vps.sh
./scripts/validate_bi_vps.sh
```

Headers aplicados em `bi/nginx.conf` + rate limit em `bi/nginx.docker.conf`:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restritivo
- `X-Frame-Options: SAMEORIGIN`
- CORS apenas para `demo-agro.heliosavio.com` e `heliosavio.com`
- Rate limit `/api/`: ~60 req/min por IP (burst 15)

## Fase 2 — Cloudflared

### Backup

```bash
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak.$(date +%Y%m%d)
```

### Adicionar rota

Edite `/etc/cloudflared/config.yml` e insira **antes** do `service: http_status:404`:

```yaml
  - hostname: demo-agro.heliosavio.com
    service: http://127.0.0.1:8088
```

Referência: `deploy/cloudflared-demo-agro.snippet.yml`

### Validar e reiniciar

```bash
# cloudflared recente:
sudo cloudflared tunnel ingress validate /etc/cloudflared/config.yml

# Se o comando acima não existir, valide sintaxe YAML e teste após restart:
sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress rule https://demo-agro.heliosavio.com 2>/dev/null || true

sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 30 --no-pager
```

**Não alterar** rotas de `heliosavio.com`, `app.gesto.ia.br`, `hub.*`, `n8n.*`, etc.

## Fase 3 — DNS Cloudflare

Se o túnel `heliosavio-vps-prod` já gerencia hostnames via painel Zero Trust, crie o hostname público lá:

1. Cloudflare Zero Trust → Networks → Tunnels → `heliosavio-vps-prod`
2. Public Hostname → Add
3. Subdomain: `demo-agro`
4. Domain: `heliosavio.com`
5. Service: `http://127.0.0.1:8088`

Se usar só YAML em `/etc/cloudflared/config.yml`, confira no painel DNS da zona `heliosavio.com`:

| Tipo | Nome | Alvo | Proxy |
|------|------|------|-------|
| CNAME | `demo-agro` | `<tunnel-id>.cfargotunnel.com` | Proxied (laranja) |

O alvo exato aparece em Zero Trust → Tunnels → seu tunnel → Connector. **Não invente** o UUID — copie do painel.

## Fase 4 — Validação

```bash
./scripts/validate_demo_public.sh

curl -I https://demo-agro.heliosavio.com
curl -s "https://demo-agro.heliosavio.com/api/vw_dre_gerencial?limit=1" | head
curl -I https://heliosavio.com

ss -tlnp | grep -E '3010|8088'
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep fazenda
```

Validação só local (antes do DNS):

```bash
LOCAL_ONLY=1 ./scripts/validate_demo_public.sh
```

## Fase 5 — Landing

Projeto: `heliosavio-landing` (container `heliosavio-landing`, porta `127.0.0.1:9081`).

```bash
cd /caminho/heliosavio-landing
git pull
./deploy/scripts/landing-sync.sh --force
curl -s https://heliosavio.com/ | grep -o 'demo-agro.heliosavio.com'
```

## Views expostas (readonly)

As 14 views KPI com prefixo `vw_*` — ver `docs/checklist-seguranca-demo-publica.md`.

## Rollback

### Remover publicação (manter BI local)

```bash
sudo cp /etc/cloudflared/config.yml.bak.YYYYMMDD /etc/cloudflared/config.yml
sudo systemctl restart cloudflared
```

Remover hostname `demo-agro` no painel Cloudflare, se criado lá.

### Parar stack BI (não remove banco)

```bash
cd /home/helio/projects/agro-fazenda-mock
docker compose -f docker-compose.bi.yml -f docker-compose.bi.override.yml down
```

### Após git pull (permissões)

```bash
chmod -R a+rX bi/
```

## Dados

Todos os dados são **fictícios**, criados para portfólio. Nenhum dado real de cliente.
