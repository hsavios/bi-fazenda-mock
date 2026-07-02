# Checklist — segurança da demo pública BI Agro

Use antes e depois de publicar `https://demo-agro.heliosavio.com`.

## Dados e escopo

- [ ] Base é `agro_fazenda_mock` — **somente dados fictícios**
- [ ] Aviso visível na demo: “Dados fictícios • Demonstração pública”
- [ ] Nenhum segredo em `bi/` (sem `.env`, sem tokens no frontend)
- [ ] `~/.secrets/agro_fazenda_mock.env` fora do Git (chmod 600)

## Exposição de rede

- [ ] Dashboard nginx: `127.0.0.1:8088` (não `0.0.0.0`)
- [ ] PostgREST: `127.0.0.1:3010` (não `0.0.0.0`)
- [ ] **Nenhuma rota Cloudflared** aponta para `:3010`
- [ ] `curl` público em `https://demo-agro.heliosavio.com:3010` falha ou não conecta
- [ ] PostgreSQL `127.0.0.1:5432` — não exposto no tunnel
- [ ] Container `gesto-app-postgres-1` **não** usado

## API readonly

- [ ] Role `agro_mock_readonly` — SELECT somente nas 14 views KPI
- [ ] INSERT em tabela operacional **bloqueado** (`validate_bi_vps.sh`)
- [ ] API pública acessível apenas via `/api/` no nginx
- [ ] Métodos expostos: GET/HEAD/OPTIONS (sem POST/PATCH/DELETE públicos)

## Views KPI expostas (14)

- [ ] `vw_custo_hectare_cultura_safra`
- [ ] `vw_custo_saca_cultura_safra`
- [ ] `vw_resultado_gerencial_cultura`
- [ ] `vw_resultado_talhao`
- [ ] `vw_estoque_insumos_atual`
- [ ] `vw_estoque_producao_atual`
- [ ] `vw_uso_maquinas_safra`
- [ ] `vw_horas_mao_obra_safra`
- [ ] `vw_fluxo_caixa_realizado`
- [ ] `vw_balancete_contabil`
- [ ] `vw_dre_gerencial`
- [ ] `vw_margem_bruta_cultura`
- [ ] `vw_produtividade_talhao`
- [ ] `vw_comercializacao_cultura`

## Nginx

- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` restritivo
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] CORS **sem** `*` — apenas `demo-agro.heliosavio.com` e `heliosavio.com`
- [ ] Rate limit em `/api/` ativo
- [ ] Cache curto em `.css` / `.js`
- [ ] `chmod -R a+rX bi/` após `git pull` (evita 403)

## Cloudflared / DNS

- [ ] Backup de `/etc/cloudflared/config.yml` antes de editar
- [ ] Nova rota: `demo-agro.heliosavio.com` → `http://127.0.0.1:8088`
- [ ] Rotas existentes (`heliosavio.com`, gesto, hub, n8n) **inalteradas**
- [ ] `cloudflared` reiniciado sem erro
- [ ] DNS `demo-agro` aponta para o tunnel (se necessário)

## Serviços não afetados

- [ ] `https://heliosavio.com` — HTTP 200
- [ ] `app.gesto.ia.br` / `api.gesto.ia.br` — sem alteração
- [ ] `hub.heliosavio.com` / `n8n.heliosavio.com` — sem alteração
- [ ] `gesto-app-frontend-1` em `127.0.0.1:3000` — intacto

## Validação automatizada

```bash
./scripts/validate_bi_vps.sh
./scripts/validate_demo_public.sh
```

## Rollback

- [ ] Remover hostname `demo-agro` do Cloudflared
- [ ] Reiniciar `cloudflared`
- [ ] Opcional: `docker compose -f docker-compose.bi.yml down` (BI local)
- [ ] **Não** remover banco `agro_fazenda_mock`

## Mobile (390px)

- [ ] Hero e badge legíveis
- [ ] KPIs carregam (não ficam em “—”)
- [ ] Cards não estouram a largura
- [ ] CTAs clicáveis
- [ ] Link da landing abre a demo
