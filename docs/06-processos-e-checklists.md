# LOOP OS — Processos e checklists (v0.2, 2026-09-30)

> Validado em 2026-09-30. **Step 19 feito**: tabelas (migração 0015), `src/modules/checklists/` (rules, engine, context, sync, queries, actions, templates, setup), 20 testes, `pnpm checklists:sync` (22 checklists de negócio criadas em produção). **Step 20 feito**: tab Processo na ficha do negócio (`/deals/[id]/processo`), progresso e próximo passo no cabeçalho, itens manuais (checkbox), não aplicável com nota, responsável por item, links "resolver" (Documentos abre com a categoria pré-escolhida), Histórico em linguagem corrente; a sincronização corre ao abrir a ficha (layout). **Step 21 feito**: tab Processo e progresso no cabeçalho da obra (`/projects/[id]/processo`), coluna Processo na lista de negócios (com ponto vermelho quando há obrigatórios em falta) e na lista de obras, progresso no cartão do Kanban, filtro "Processo" na lista de negócios (com obrigatórios em falta / completo). **Step 22 feito**: portas do processo (`gate-rules.ts` + `gates.ts`): gerar proposta bloqueia sem preço pedido, BP ativo e preço máximo (aviso com links e formulário desativado); avançar para Proposta/Compra pede confirmação com a lista do que falta; obra → Em curso bloqueia sem responsável e orçamento, → Concluída bloqueia com autos em rascunho, e o resto avisa. Dashboard: cartão "Processo: obrigatórios em falta" (negócios em Proposta/Compra + alertas das obras). Definições → Procedimentos (leitura). Fica para a Phase 2: editor de procedimentos, versões, prazos, template Venda.

> **Versões**: ao subir `version` num template, `ensureChecklistSetup` cria a versão nova e `upgradeInstances` passa as checklists existentes para ela (itens pelo código mantêm o estado; novos entram pendentes; removidos saem). Corre com `pnpm checklists:sync`.

> **Step 23 (fornecedores por obra)**: template Nova Obra v2; regras `project.budget_suppliers` (capítulos com fornecedor), `project.measurements_current` e `project.measurements_complete` avaliam cada fornecedor por autos (N/A se não houver nenhum).

Objetivo da ronda: transformar os procedimentos da LOOP Homes em checklists operacionais dentro da app, ligadas aos dados reais. Este documento é a análise pedida; **não há código alterado**. No fim está a proposta de implementação por steps e as decisões a validar.

Pergunta-guia: *uma pessoa nova consegue registar e acompanhar um negócio e uma obra sem conhecimento informal?* Hoje a resposta é "consegue registar, mas não sabe o que falta". A app guarda bem; orienta pouco.

---

## 1. Processos identificados (o que a app já faz)

| # | Processo | Onde | Estado real hoje |
|---|---|---|---|
| P1 | Registar negócio (imóvel + negócio + contacto inline, aviso de morada duplicada) | `/deals/new` | Funciona. Só a morada e a fase são obrigatórias |
| P2 | Follow-up (próxima ação + data, dashboard com atrasadas/hoje/semana) | cabeçalho, dashboard | Funciona. 6 dos 22 negócios ativos não têm próxima ação |
| P3 | Análise por comparáveis → €/m² → valor de venda | tab Análise | Funciona |
| P4 | Business Plan (cenários, cenário ativo, preço máximo → `max_price`) | tab Business Plan | Funciona. 4 dos 22 ativos têm BP |
| P5 | Proposta (PDF + texto WhatsApp, estados gerada/enviada/aceite/recusada; avança a fase para Proposta) | tab Proposta | Funciona. 0 propostas na app (as antigas ficaram no Notion/WhatsApp) |
| P6 | Compra (a fase Compra exige valor final + data de escritura; imóvel passa a "Comprado"; prazo IMT a 3 anos) | Kanban / badge | Funciona. 5 negócios em Compra |
| P7 | Criar obra (só com fase Compra + escritura; datas previstas a partir do cenário ativo) | botão no cabeçalho | Funciona. 0 obras criadas |
| P8 | Orçamento em árvore (import Excel, fornecedor por linha) | obra → Orçamento | Funciona |
| P9 | Autos de medição mensais (rascunho → fechado, imutável) | obra → Autos | Funciona |
| P10 | Faturas e pagamentos (comparação com auto e com orçamento) | obra → Faturas | Funciona |
| P11 | Documentos (categorias, versões, imóvel/negócio/obra) | tab Documentos | Funciona. Só "Business Plan" tem ficheiros (5) |
| P12 | Excluir / reativar negócio | botão | Funciona |
| — | Venda (colocar à venda, CPCV de venda, escritura, P&L final) | — | **Não existe.** `property.status` tem `for_sale`/`sold` mas nada os usa |

