# 08 · Entrega: responsáveis por tarefas, acessos por módulo e dashboards

Entrega final das fases 1–5 da especificação «Responsáveis por tarefas, permissões e dashboards individuais» (outubro de 2026). Complementa os docs 01 (passos), 02 (navegação), 03 (modelo de dados) e 05 (operação).

## 1. Funcionalidades implementadas

| Fase | O que ficou |
|---|---|
| 1 · Auditoria | Diagnóstico da app e proposta por fases (aprovada). Decisões: tarefas substituem a «próxima ação»; leads incluídas; **não há módulo Financeiro** (só acessos por módulo); Resultado da venda fica em Vendas; Definições são só do admin (Founder). |
| 2 · Tarefas | Tabela `tasks` com responsável, prazo, estado (por iniciar / em curso / bloqueada / concluída) e histórico. «Próxima tarefa» = tarefa aberta com prazo mais próximo, em negócios, obras, vendas e leads. Controlo único (editar · concluir e criar a seguinte), separador Tarefas em cada ficha, página `/tarefas` com filtros, chips de alerta (atrasadas, próximos 7 dias, sem responsável, bloqueadas) e resumo diário por push. As 20 «próximas ações» existentes foram convertidas em tarefas. |
| 3 · Acessos | Dois estados por utilizador e módulo (Negócios, Imóveis, Contactos, Obras, Vendas, Funil comercial), guardados em `user_modules`. Verificação no servidor em páginas, server actions, rotas API, downloads/uploads de documentos, documentos partilhados do imóvel, pesquisa, menu e dashboard. Tarefas atribuídas em módulos sem acesso aparecem mascaradas. Matriz em Definições → Utilizadores e acessos (só admin): ligar/desligar módulos, desativar/reativar, reatribuir tarefas abertas. |
| 4 · Dashboards | Dashboard único para toda a equipa, pela ordem Funil comercial · Previsão de compras · Em aberto · Vendas · Obras · Próximas tarefas, com cada bloco filtrado pelos acessos; só a parte das tarefas é pessoal (tarefas do próprio). Página de Tarefas em Lista ou Kanban (arrastar muda o estado). Funil: só o admin regista/edita/usa valores da app; os outros consultam. |
| 5 · Validação | Testes unitários, script de autorização HTTP (`pnpm access:check`), testes manuais dos fluxos, lint, tipos, build, deploy. Proteção contra tarefas duplicadas. |

## 2. Ficheiros e componentes alterados (principais)

- **Acessos**: `src/core/auth/access.ts` (+ `access.test.ts`), `src/core/auth/current-user.ts` (`requireUser(módulo)`, `requireAdmin`), `src/core/auth/admin-actions.ts`, `src/core/auth/components/users-matrix.tsx`, `src/core/db/schema/access.ts`, `src/core/navigation.ts` (+ `navigation.test.ts`), `src/core/ui/app-shell/*` (sidebar, barra móvel, topbar, menu do utilizador), páginas `/settings/utilizadores`, `/sem-acesso`, `/notificacoes`. Todas as páginas e actions de módulo passaram a usar `requireUser("<módulo>")`; rotas API respondem 403; `documents/queries.ts` filtra por tipo de registo permitido.
- **Tarefas**: `src/modules/tasks/{schema,alerts,queries,actions}.ts`, `components/next-task-control.tsx`, `components/tasks-panel.tsx`, `components/tasks-kanban.tsx`, páginas `/tarefas` e `/{deals,projects,sales}/[id]/tarefas`; `deals/queries.ts` e `sales/queries.ts` juntam a próxima tarefa às listas; `notifications/digest.ts` usa tarefas; `core/audit/audit-timeline.tsx` descreve tarefas.
- **Dashboard**: `src/app/(app)/dashboard/page.tsx`, `src/modules/dashboard/queries.ts` (`getTaskStats`), `components/actions-list.tsx`, `components/task-stats-row.tsx`.
- **Funil**: `src/modules/funnel/actions.ts` (só admin), `components/funnel-table.tsx` (`readOnly`), páginas `/dashboard` e `/funil`.
- **Testes e scripts**: `scripts/access-check.mjs`, `package.json` (`access:check`).

## 3. Alterações na base de dados

| Migração | Conteúdo |
|---|---|
| `0024_tasks.sql` | Enums `task_status`, `task_entity`; tabela `tasks` (+ índices, `set_updated_at`, `audit_trigger`); conversão das `next_action` existentes em tarefas. As colunas `next_action`/`next_action_date` ficaram sem uso (legado, não removidas). |
| `0025_user_modules.sql` | Tabela `user_modules` (user_id → profiles on delete cascade, module, created_by, created_at, UNIQUE (user_id, module)) com acessos iniciais: Duarte todos os módulos; Gonçalo Negócios, Imóveis, Contactos. |

Nada foi apagado. RLS continua ativo sem políticas em todas as tabelas (bloqueia a API pública do Supabase); a app liga-se como dona das tabelas, por isso a autorização vive na app. `role_permissions` continua sem uso.

## 4. Migrações e configurações necessárias

