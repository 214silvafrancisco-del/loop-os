# LOOP OS — Deploy e operação (v0.2, 2026-09-30)

Arquitetura de produção: **VPS + Coolify** (app em Docker), **Supabase Free** (Postgres + Auth), **Cloudflare R2** (documentos e backups).

## Estado atual (2026-09-30)

| Item | Valor |
|---|---|
| Servidor | Netcup VPS Lite 1 G12.5s (2 vCPU, 4 GB, 80 GB), Ubuntu 24.04.5, IPv4 `89.58.58.97`. O registo na Hetzner falhou; os passos abaixo valem para qualquer VPS Ubuntu |
| App | `https://app.89.58.58.97.sslip.io` (sem domínio próprio ainda; certificado Let's Encrypt automático) |
| Acesso SSH | só por chave (`~/.ssh/id_ed25519` no PC do Francisco); login por password desligado em `/etc/ssh/sshd_config.d/99-loop-hardening.conf` |
| Firewall | UFW só 22, 80, 443; portas do Docker 8000, 6001, 6002 e 8080 bloqueadas externamente (ver §7b) |
| Painel Coolify | `https://coolify.89.58.58.97.sslip.io` (a porta 8000 já não está acessível de fora) |
| Backups | diários 03:15 UTC para `r2:loop-backups/db/` e `/var/backups/loop-os`, retenção 30 dias; restauro testado em 2026-09-30 |

Notas de build no Coolify: o Coolify injeta todas as variáveis marcadas "Available at Buildtime" como `ARG` (incluindo `NODE_ENV`). Só as três `NEXT_PUBLIC_*` devem estar em build; as secretas só em runtime.

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
5. Ativa *Auto deploy* (webhook do GitHub): cada `git push` para `main` publica. O webhook da GitHub App tem de apontar para o domínio HTTPS do painel: GitHub → Settings → Developer settings → GitHub Apps → `loop-os-coolify` → *Webhook URL* `https://coolify.89.58.58.97.sslip.io/webhooks/source/github/events`. Se ficar com `http://<IP>:8000/…`, deixa de chegar quando a porta 8000 é bloqueada (§7b).

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

*Authentication → Email Templates*: **não é preciso mudar nada.** No plano Free, com o envio de email do Supabase, os templates não são editáveis (só com SMTP próprio). A app aceita os links por defeito:

| Email | Enviado por | Link de retorno | Como a app trata |
|---|---|---|---|
| Convite | `pnpm user:invite email "Nome" manager` | `/auth/callback?next=/reset-password/update` | a sessão vem no fragmento `#access_token=…`; a página lê-a no browser e segue para "Definir password" |
| Recuperar password | "Esqueci-me da password" no login | `/auth/confirm?next=/reset-password/update` | `?code=` (PKCE) trocado no servidor; tem de ser aberto no mesmo browser onde foi pedido |

`/auth/confirm` sem `token_hash` nem `code` passa para `/auth/callback`, que recebe o fragmento. Se um dia houver SMTP próprio, os templates com `token_hash` continuam a funcionar:

```html
<!-- Invite user -->
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/reset-password/update">Aceitar o convite e definir password</a></p>
<!-- Reset password -->
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password/update">Definir nova password</a></p>
```

O script de convite usa `INVITE_APP_URL`, depois `NEXT_PUBLIC_APP_URL`, e por defeito o endereço de produção. O Supabase Free envia poucos emails por hora (cerca de 2); para mais, configurar SMTP próprio (*Authentication → SMTP Settings*).

## 6. Storage R2

Com as quatro variáveis `R2_*` definidas, a app usa o R2 automaticamente (ver `src/core/storage/index.ts`). Os documentos carregados em desenvolvimento ficaram em `.storage/` no PC e **não migram**: carregar de novo os que interessam.

## 7. Backups (instalado em 2026-09-30)

| Peça | Onde |
|---|---|
| Script | `/opt/loop-os/backup.sh` (cópia em `scripts/backup.sh`) |
| Configuração | `/etc/loop-os/backup.env` (`DIRECT_URL`, bucket, retenção) e `/etc/loop-os/rclone.conf` (remote `r2`), ambos `chmod 600` |
| Agendamento | `/etc/cron.d/loop-os-backup`, 03:15 UTC, registo em `/var/log/loop-backup.log` (logrotate mensal) |
| Destino | `r2:loop-backups/db/` e `/var/backups/loop-os/`, retenção 30 dias |
| Formato | `pg_dump --format=custom`, ~0,5 MB com os dados atuais |

Requisitos que importam:
- **`postgresql-client-17`** do repositório PGDG. O Supabase corre Postgres 17 e o cliente do Ubuntu (16) recusa o dump.
- **rclone oficial** (`curl https://rclone.org/install.sh | bash`, v1.75+). A versão do Ubuntu (1.60) recebe `501 NotImplemented` do R2 em cada envio.

Ver o último backup e correr um à mão:

```bash
tail -5 /var/log/loop-backup.log
/opt/loop-os/backup.sh
RCLONE_CONFIG=/etc/loop-os/rclone.conf rclone ls r2:loop-backups/db/
```

**Teste de restauro** (trimestral; feito em 2026-09-30 com as contagens iguais à base real):

```bash
F=$(ls -t /var/backups/loop-os/*.dump | head -1)
docker run -d --name pgrestore -e POSTGRES_PASSWORD=x postgres:17-alpine && sleep 5
docker cp "$F" pgrestore:/tmp/b.dump
docker exec pgrestore pg_restore -U postgres -d postgres --no-owner --no-privileges -n public /tmp/b.dump
docker exec pgrestore psql -U postgres -tAc "select count(*) from deals"
docker rm -f pgrestore
```

Um único erro é esperado (`schema "auth" does not exist`): é a ligação dos perfis ao Auth do Supabase. Numa recuperação real restaura-se para um projeto Supabase, que tem esse schema.

Segunda linha: copiar mensalmente a pasta `loop-backups/db/` do R2 para o OneDrive da empresa.

## 7b. Portas publicadas pelo Docker

O Docker publica portas diretamente no iptables e **ignora o UFW**. O Coolify publica 8000 (painel), 6001–6002 (tempo real do painel) e o proxy publica 8080. O script `/opt/loop-os/docker-firewall.sh` (cópia em `scripts/docker-firewall.sh`) bloqueia o acesso externo às portas listadas em `/etc/loop-os/blocked-ports`, na cadeia `DOCKER-USER`, e é reaplicado no arranque pelo serviço `loop-docker-firewall`.

```bash
cat /etc/loop-os/blocked-ports          # portas bloqueadas
echo 8000 >> /etc/loop-os/blocked-ports && systemctl restart loop-docker-firewall   # bloquear mais uma
```

Só bloquear 8000/6001/6002 depois de o painel do Coolify ter um domínio HTTPS (Settings → Instance Domain), senão perde-se o acesso ao painel. Recuperação se isso acontecer: `ssh -L 8000:127.0.0.1:8000 root@89.58.58.97` e abrir `http://localhost:8000`.

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