## 2. Checklists existentes

Nenhuma. O que existe são cinco regras implícitas, espalhadas pelo código:

1. Fase Compra pede valor final e escritura (diálogo de compra).
2. "Criar Obra" só aparece com fase Compra e escritura.
3. Gerar proposta avança a fase para Proposta.
4. Auto fechado é imutável.
5. Não se apaga o cenário ativo do BP.

Ninguém vê estas regras antes de bater nelas. É isto que a checklist vai tornar visível.

## 3. Informação obrigatória hoje

| Entidade | Obrigatório na app | Tudo o resto |
|---|---|---|
| Negócio | fase; morada (≥ 3 caracteres) | opcional (preço pedido, fonte, contacto, responsável, próxima ação…) |
| Imóvel | morada | opcional |
| Compra | valor final, data de escritura | CPCV e custos reais opcionais |
| Obra | nome, estado | responsável (preenchido com quem cria), datas opcionais |
| Fatura | fornecedor, número, data, líquido, total | |
| Proposta | valor | |

Nos dados reais: 0 negócios sem preço pedido, 1 sem fonte, 2 sem contacto, 0 sem responsável. O registo básico está bom; a lacuna é a partir daí (documentação, análise, decisão).

## 4. Itens automáticos (a app sabe verificar)

Cada item automático tem uma **regra** que lê os dados. A regra devolve *concluído*, *pendente* ou *não aplicável*.

| Item | Regra (concluído quando…) |
|---|---|
| Identificação | `deal.name` preenchido ou tipologia + freguesia no imóvel |
| Morada completa | morada + freguesia + concelho, e a morada não contém "por confirmar" (44 imóveis importados ainda têm isto) |
| Preço pedido | `asking_price` > 0 |
| Origem registada | `source_channel_id` preenchido |
| Contacto registado | `source_contact_id` preenchido, com telefone |
| Responsável definido | `owner_user_id` |
| Próxima ação definida | `next_action` + data (vivo: volta a pendente quando se conclui a ação e não se define a seguinte) |
| Caderneta predial / Certidão permanente / Licença de utilização / Certificado energético / Plantas / Fotografias | existe documento ativo dessa categoria ligado ao imóvel ou ao negócio |
| Dados do imóvel para análise | área bruta, tipologia, andar, ano de construção, estado de conservação |
| Comparáveis | ≥ 3 comparáveis incluídos na Análise |
| Business Plan | existe cenário ativo calculado |
| Preço máximo definido | `max_price` > 0 |
| Proposta gerada | ≥ 1 proposta |
| Proposta enviada | ≥ 1 proposta com estado "enviada" ou posterior |
| Resultado registado | proposta "aceite"/"recusada", ou negócio excluído |
| Condições de compra | `final_price` + `deed_date` (CPCV opcional) |
| **Obra** | |
| Responsável / Datas previstas | `manager_user_id`; `planned_start` + `planned_end` |
| Orçamento criado | ≥ 1 linha e total > 0 |
| Capítulos definidos | ≥ 1 linha de nível 0 com categoria |
| Fornecedores atribuídos | todas as folhas com fornecedor (mostra "12 de 15") |
| Projeto / Contrato de empreitada / Orçamento (ficheiro) carregados | documento da categoria ligado à obra |
| Início registado | `actual_start` ou estado "Em curso" |
| Primeiro auto fechado | ≥ 1 auto fechado |
| Autos em dia | vivo: enquanto "Em curso", o último auto fechado é do mês anterior ou do atual |
| Faturas registadas / Pagamentos registados | ≥ 1 fatura; ≥ 1 pagamento |
| Sem faturas vencidas por pagar | vivo: nenhuma fatura com vencimento passado e saldo > 0 |
| Obra concluída | estado "Concluída" (`actual_end` preenchido) |
| Autos a 100 % | último auto fechado com acumulado = orçamentado (ou todas as folhas a 100 %) |
| Todas as faturas pagas | soma de pagamentos = soma de faturas |
| Fotografias finais | documento da categoria "Fotografias finais" (categoria nova) |