- Migrações 0024 e 0025 já aplicadas em produção (base partilhada). Para um ambiente novo: `pnpm db:migrate`.
- Nenhuma variável de ambiente nova. (Push: VAPID_* e CRON_SECRET já existiam.)
- Script de verificação: `pnpm access:check` com a app a correr em `http://localhost:3000` (ou `BASE_URL=…`); usa `.env.local` (Supabase service role + DIRECT_URL).

## 5. Matriz final de permissões

| Utilizador | Papel | Negócios | Imóveis | Contactos | Obras | Vendas | Funil | Definições |
|---|---|---|---|---|---|---|---|---|
| Francisco Silva (Founder) | admin | sempre | sempre | sempre | sempre | sempre | sempre (edita) | sim |
| Duarte Mendes da Silva | manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (consulta) | não |
| Gonçalo Gaspar | user | ✓ | ✓ | ✓ | — | — | ✓ (consulta) | não |

Regras: Dashboard, Tarefas e Notificações são sempre acessíveis e mostram só o que os acessos permitem. Um módulo não concede outro. A atribuição de uma tarefa não dá acesso ao registo. Novos utilizadores começam sem acessos. Desativar revoga o acesso e preserva histórico e auditoria. Só o admin altera a matriz e regista o funil.

## 6. Testes executados e resultados (2026-10-14)

| Grupo | Como | Resultado |
|---|---|---|
| Unitários (Vitest) | `pnpm test` — acessos, menu, alertas de tarefas, funil, BP, PDF, etc. | 115/115 |
| Autorização HTTP + tarefas + dashboards + regressões | `pnpm access:check` contra o servidor local, com utilizador temporário só com Negócios e depois promovido a admin | 47/47 |
| Políticas BD | API pública do Supabase (anon) em user_modules, tasks, deals, invoices, documents: leitura 401; inserção em user_modules 401 | passou |
| Fluxos manuais (browser) | Criar tarefa com responsável e prazo; concluir e criar a seguinte (ligação ao negócio mantida; histórico 1 concluída); tentativa de duplicado rejeitada; Kanban arrastar Em curso → Bloqueada → Concluída; funil só de leitura para não-admin; dashboard único na ordem pedida; mobile sem scroll horizontal | passou |
| Consola | Páginas principais: um aviso de hidratação no Kanban (ids do dnd-kit) corrigido com `id` fixo no `DndContext`; restantes erros são do painel de browser (service worker) e dos próprios testes (403 esperados) | corrigido |
| Lint / tipos / build | `pnpm lint`, `pnpm typecheck`, `pnpm build` | sem erros |

Cobertura dos pontos da especificação: 5.1 (1–10) pelo script e por código (8: `setUserModule` exige `requireAdmin()` e recusa o próprio); 5.2 (1–9) pelo script e pelos fluxos manuais; 5.3 (1–9) pelo script (histórico do funil: 5 semanas em `/funil`, nada apagado); 5.4 regressões: 46 páginas com 200 (fichas base redirecionam para o separador por defeito).

Dados de teste (utilizadores «(apagar)», tarefas «TAREFA DE TESTE (apagar)», obra «OBRA DE TESTE (apagar)») foram apagados, incluindo auditoria.

## 7. Limitações conhecidas

- A autorização é feita na app, não em RLS por utilizador (a app usa a ligação de dono). A API pública está bloqueada; quem tiver a service role key tem tudo (como antes).
- O admin é único (Founder). Não há delegação de administração.
- A mudança da matriz tem efeito no pedido seguinte do utilizador (os acessos são lidos a cada pedido; a sessão não é terminada).
- Tarefas mascaradas mostram o título (não o registo). Se o título contiver informação sensível, está visível a quem é responsável.
- O Kanban de tarefas mostra concluídas só dos últimos 7 dias; o histórico completo fica em cada ficha e na lista com filtro «Concluída».
- Carga por pessoa / vista por colaborador no dashboard foram retiradas por decisão do Founder (dashboards uniformes); a visão de equipa faz-se em `/tarefas` com filtro Responsável.

## 8. Configurar os acessos dos colaboradores

1. Convidar: no PC, `pnpm user:invite <email> "<Nome>" user` (ou `manager`). O convidado entra por magic link e começa **sem acessos**.
2. Definições → **Utilizadores e acessos** (só o Founder): ligar os módulos na linha do utilizador. Tem efeito imediato no pedido seguinte.
3. Para tirar alguém: «Desativar» (revoga o acesso, mantém histórico) e, se for o caso, «Reatribuir tarefas abertas…» a outro colaborador ou a ninguém.
4. Notificações push: cada utilizador ativa em `/notificacoes` (menu do utilizador → Notificações).

## 9. Tarefas pendentes / opcionais

- Step 32 (base de dados de desenvolvimento separada) continua adiado.
- Colunas legadas `deals.next_action*` e `sales.next_action*` podem ser removidas numa migração futura.
- Orçamentos em PDF: afinar o parser com PDFs reais de fornecedores.
- Frequência do resumo diário no Coolify (`0 8` vs `0 9`) conforme a hora pretendida em Lisboa.
