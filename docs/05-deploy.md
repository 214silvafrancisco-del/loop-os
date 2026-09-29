# LOOP OS — Deploy e operação (v0.1, 2026-09-29)

Arquitetura de produção (decisão 2026-09-29): **VPS Hetzner + Coolify** (app em Docker), **Supabase Free** (Postgres + Auth), **Cloudflare R2** (documentos e backups). Custo ~€5/mês.

## 0. O que já está no repositório

| Ficheiro | Função |
|---|---|
| `Dockerfile`, `.dockerignore` | Imagem Next.js standalone (Node 24 Alpine), utilizador sem privilégios, healthcheck em `/api/health` |
| `next.config.ts` | `output: "standalone"`, cabeçalhos de segurança (X-Frame-Options, nosniff, Referrer-Policy, HSTS em produção) |
| `src/app/api/health/route.ts` | Saúde da app e da base de dados |
| `drizzle/0014_rls_lockdown.sql` | RLS ativo em todas as tabelas, privilégios revogados a `anon`/`authenticated`, RLS automático em tabelas futuras |
| `scripts/backup.sh` | `pg_dump` noturno para o R2 (+ cópia local), retenção 30 dias |
| `.env.example` | Todas as variáveis |

## 1. Contas a criar (tu)

1. **Hetzner Cloud** (console.hetzner.cloud): servidor **CX22** (2 vCPU, 4 GB, ~€4/mês), imagem **Ubuntu 24.04**, localização Nuremberga ou Falkenstein, com a tua chave SSH. Anota o IP.
2. **Cloudflare** (dash.cloudflare.com): R2 → *Create bucket* `loop-documents` e `loop-backups` (região automática, EU). *Manage R2 API Tokens* → token **Object Read & Write** limitado aos dois buckets. Guarda Account ID, Access Key ID, Secret Access Key.
3. **Domínio**: por exemplo `app.loophomes.pt`. Registo DNS **A** a apontar para o IP do servidor (se usares Cloudflare para DNS, deixa a nuvem cinzenta/DNS only para o Coolify emitir o certificado).

## 2. Servidor: instalar o Coolify

No teu PC, via SSH (`ssh root@<IP>`):

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Abre `http://<IP>:8000`, cria o utilizador admin do Coolify e liga o servidor "localhost". Depois: *Settings → Instance domain* (opcional) e ativa o **firewall** da Hetzner (Cloud Console → Firewalls): permitir 22, 80, 443 e 8000 (este último só do teu IP).

## 3. Coolify: criar a aplicação