Itens "vivos" podem voltar a pendente. Isto é desejável: "Autos em dia" é um alerta permanente, não um passo.

## 5. Itens manuais (só a pessoa sabe)

| Item | Nota |
|---|---|
| Contactei o angariador / proprietário | |
| Visita realizada | ao marcar, a app pode propor mudar a fase para "Visita" se ainda estiver atrás |
| Validei a informação com o vendedor (áreas, ónus, condomínio, arrendamento) | |
| Analisei a envolvente (rua, estacionamento, ruído, comércio) | |
| Confirmei as condições da negociação (prazo, sinal, permanência de inquilinos) | |
| Documentação verificada (li os documentos, não só carreguei) | diferente de "carregada" |
| **Obra** | |
| Orçamento validado com o empreiteiro | até haver um estado "orçamento fechado" (Phase 2) |
| Fornecedores contratados (contratos assinados) | pode passar a automático se o contrato for documento obrigatório |
| Licenciamento / comunicação prévia tratado | N/A quando não é preciso |
| Desvio verificado este mês | vivo mensal, Phase 2 |
| Custos finais confirmados | |
| Documentação arquivada | |

Regra: itens manuais marcam-se com um clique e ficam com quem/quando. Itens automáticos **não se marcam à mão**; só podem passar a "não aplicável" (com nota). Evita checklists "a verde" sem dados por trás.

## 6. Itens obrigatórios

Obrigatório = conta para os bloqueios (secção 9) e aparece assinalado. Progresso conta todos os itens aplicáveis.

**Negócio** (v2, 2026-10-01): preço pedido; origem; contacto; morada completa; caderneta predial; certidão permanente; comparáveis (≥ 3); Business Plan com cenário ativo; condições de compra (a partir de Compra). O preço máximo deixou de ser obrigatório e a porta "gerar proposta" passou a aviso para ele.

**Obra** (v3, 2026-10-01): responsável; orçamento criado; início registado; autos a 100 % e faturas pagas (para fechar). O contrato de empreitada deixou de ser obrigatório.

## 7. Itens opcionais

Todos os outros. Em particular a documentação do imóvel é opcional na fase de lead (muitas vezes o angariador só a envia depois da visita) e passa a "recomendada" a partir de Proposta, mostrada como aviso e não como bloqueio.

## 8. Estados

Por item:

| Estado | Símbolo | Como se chega |
|---|---|---|
| Pendente | ☐ | por defeito |
| Concluído | ✓ | regra automática verdadeira, ou clique (manual). Guarda `completed_at`, `completed_by`, `source` (auto/manual) |
| Não aplicável | — | clique com nota opcional, ou condição de contexto (secção 11) |
| Bloqueado | 🔒 | **derivado, não guardado**: depende de outro item ainda pendente (ex.: "Gerar proposta" depende de "Preço máximo") |

Por checklist: `done / total / %` calculado sobre os itens aplicáveis (exclui N/A), guardado na checklist para a lista e o Kanban serem rápidos.

Contexto (secção 11): condições que tornam itens N/A automaticamente:
- **Sem financiamento** (cenário ativo com LTV = 0): itens de financiamento N/A.
- **Sem comissão de mediação** (fonte ≠ Consultor e `source_commission_pct` vazio): item de comissão N/A.
- **Licença de utilização**: N/A se ano de construção anterior a 1951 (prédios anteriores a 7/8/1951 estão dispensados).
- **Prédio/terreno**: itens de fração (certificado energético por fração, condomínio) ajustam-se.

Um item N/A por contexto pode ser reativado à mão.

## 9. Bloqueios: o que faz sentido

Princípio: bloquear só quando o passo seguinte **não faz sentido sem os dados**. Tudo o resto é aviso com "continuar mesmo assim". Bloqueios a mais fazem as pessoas inventar valores para passar.

| Transição | Proposta | Porquê |
|---|---|---|
| Gerar proposta (PDF/WhatsApp) | **Bloqueio duro**: cenário ativo no BP + preço máximo definido + preço pedido | É a disciplina central da LOOP: não se propõe sem saber o máximo. O valor da proposta já é sugerido pelo BP |
| Mover a fase para Proposta (Kanban/badge) | **Aviso** com a lista do que falta; permite continuar | Há propostas verbais e negócios antigos |
| Mover para Compra | Mantém o bloqueio atual (valor final + escritura). **Aviso** se não houver proposta aceite nem CPCV | A escritura é o facto; a proposta pode ter sido por WhatsApp |
| Criar obra | Mantém (Compra + escritura) | Já existe e faz sentido |
| Obra → Em curso | **Bloqueio duro**: responsável + orçamento com ≥ 1 linha. **Aviso**: contrato, datas previstas, licenciamento | Sem orçamento não há autos nem controlo; o resto pode vir na primeira semana |
| Obra → Concluída | **Bloqueio duro**: nenhum auto em rascunho. **Aviso**: faturas por pagar, fotografias finais, autos < 100 % | Pagamentos finais acontecem depois; um auto aberto é um erro |
| Fechar auto | Mantém | |
| Excluir negócio | Sem bloqueio | Decisão do utilizador (sem motivo de perda, como definido) |
| Mover para Visita | Sem bloqueio; ao marcar "Visita realizada" propõe a fase | |

Em resumo: **três bloqueios duros novos** (gerar proposta, obra em curso, obra concluída) e o resto avisos. Os bloqueios definem-se no template (`blocks: "proposal:generate"`), por isso um dia ajustam-se em Definições sem código.

## 10. Estrutura de dados necessária

Quatro tabelas novas (migração 0015), nenhuma alteração destrutiva às existentes.

```
checklist_templates          um por processo e versão
  id, organization_id, code ("novo_negocio", "nova_obra"), name, entity_type (deal|project),
  version, is_active, trigger ("on_create"), created_at

checklist_template_items     os passos do template
  id, template_id, code, section, label, help (texto curto: como se conclui),
  sort, kind (auto|manual), rule_key (chave da regra em código, só auto),
  is_required, applies_when (chave de contexto, opcional), depends_on_code (opcional),
  default_assignee ("owner" | "manager" | null), blocks (opcional: "proposal:generate", "project:em_curso"…),
  link_path (onde se conclui: "documentos?categoria=…", "business-plan"…)

checklists                   uma instância por negócio/obra
  id, organization_id, template_id, template_version, entity_type, entity_id, property_id,
  done_count, total_count, progress (0–1), synced_at, created_at

checklist_items              o estado de cada passo na instância
  id, checklist_id, template_item_id, code, section, sort  (copiados: a instância não muda se o template mudar)
  status (pending|done|not_applicable), source (auto|manual|context),
  completed_at, completed_by, na_note, assignee_user_id,
  due_date, priority (já criados, sem UI no MVP), updated_at, updated_by
```

Regras automáticas vivem em **código** (`src/modules/checklists/rules.ts`: `rule_key → função(contexto) → done | pending | na`), com testes unitários sobre objetos de exemplo. Templates são **dados** (seed + tabela), para a área Definições → Procedimentos os editar mais tarde sem tocar nas regras. Regra nova = código; ordem, textos, obrigatoriedade, responsável, bloqueios = dados.

Sincronização: uma função `syncChecklist(entityType, id)` reavalia as regras e grava só as diferenças. Corre (a) ao abrir a ficha e (b) depois das ações que mudam dados (guardar negócio, carregar documento, guardar cenário, gerar proposta, mudar fase, fechar auto, registar fatura/pagamento). Idempotente; a primeira vez que uma regra fica verdadeira grava quem e quando.

Auditoria: o trigger `audit_trigger()` existente aplica-se a `checklist_items` sem código novo (fica quem, quando, o que mudou). O Histórico do negócio passa a mostrar "Francisco marcou 'Visita realizada' como concluída" e "Caderneta predial: concluído automaticamente (documento carregado por Duarte)". RLS automático pelo event trigger da migração 0014.