1. *Projects → New → Add resource → Public/Private repository (GitHub App)*. Instala a GitHub App na conta `214silvafrancisco-del`, escolhe `loop-os`, branch `main`.
2. **Build pack: Dockerfile**. Porta **3000**. Domínio `https://app.loophomes.pt` (o Coolify emite o certificado Let's Encrypt).
3. **Environment variables** (marcar *Build variable* nas `NEXT_PUBLIC_*`):

| Variável | Valor | Build? |
|---|---|---|
| `DATABASE_URL` | pooler Supabase porta 6543 | |
| `DIRECT_URL` | pooler porta 5432 | |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lfboisdeoijznqwaqgir.supabase.co` | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publishable | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secret | |
| `NEXT_PUBLIC_APP_URL` | `https://app.loophomes.pt` | ✓ |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | do token R2 | |
| `R2_BUCKET` | `loop-documents` | |
| `NODE_ENV` | `production` | |

4. *Deploy*. O primeiro build demora ~3 minutos. Verifica `https://app.loophomes.pt/api/health` → `{"ok":true,"db":"up"}`.
5. Ativa *Auto deploy* (webhook do GitHub): cada `git push` para `main` publica.

## 4. Migrações da base de dados

As migrações não correm dentro da imagem. Correm a partir do teu PC (o Drizzle liga-se ao Supabase):

```bash
cd C:\dev\loop-os; pnpm db:migrate
```

Regra: **migrar antes de fazer push** de código que dependa de tabelas novas. Toda a tabela nova fica automaticamente com RLS ativo (event trigger da migração 0014).

## 5. Supabase Auth em produção

*Authentication → URL Configuration*:
- **Site URL**: `https://app.loophomes.pt`
- **Redirect URLs**: `https://app.loophomes.pt/**` e `http://localhost:3000/**`

*Authentication → Email Templates*: substituir o link nos templates **Invite user** e **Reset password** para o formato que a app espera (`/auth/confirm` com `token_hash`):

```html
<!-- Invite user -->
<h2>Foste convidado para o LOOP OS</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/reset-password/update">Aceitar o convite e definir password</a></p>

<!-- Reset password -->
<h2>Recuperar password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password/update">Definir nova password</a></p>
```

Depois disto, `pnpm user:invite email "Nome" manager` envia o convite aos colegas, e "Esqueci-me da password" funciona. O Supabase Free envia poucos emails por hora; para volume maior configurar SMTP próprio (*Authentication → SMTP Settings*).

## 6. Storage R2

Com as quatro variáveis `R2_*` definidas, a app usa o R2 automaticamente (ver `src/core/storage/index.ts`). Os documentos carregados em desenvolvimento ficaram em `.storage/` no PC e **não migram**: carregar de novo os que interessam.

## 7. Backups

No servidor:

```bash
apt-get install -y postgresql-client rclone
mkdir -p /etc/loop-os /opt/loop-os/scripts
# copiar scripts/backup.sh para /opt/loop-os/scripts/ e chmod +x
rclone config   # remote "r2", tipo s3, provider Cloudflare, endpoint https://<ACCOUNT_ID>.r2.cloudflarestorage.com
cat > /etc/loop-os/backup.env <<'EOF'
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
R2_BUCKET_BACKUPS=loop-backups
LOCAL_DIR=/var/backups/loop-os
RETENTION_DAYS=30
EOF
chmod 600 /etc/loop-os/backup.env
(crontab -l 2>/dev/null; echo "15 3 * * * /opt/loop-os/scripts/backup.sh >> /var/log/loop-backup.log 2>&1") | crontab -
/opt/loop-os/scripts/backup.sh   # primeiro backup, à mão
```

**Teste de restauro** (trimestral): criar um projeto Supabase temporário e `gunzip -c loop-os-<data>.sql.gz | psql "<DIRECT_URL do temporário>"`. Se correr sem erros e as contagens baterem, o backup serve.

Segunda linha: copiar mensalmente a pasta `loop-backups/db/` do R2 para o OneDrive da empresa (rclone no PC ou download manual).

## 8. Checklist de segurança (estado em 2026-09-29)

- [x] Acesso a dados só pelo servidor; chave secreta e `DATABASE_URL` nunca no browser
- [x] RLS ativo em todas as tabelas; `anon`/`authenticated` sem privilégios (API REST do Supabase devolve 401)
- [x] Cookies de sessão do Supabase (httpOnly), rotas protegidas pelo proxy, perfis desativados bloqueados
- [x] Downloads por URL assinado de 15 min (R2) ou stream autenticado; chaves de storage nunca expostas
- [x] Cabeçalhos: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS
- [x] Audit log em todas as tabelas de domínio
- [x] Imagem Docker com utilizador sem privilégios
- [ ] Firewall Hetzner (22/80/443; 8000 só do teu IP) — ao criar o servidor
- [ ] MFA nos utilizadores admin (Supabase suporta TOTP; opcional, Phase 2)
- [ ] Rate limiting no login (Supabase já limita tentativas por IP; reforço na app em Phase 2)
- [ ] Rotação anual das chaves R2 e da password da base de dados

## 9. Rotina de operação

| Quando | O quê |
|---|---|
| Cada alteração | `pnpm test`, `pnpm build` local, `pnpm db:migrate` se houver migração, `git push` → deploy automático |
| Diário (automático) | Backup 03:15 UTC para o R2 |
| Mensal | Copiar backups para o OneDrive; `apt-get upgrade` no servidor; atualizar o Coolify |
| Trimestral | Teste de restauro de um backup |