Outras alterações pequenas:
- Categorias de documento novas: **Contrato de empreitada** (jurídico, obra) e **Fotografias finais** (técnico, obra).
- Nada de novo em `deals`/`projects`. "Visita" fica como item manual com data; se um dia quisermos relatórios de visitas, passa a tabela própria.

## 11. Alterações à UX

**Ficha do negócio**
- Nova tab **Processo** (logo a seguir a Resumo): secções (Registo, Qualificação, Documentação, Análise, Decisão, Compra), cada item com estado, badge "auto"/"manual", responsável (avatar), e "concluído por X em DD/MM" ao expandir. Cada item tem um link para onde se resolve (carregar caderneta → Documentos com a categoria pré-escolhida; BP → tab Business Plan).
- **Cabeçalho** (visível em todas as tabs): barra de progresso `14/20 · 70 %` e **"Próximo passo: Definir preço máximo"** (primeiro item obrigatório pendente e não bloqueado). Clicar leva ao item.
- Manual: checkbox. Auto: checkbox desativado com tooltip "Conclui-se automaticamente quando…". Menu por item: "Não aplicável" (pede nota curta), "Atribuir a…".
- Na mudança de fase: diálogo "Faltam 3 itens obrigatórios: … Continuar mesmo assim?" (aviso) ou "Não é possível gerar a proposta sem …" com botões que levam ao sítio (bloqueio).

**Lista e Kanban de negócios**: coluna/anel de progresso; filtro "com itens obrigatórios em falta"; ordenação por progresso.

**Dashboard**: cartão "Negócios em Proposta/Compra com obrigatórios em falta" e "Obras com autos em atraso".

**Obra**: tab Processo + progresso no cabeçalho, igual ao negócio. Lista de obras com progresso.

**Definições → Procedimentos** (MVP): só leitura, mostra os templates e itens com versão. Edição na Phase 2.

Princípio visual: a checklist não é um formulário a mais. É a "página de estado" do negócio, e o cabeçalho diz sempre qual é o próximo passo.

## 12. Funcionalidades futuras (a arquitetura já prevê)

- Editor de procedimentos em Definições (criar/editar itens, ordem, obrigatório, responsável, condições, bloqueios) e **versões**: instâncias antigas mantêm a sua versão; ação "atualizar para a versão nova" por negócio.
- Prazos e prioridade por item (colunas já existem); "Tarefas" no dashboard por responsável; lembretes.
- Templates novos: **Venda** (colocar à venda, fotos comerciais, CPCV de venda, escritura, P&L final), **Due diligence**, **Financiamento**, **Fecho de obra** separado.
- Regras automáticas novas sem migração (só código): ex. "auto fechado até dia 5".
- Bloqueios configuráveis (duro/aviso) por item em Definições.
- Relatório "onde param os negócios" (tempo médio por passo).

---

## Checklist "Novo Negócio" (proposta concreta)

| Secção | Item | Tipo | Obrig. | Regra / nota |
|---|---|---|---|---|
| Registo | Identificação | auto | | nome ou tipologia + freguesia |
| Registo | Morada completa | auto | ✓ | sem "por confirmar" |
| Registo | Preço pedido | auto | ✓ | |
| Registo | Origem | auto | ✓ | |
| Registo | Contacto | auto | ✓ | com telefone |
| Registo | Responsável | auto | | |
| Registo | Próxima ação definida | auto (vivo) | | |
| Qualificação | Contactei o angariador/proprietário | manual | | |
| Qualificação | Visita realizada | manual | | propõe fase Visita |
| Qualificação | Validei a informação com o vendedor | manual | | |
| Qualificação | Analisei a envolvente | manual | | |
| Documentação | Caderneta predial | auto | ✓ | |
| Documentação | Certidão permanente | auto | ✓ | |
| Documentação | Licença de utilização | auto | | N/A se < 1951 |
| Documentação | Certificado energético | auto | | |
| Documentação | Plantas | auto | | |
| Documentação | Fotografias | auto | | |
| Documentação | Documentação verificada | manual | | |
| Análise | Dados do imóvel completos | auto | | área, tipologia, andar, ano, estado |
| Análise | Comparáveis (≥ 3) | auto | ✓ | |
| Análise | Business Plan com cenário ativo | auto | ✓ | |
| Análise | Preço máximo definido | auto | | avisa ao gerar proposta |
| Decisão | Confirmei as condições da negociação | manual | | |
| Decisão | Proposta gerada | auto | | bloqueada até BP + preço máximo |
| Decisão | Proposta enviada | auto | | estado marcado pelo utilizador |
| Decisão | Resultado registado | auto | | aceite / recusada / excluído |
| Compra | Condições de compra registadas | auto | ✓ (em Compra) | valor final + escritura |
| Compra | CPCV carregado | auto | | categoria CPCV |
| Compra | Financiamento tratado | manual | | N/A se LTV = 0 |
| Compra | Comissão de mediação registada | auto | | N/A sem consultor |

## Checklist "Nova Obra" (proposta concreta)

| Secção | Item | Tipo | Obrig. | Regra / nota |
|---|---|---|---|---|
| Criação | Responsável definido | auto | ✓ | |
| Criação | Datas previstas | auto | | início + fim |
| Orçamento | Orçamento criado | auto | ✓ | ≥ 1 linha, total > 0 |
| Orçamento | Capítulos definidos | auto | | |
| Orçamento | Fornecedores atribuídos | auto | | "12 de 15" |
| Orçamento | Orçamento validado com o empreiteiro | manual | | |
| Documentação | Projeto carregado | auto | | |
| Documentação | Orçamento (ficheiro) carregado | auto | | |
| Documentação | Contrato de empreitada carregado | auto | | categoria nova |
| Documentação | Licenciamento tratado | manual | | N/A se não aplicável |
| Execução | Início registado | auto | ✓ | |
| Execução | Primeiro auto fechado | auto | | |
| Execução | Autos em dia | auto (vivo) | | alerta |
| Execução | Faturas registadas | auto | | |
| Controlo | Pagamentos registados | auto | | |
| Controlo | Sem faturas vencidas por pagar | auto (vivo) | | alerta |
| Controlo | Desvio verificado | manual | | |
| Fecho | Autos a 100 % | auto | ✓ (fechar) | |
| Fecho | Todas as faturas pagas | auto | ✓ (fechar) | |
| Fecho | Custos finais confirmados | manual | | |
| Fecho | Fotografias finais | auto | | categoria nova |
| Fecho | Documentação arquivada | manual | | |
| Fecho | Obra concluída | auto | | estado |

---

## Proposta de implementação

| Step | Entrega | Como testar |
|---|---|---|
| 19 | Tabelas + migração 0015; módulo `checklists` (rules.ts, sync, queries); templates em seed; testes das regras; script de backfill para os negócios ativos | `pnpm test` verde; ver checklists criadas para os 22 ativos |
| 20 | Negócio: tab Processo, progresso + próximo passo no cabeçalho, manual/N/A/responsável, links; Histórico mostra os itens | carregar uma caderneta e ver o item passar a ✓ sozinho |
| 21 | Obra: tab Processo e cabeçalho; progresso na lista e no Kanban de negócios; filtro | criar obra e ver a checklist nascer |
| 22 | Bloqueios e avisos (gerar proposta, fases, obra em curso/concluída); cartões no dashboard; Definições → Procedimentos (leitura) | tentar gerar proposta sem BP → mensagem com link |
| 23 (Phase 2) | Editor de procedimentos, versões, prazos/prioridades, template Venda | |

Cada step é uma sessão incremental, como até aqui: ficheiros exatos, comandos, como testar.

## Decisões a validar

1. Tab "Processo" + progresso e próximo passo no cabeçalho (recomendado), ou painel dentro de Resumo.
2. Só três bloqueios duros (gerar proposta; obra em curso; obra concluída). O resto avisos.
3. Itens automáticos não se marcam à mão; só "não aplicável" com nota.
4. As duas listas de itens acima: acrescentar, tirar, renomear, mudar obrigatórios.
5. Regras de contexto: licença N/A antes de 1951; financiamento N/A com LTV 0; comissão N/A sem consultor.
6. Responsável por defeito = responsável do negócio / da obra; alterável por item.
7. Backfill: criar checklists para os 22 negócios ativos agora (ficam com progresso baixo e honesto; marcam-se N/A os passos antigos). Os excluídos ficam sem checklist.
8. Categorias novas: "Contrato de empreitada" e "Fotografias finais".
