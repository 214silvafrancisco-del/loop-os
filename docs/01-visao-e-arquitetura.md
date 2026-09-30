# LOOP Homes OS — Visão e Arquitetura (v0.1, 2026-09-29)

Documento de produto e arquitetura. Sem código. Para validar antes de implementar.

## Decisões validadas (registo)

| Data | Decisão |
|---|---|
| 2026-09-29 | Hosting de produção: Supabase Free (DB + Auth) + Cloudflare R2 (documentos) + VPS Hetzner com Coolify (app). Backups por cron `pg_dump` → R2/OneDrive. Storage atrás de adaptador; app em Docker. Custo ~€5/mês. |
| 2026-09-29 | Fases do pipeline mantêm-se como no Notion: Lead Fria → Lead Morna → Visita → Proposta → Compra. Sem campo de prioridade. |
| 2026-09-29 | Negócios descartados ficam apenas "Excluído" (status), sem motivo de perda. |
| 2026-09-29 | O Imóvel nasce com o Negócio (estado `prospect`). |
| 2026-09-29 | Business Plan cria por defeito dois cenários: "Ato Contínuo" e "Remodelação". |
| 2026-09-29 | Cedência de posição e investidores privados ficam fora do âmbito (não modelar por agora). |
| 2026-09-29 | Documentos: arquivar só a partir de agora; a migração não importa documentos históricos (apenas os 7 BP Excel anexados no Notion). |
| 2026-09-29 | Volume esperado ~1 GB por negócio comprado. R2 gratuito cobre ~10 compras; fotografias comprimidas no upload. |
| 2026-09-29 | Propostas fazem-se hoje por WhatsApp. O gerador produz PDF e também texto curto "Copiar para WhatsApp". Sem exemplo existente: layout desenhado de raiz com a identidade LOOP. |
| 2026-09-29 | A proposta sai em nome de "LOOP Homes", sem representante nem assinatura manuscrita. |
| 2026-09-29 | "Estudo de mercado" = folha Avaliações (comparáveis). Confirmado no MVP como tab Análise. |
| 2026-09-29 | Obra com vários fornecedores (empreiteiro, carpinteiro, caixilheiro, materiais comprados pela LOOP): fornecedor por linha de orçamento. |
| 2026-09-29 | Controlo por **auto de medição** mensal (% concluída por rubrica). Coluna "Contratado" cai; entra "Executado" calculado a partir dos autos. |
| 2026-09-29 | Faturas recebidas em PDF; registar fatura **e** pagamentos (tabela própria, permite parciais). |
| 2026-09-29 | Materiais comprados diretamente entram como linhas próprias do orçamento. Não existem despesas sem fatura: todo o custo real passa por fatura. |
| 2026-09-29 | A obra começa sempre depois da escritura: "Criar Obra" só com fase Compra e `deed_date` preenchida. |
| 2026-09-29 | 3 utilizadores no arranque (1 admin + 2). Fornecedores nunca entram na app. |
| 2026-09-29 | Identidade: logótipo colocado em `Brand/` (JPEG). Cores e tipografia derivam dele; pedir SVG/PNG com fundo transparente antes do PDF. |
| 2026-09-29 | A LOOP compra sempre como empresa com **isenção de IMT para revenda** (art. 7.º CIMT). BP: `imt_regime = isento` por defeito; alerta aos 3 anos após escritura (revenda obrigatória ou IMT devido). IS 0,8% continua a aplicar-se. |
| 2026-09-29 | Não existem outras bases Notion nem Excel de controlo recorrentes fora dos BP e orçamentos. Migração = só a base Negócios. |
| 2026-09-29 | Compras já feitas: Emília das Neves (Benfica) e Gonçalves Crespo (Amadora) entram com obra na app (orçamento e faturas carregados no arranque); Bordalo Pinheiro, 9 de Abril e Machado de Castro entram só como negócio/imóvel comprado. |
| 2026-09-29 | Histórico do negócio = audit log filtrado pelo imóvel (sem tabela de atividades). |
| 2026-09-29 | Faturas **não** se repartem por rubricas: comparam-se com o total do auto; a soma das faturas compara-se com o orçamentado. |
| 2026-09-29 | Autos de medição fechados são imutáveis; correções vão no auto seguinte. |
| 2026-09-29 | A % do auto serve só para calcular o valor total do auto. Sem coluna "Contratado". |
| 2026-09-29 | Arquitetura validada. Fase 6 (implementação) pode começar pelo Step 01. |

---

## 0. O que já existe (análise dos ficheiros na pasta)

### Notion — base "Negócios" (216 registos, 21 ativos, 5 comprados)
| Propriedade Notion | Valores reais | Mapeamento na app |
|---|---|---|
| Score | Lead Fria 65, Lead Morna 45, Visita 62, Proposta 39, Compra 5 | `deal.stage_id` (mesmas 5 fases) |
| Status | Ativo 21, Excluido 194 | `deal.status` (ativo/excluído) + `excluded_at` |
| Fonte | Sites 123, Consultor 58, Proprietário 19, Placa de Rua 3, Investidor 2 | `deal.source_channel` (configurável) |
| Nome / Contacto | nome + telefone do angariador/consultor | `contacts` + `deal.source_contact_id` |
| Link | URL Idealista/agência (103 preenchidos) | `deal.listing_url` |
| Prox Ação / Date | texto livre + data | `deal.next_action`, `deal.next_action_date` |
| Morada, Freguesia, Andar, Tipologia, Preço | Andar inclui "Prédio", "CV", "RC" | `property.*` + `deal.asking_price` |
| Files & media | BP_*.xlsx (7) | `documents` (categoria Financeiro → Business Plan) |
| Data | data de criação | `deal.created_at` |

Conclusões: o "Score" é o pipeline e mantém-se tal como está; o campo "Próxima ação + data" é o coração do follow-up e tem de estar no MVP; "Prédio" implica que a entidade Imóvel suporta prédios inteiros e não só frações.

### Business Plan Excel (BP_Benficat4)
Folhas: **Avaliações** (4 comparáveis, €/m², homogeneização: negociação, área, localização, idade, conservação, outros → €/m² médio → valor de venda), **Compra&Revenda** (Cenário 1 "Ato Contínuo" vs Cenário 2 "Remodelação"), **IMT** (tabelas HPP e HS 2026, variantes "Cedência de Posição" e "Investidores Privados").

Blocos do Compra&Revenda, que a app deve replicar 1:1:
1. Venda: valor estimado de venda.
2. Custos de aquisição: VPT, valor de compra, finalidade (Isento / Própria / Secundária → IMT por tabela sobre max(compra, VPT)), IS, escritura/DPA, registos, CPCV.
3. Custos de financiamento: % financiada, prazo, TAN, comissões (dossier, avaliação, formalização), IS 0,6% sobre financiado, registo de hipoteca, prestação (PMT).
4. Custos de obra: orçamento, método €/m² por tipologia (T1 25k, T2 35k, T3 45k; €600/m²), IVA 6% se ARU senão 23%, financiamento da obra com tranches.
5. Custos de manutenção (holding): meses de retenção × (seguros, condomínio, eletricidade, água) + juros (CUMIPMT).
6. Custos de venda: comissão % + IVA 23%, CPCV venda, penalização por amortização antecipada 0,5%.
7. Impostos: Empresa (IRC 19%) vs Particular (IRS 48% sobre 50%).

Resultados: capitais próprios necessários, todos os custos, lucro bruto, lucro depois de impostos, duração (meses), retorno total, cash-on-cash, retorno anualizado.

### Orçamento de obra Excel (Orçamento Amadora V1.1)
Folhas: RESUMO, Orçamento (mapa de quantidades: Capítulo → Subcapítulo → Artigo com Qtd, un (vg/un/m²), Unitário, Total; valores sem IVA), medição (P. iguais × comp × larg × altura), verificações. Capítulos usados: Demolições e apoio CC, Cozinha, Instalações sanitárias, Portas, Canalizações, Eletricidade, Pintura e pladur, Pavimento, Logística.

---

## 1. Visão da aplicação

**LOOP OS**: o sistema operativo interno da LOOP Homes. Um único registo por imóvel acompanha todo o ciclo: oportunidade → análise → proposta → compra → obra → venda → P&L. Cada fase acrescenta informação ao mesmo imóvel em vez de criar cópias.

Princípios:
- **Uma verdade por imóvel.** Documentos, números e histórico ligados ao `property_id`.
- **Simples todos os dias.** Pipeline, próxima ação e Business Plan em 3 cliques.
- **Modular.** Cada módulo é uma pasta autónoma; novos módulos entram sem tocar nos outros.
- **Cálculo automático, decisão humana.** A app calcula; nunca envia propostas nem paga faturas.
- **Preparada para IA.** Dados estruturados e auditáveis, para no futuro responder a perguntas em linguagem natural.

## 2. Arquitetura dos módulos

```
CORE (transversal)                DOMÍNIO (MVP)               DOMÍNIO (futuro)
├── auth / users / roles          ├── properties (Imóveis)    ├── sales (Vendas)
├── settings (listas config.)     ├── deals (Negócios)        ├── finance (Financeiro)
├── documents (sistema documental)│   ├── business-plan       ├── suppliers (Fornecedores)
├── contacts (Contactos)          │   └── proposals           ├── tasks / calendar
├── audit-log                     ├── projects (Obras)        ├── reporting / analytics
└── pdf-engine + templates        │   ├── budget              ├── crm (comercial)
                                  │   └── invoices            └── ai-assistant
                                  └── dashboard
```

Estrutura de código (Next.js App Router):
```
src/
  app/(auth)/login, reset-password
  app/(app)/dashboard | deals | deals/[id]/(resumo|analise|business-plan|documentos|proposta|notas|historico)
            | properties | projects | projects/[id]/(resumo|orcamento|faturas|documentos) | contacts | settings
  modules/<modulo>/   schema.ts (Drizzle) · queries.ts · actions.ts · validation.ts · components/ · calc/ (se aplicável)
  core/  auth · db · storage · documents · audit · pdf · ui (shadcn) · lib
```
Regra: um módulo importa de `core/` e dos seus próprios ficheiros; nunca dos componentes de outro módulo (só dos seus `queries`/`types` públicos).

## 3. Fluxo principal do negócio

```
Lead Fria → Lead Morna → Visita → Proposta (BP + avaliação + PDF) → Compra
   (em qualquer fase: status = Excluído, sai do pipeline ativo, fica pesquisável)
Compra → [Criar Obra] → Obra (orçamento, faturas) → Concluída → [Colocar à venda] → Venda → P&L real vs BP
```
Fases configuráveis em Definições (tabela `deal_stages`), mas o MVP arranca com estas cinco.
- O **Imóvel** é criado no momento em que o negócio é criado (dados físicos vão logo para lá). Estado do imóvel: `prospect → owned → for_sale → sold`.
- Ao passar a **Compra**: registam-se valor final, data de escritura, custos reais de aquisição; o imóvel passa a `owned`; a ação "Criar Obra" fica disponível.
- **Referência partilhada**: `LH-0042` é a referência do imóvel; negócio, obra e venda mostram a mesma referência (Negócio LH-0042, Obra LH-0042).

## 4. Entidade Property (Imóvel)

Representa o bem físico. Nunca duplicado.
- Identificação: `id`, `ref` (LH-0001), `property_type` (apartamento, prédio, moradia, loja, terreno), `status` (prospect/owned/for_sale/sold), `name`.
- Localização: `address_line`, `postal_code`, `parish` (freguesia), `municipality` (concelho), `district`, `lat`, `lng`.
- Características: `typology` (T0…T6, ou n.º frações para prédio), `gross_area`, `net_area`, `floor` (RC, CV, 1…), `floors_count`, `has_elevator`, `has_garage`, `parking_spaces`, `has_balcony`, `has_terrace`, `has_yard`, `bedrooms`, `bathrooms`, `condition` (para obras / habitável / remodelado), `construction_year`, `energy_class`.
- Fiscal/registral (usado pelo BP e pela proposta): `vpt`, `is_aru` (zona ARU → IVA 6%), `matrix_article`, `fraction`, `land_registry_description`, `land_registry_office`.
- `notes`, `created_at`, `updated_at`, `created_by`.

## 5. Entidade Deal (Negócio)

Oportunidade de aquisição sobre um imóvel.
- `id`, `ref` (herda do imóvel), `property_id` (FK), `name`, `stage_id` (FK `deal_stages`: Lead Fria / Lead Morna / Visita / Proposta / Compra), `status` (ativo/excluído), `excluded_at`, `owner_user_id`, `tags[]`, `entered_at`.
- Origem: `source_channel` (Sites/Consultor/Proprietário/Placa de rua/Investidor…, configurável), `source_contact_id` (FK contacts), `listing_url`, `source_commission_pct`, `source_notes`.
- Follow-up: `next_action`, `next_action_date` (aparece no dashboard "Ações desta semana").
- Financeiro inicial (resumo, os detalhes vivem no BP): `asking_price`, `target_price`, `max_price`, `estimated_works`, `estimated_sale_price`; e cache de resultados do cenário base: `bp_profit`, `bp_margin`, `bp_roi`, `bp_roe`, `bp_annualized` (recalculados ao guardar o BP, para listar/ordenar/filtrar sem recomputar).
- Compra (preenchido ao passar a Compra): `final_price`, `cpcv_date`, `deed_date`, `actual_acquisition_costs`.
- Sub-entidades: `deal_notes` (notas com autor/data), `deal_activity` (histórico automático: mudanças de estado, uploads, propostas geradas), `business_plans`, `proposals`, `documents`.

## 6. Entidade Project (Obra)

- `id`, `ref` (herda), `property_id`, `deal_id`, `name`, `status` (planeamento/a iniciar/em curso/pausada/concluída/cancelada), `manager_user_id`, `planned_start`, `actual_start`, `planned_end`, `actual_end`, `notes`.
- **Orçamento** (`budget_lines`, hierárquico como o teu mapa de quantidades): `project_id`, `parent_id` (capítulo → subcapítulo → artigo), `code` (1.1.1), `category_id` (FK `budget_categories`, configurável), `description`, `supplier_id` (empreiteiro, carpinteiro, caixilheiro, loja de materiais…), `quantity`, `unit` (vg/un/m²/ml), `unit_price`, `budgeted` (qty × unit, sem IVA), `vat_rate`, `sort`. Só os artigos (folhas da árvore) têm valores; capítulos somam.
- **Autos de medição** (`measurement_reports`): `project_id`, `number`, `period_month`, `date`, `status` (rascunho/fechado), `notes`. Linhas (`measurement_lines`): `report_id`, `budget_line_id`, `pct_cumulative` (0–100), `amount_cumulative` (pct × budgeted), `amount_period` (diferença face ao auto anterior). Ao fechar um auto a app pré-preenche o seguinte com as percentagens atuais. Uma revisão de orçamento (linhas novas ou preços alterados) fica registada no audit log e reflete-se nos autos seguintes.
- **Faturas** (`invoices`): `project_id`, `supplier_id`, `number`, `issue_date`, `due_date`, `description`, `net_amount`, `vat_rate`, `vat_amount`, `total`, `document_id` (PDF), `measurement_report_id` (opcional: a fatura do empreiteiro liga-se ao auto que a justifica), `notes`. Sem repartição por rubricas (decisão 2026-09-29): a fatura compara-se com o total do auto, e a soma das faturas compara-se com o orçamentado. Status derivado: por pagar / parcialmente pago / pago / em atraso (por `due_date`).
- **Pagamentos** (`payments`): `invoice_id`, `date`, `amount`, `method` (transferência/MB/cartão), `reference`, `document_id` (comprovativo, opcional), `notes`. Permite adiantamentos e pagamentos parciais.
- Controlo Orçamento vs Real em três totais: **Orçamentado** (soma do mapa; disponível por capítulo e por fornecedor) / **Executado** (soma dos autos fechados; por capítulo) / **Faturado** e **Pago** (totais e por fornecedor) / **Por pagar** / **Desvio = faturado − orçamentado**. Alertas: fatura ligada a um auto com valor diferente do auto; faturado total > executado total.
- Não existem despesas sem fatura: todo o custo real de obra entra por fatura. Os materiais comprados pela LOOP são linhas próprias do orçamento com o fornecedor da loja.

## 7. Estrutura dos Documents

Um sistema documental único, partilhado por todas as entidades.
- `documents`: `id`, `property_id` (sempre, para a vista consolidada do imóvel), `entity_type` (property/deal/project/sale/invoice/proposal), `entity_id`, `category_id`, `name`, `description`, `doc_date`, `tags[]`, `status` (ativo/substituído/arquivado), `current_version_id`, `created_by`, `created_at`.
- `document_versions`: `document_id`, `version_no`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `uploaded_by`, `uploaded_at`, `note`.
- `document_categories` (configurável): `code`, `name`, `group` (Imóvel/Jurídico/Financeiro/Técnico/Comercial), `default_entity_type`, `sort`.
- `document_requirements` (Phase 2, checklist): `category_id`, `applies_to_stage`, `required` → a app calcula "em falta".
- Storage: bucket privado `documents/`, caminho `properties/{property_id}/{entity_type}/{document_id}/v{n}/{file}`. Acesso por URLs assinadas com expiração. Preview no browser para PDF e imagens; download para os restantes.
- Fotografias (JPG/PNG/HEIC) são redimensionadas no browser antes do upload (lado maior 2500 px, qualidade 85%) e guardam-se com uma miniatura; o original só se o utilizador pedir "manter original". Objetivo: ~1 GB por negócio comprado.
- Sem importação de documentos históricos: o arquivo começa com a app.
- Vista do imóvel mostra todos os documentos agrupados por categoria e origem (do negócio, da obra, da venda), sem duplicar ficheiros.

## 8. Estrutura do Business Plan

Replica o Excel atual e prepara cenários e IRR.
- `business_plans`: `deal_id` (1:1), `active_scenario_id`, `notes`.
- `bp_scenarios`: `business_plan_id`, `name`, `kind` (ato_continuo/remodelacao/custom), `is_active`, e os **inputs** em colunas tipadas. Ao criar o BP a app cria automaticamente os dois cenários "Ato Contínuo" (sem obra, retenção curta) e "Remodelação" (com obra), como no Excel; o utilizador pode acrescentar outros. Cedência de posição e investidores privados ficam fora do âmbito.
  - Aquisição: `purchase_price`, `vpt`, `imt_regime` (isento/HPP/HS), `stamp_duty_pct` (0,8%), `deed_cost`, `registration_cost`, `cpcv_cost`, `acquisition_commission`, `other_acquisition`.
  - Obra: `works_budget`, `works_vat_pct` (6% ARU / 23%), `contingency_pct`, `architecture`, `licenses`, `supervision`, `other_works`.
  - Financiamento: `ltv_pct`, `interest_rate` (TAN), `term_years`, `bank_fees` (dossier, avaliação, formalização), `mortgage_registration`, `stamp_duty_financing_pct` (0,6%), `works_financed_pct`, `tranches`.
  - Detenção: `holding_months`, `insurance_month`, `condo_month`, `utilities_month`, `imi`, `other_holding`.
  - Venda: `sale_price`, `sale_commission_pct`, `commission_vat_pct`, `marketing`, `early_repayment_pct`, `other_sale`.
  - Impostos: `tax_regime` (empresa/particular), `irc_pct`, `irs_pct`.
  - Timeline: `acquisition_date`, `works_start`, `works_months`, `works_end`, `listing_date`, `sale_date`.
- **Motor de cálculo**: módulo TypeScript puro (`modules/business-plan/calc/`) com funções `calcImt(base, tabela)`, `pmt`, `cumipmt`, `calcScenario(inputs) → outputs`. Corre no browser (feedback instantâneo) e no servidor (snapshot ao guardar). Testado com os valores do teu Excel.
- **Outputs** (guardados em `bp_scenarios` como snapshot): investimento total, capital próprio, financiamento, custo total, receita, lucro bruto, imposto, lucro líquido, margem, ROI, ROE (cash-on-cash), retorno anualizado, lucro/m², break-even (preço de venda para lucro 0), duração em meses. IRR: campo previsto, implementação Phase 2 (a partir da timeline).
- **Tabelas de IMT** em `settings` (`imt_brackets`: ano, regime, de, até, taxa, parcela a abater), editáveis sem código.
- **Avaliação por comparáveis** (`bp_comparables`): `business_plan_id`, `source_url`, `price`, `area`, `floor`, `elevator`, `condition`, ajustes (`negotiation`, `area`, `location`, `age`, `condition`, `other`) → €/m² homogeneizado → média → valor de venda sugerido (botão "usar no cenário").

## 9. Estrutura do Proposal Generator

- `proposal_templates`: `code` (proposta-compra, carta-intencao, proposta-financiamento…), `name`, `version`, `layout_key` (componente React-PDF registado), `default_terms` (texto), `is_active`.
- `proposals`: `deal_id`, `template_id`, `number` (P-2026-014), `version_no`, `status` (rascunho/gerada/enviada/aceite/recusada, estados marcados manualmente), `offer_price`, `deadline_days`, `validity_days`, `conditions` (texto), `observations`, `data_snapshot` (JSON com todos os dados usados), `document_id` (PDF gerado nos Documentos, categoria Jurídico → Proposta), `whatsapp_text` (versão curta gerada), `generated_at`. Assinatura: apenas "LOOP Homes" (configurável em Definições).
- Fluxo: no submenu Proposta escolhe-se template, o valor vem pré-preenchido com sugestões (máximo do BP, target), o utilizador ajusta e tem dois botões: "Gerar PDF" e "Copiar texto para WhatsApp". Revê e envia por fora da app. A app **nunca envia**.
- Cada template define os dois formatos (PDF e texto), para o conteúdo ser sempre coerente. Como não existe modelo atual, o layout é desenhado de raiz com a identidade LOOP (logo, cores e texto base a definir no grupo 4).
- Templates: componentes React-PDF em `modules/proposals/templates/` que recebem `data_snapshot` e um objeto `brand` (logo, cores, assinatura). Trocar o layout = criar novo componente e registá-lo.

## 10. Estrutura financeira

Três camadas, da estimativa ao real:
1. **Estimado**: Business Plan (por cenário).
2. **Comprometido**: negócio comprado (valor final + custos reais de aquisição) + orçamento de obra (orçamentado) + execução medida (autos).
3. **Real**: faturas e pagamentos + custos de detenção registados + venda real (Phase 2 `sales`).

`property_pnl` (view SQL): por imóvel, compara BP ativo vs real: aquisição, obra, detenção, venda, lucro, margem, ROI. No MVP, a coluna "real" cobre aquisição e obra; venda entra na Phase 2.

Fornecedores no MVP são `contacts` com `type = fornecedor` (com NIF). O módulo Fornecedores futuro acrescenta contratos, encomendas e avaliação sem migrar dados.

## 11. Relações entre entidades

```
users ─┬─ deals.owner_user_id / projects.manager_user_id / documents.created_by / audit_log
       │
properties 1 ─── n deals ─── 1 business_plans ─── n bp_scenarios
    │                │                        └── n bp_comparables
    │                ├── n proposals ── 1 proposal_templates
    │                ├── n deal_notes, n deal_activity
    │                └── source_contact_id → contacts
    ├── n projects ─┬─ n budget_lines (árvore) ── budget_categories, supplier_id → contacts
    │               ├─ n measurement_reports ── n measurement_lines → budget_lines
    │               └─ n invoices ── supplier_id → contacts, measurement_report_id (opcional)
    │                     └── n payments
    ├── n documents ── n document_versions ── document_categories
    └── n sales (Phase 2)
settings: deal_stages, source_channels, budget_categories, document_categories, imt_brackets, tags
```
Cardinalidades chave: um imóvel pode ter vários negócios ao longo do tempo (perdido hoje, volta daqui a um ano); um negócio tem um BP com vários cenários; uma obra por compra (a app permite várias por imóvel para o futuro).

## 12. Stack tecnológica recomendada

| Camada | Recomendação | Alternativas consideradas | Porquê |
|---|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Remix, SvelteKit, Vite+Express | Um só projeto para UI e backend (Server Actions/Route Handlers), ecossistema enorme, o que o Claude Code melhor conhece. |
| UI | **Tailwind CSS + shadcn/ui** | MUI, Mantine, Chakra | Componentes copiados para o repo (controlo total do look LOOP), rápido, acessível, responsivo. |
| Tabelas/estado | TanStack Table + TanStack Query; dnd-kit (Kanban); react-hook-form + zod | AG Grid (pago/pesado) | Leve, tipado, gratuito. |
| Base de dados | **PostgreSQL via Supabase** | Postgres self-hosted (Hetzner), Neon, Firebase | Postgres real (views, triggers, RLS), Auth e Storage integrados, backups, painel SQL. Firebase dificulta relações e P&L. |
| ORM/migrações | **Drizzle ORM + drizzle-kit** | Prisma, SQL puro | SQL-first, leve, migrações versionadas, funciona bem com RLS e views. Prisma é mais pesado e abstrai demais o SQL. |
| Auth | **Supabase Auth** (email+password, reset, MFA opcional) | Auth.js, Clerk | Integrado com RLS; sem custo extra; convites por email. |
| Storage | **Cloudflare R2** (bucket privado, URLs assinadas, API S3) atrás de um adaptador `core/storage` | Supabase Storage, S3 | 10 GB gratuitos e sem custo de tráfego; depois ~€0,015/GB/mês. O adaptador permite trocar de fornecedor por configuração. |
| PDF | **@react-pdf/renderer** | Playwright/Puppeteer (HTML→PDF), pdfmake, Gotenberg | Templates são componentes React, sem Chromium. Se um dia quisermos layouts muito complexos, adicionamos Playwright só para esses. |
| Hosting | **VPS Hetzner (CX22) + Coolify**, app em Docker | Vercel, Railway | ~€4/mês, deploy automático por git push via Coolify, HTTPS automático. A imagem Docker corre igual em Vercel/Railway se um dia quisermos mudar. |
| Base de dados (plano) | **Supabase Free** enquanto chegar (500 MB DB, sem backups geridos) | Supabase Pro €25/mês | Backups próprios: cron noturno `pg_dump` → R2 + cópia OneDrive. Subir para Pro só se quisermos backups geridos/PITR. |
| Qualidade | ESLint, Prettier, Vitest (motor de cálculo), Playwright (fluxos críticos) | | |

Custos indicativos (decisão 2026-09-29, opção económica): VPS ~€4/mês + R2 €0 até 10 GB + Supabase Free = **~€5/mês**. Contrapartida: ~1h/mês de manutenção do VPS (atualizações, verificar backups). Alternativa gerida (Supabase Pro + Vercel Pro) ficaria em €45–60/mês sem manutenção; a mudança é só de configuração.

Complexidade/escalabilidade: esta stack serve confortavelmente até dezenas de utilizadores e centenas de milhares de registos. Se a LOOP crescer para várias equipas, adiciona-se `organization_id` (já previsto) e nada muda.

## 13. Arquitetura técnica

- **Camadas**: UI (Server Components para leitura, Client Components para interação) → Server Actions (validação zod, autorização) → `queries`/`actions` do módulo (Drizzle) → Postgres. Motor de cálculo do BP em TS puro, partilhado.
- **Segurança**: RLS em todas as tabelas (utilizador autenticado + role), Storage privado, secrets só em `.env.local`/Vercel env, `service_role` nunca no cliente, rate-limit nos route handlers públicos (login/reset).
- **Autorização**: `profiles.role` (admin/manager/user) + tabela `permissions` (módulo × ação) para poder criar perfis novos sem código.
- **Audit log**: trigger Postgres genérico grava `audit_log(table, row_id, action, old, new, user_id, at)` nas tabelas de domínio; alimenta o submenu Histórico.
- **Multi-organização**: `organization_id` em todas as tabelas de domínio desde o dia 1 (uma organização apenas, mas evita reconstruir).
- **Backups**: cron noturno no VPS faz `pg_dump` da base Supabase e envia para o R2 (retenção 30 dias) e para uma pasta OneDrive; teste de restauro trimestral. Os ficheiros já vivem no R2 (durabilidade gerida pela Cloudflare); cópia mensal do bucket para OneDrive como segunda linha.
- **Ficheiros**: validação de tipo/tamanho no upload (25 MB por defeito), nomes normalizados, DWG aceite como download (sem preview).
- **IA (futuro)**: dados relacionais limpos + `documents` com texto extraído (`document_text`, Phase 2/3) permitem RAG e queries em linguagem natural via Claude API.

## 14. MVP (o que entra)

1. Login, logout, reset password, convite de utilizadores, roles admin/manager/user.
2. Dashboard básico: contagens por fase, pipeline total (soma asking price), ações da semana (next_action_date), obras em curso, faturas por pagar/em atraso.
3. Negócios: criar/editar/excluir (status), lista com pesquisa, filtros (fase, status, freguesia/concelho, tipologia, fonte, responsável, tags) e ordenação; Kanban com as 5 fases (Lead Fria, Lead Morna, Visita, Proposta, Compra) e drag&drop; ficha com tabs Resumo | Análise (avaliação por comparáveis) | Business Plan | Documentos | Proposta | Notas | Histórico.
4. Imóveis: criados com o negócio; lista e ficha com dados físicos, documentos consolidados, negócios/obras associados.
5. Business Plan: dois cenários por defeito ("Ato Contínuo" e "Remodelação") lado a lado como no Excel, todos os blocos, IMT automático por tabela configurável, resultados em tempo real; cenários extra a pedido.
6. Documentos: upload (PDF, JPG, PNG, DOCX, XLSX, ZIP, DWG), categorias configuráveis, versões, preview PDF/imagem, download, substituir, eliminar, pesquisa e filtros; em Negócio, Imóvel e Obra.
7. Proposta: 1 template "Proposta de aquisição" com saída em PDF e em texto para WhatsApp, versões, PDF guardado nos documentos.
8. Obras: "Criar Obra" a partir de negócio com escritura; ficha; orçamento hierárquico com fornecedor por linha; autos de medição mensais (imutáveis depois de fechados); faturas com PDF ligadas opcionalmente a um auto; pagamentos parciais; controlo em totais Orçamentado/Executado/Faturado/Pago/Desvio, com detalhe por capítulo (orçamentado, executado) e por fornecedor (orçamentado, faturado, pago).
9. Contactos: pessoas e empresas (consultor, proprietário, fornecedor, banco…), com NIF, ligados a negócios e faturas.
10. Definições: fases, fontes, categorias de orçamento e de documentos, tabelas IMT, utilizadores.
11. Importação Notion: script de importação controlada (dry-run + relatório) dos 216 negócios e dos BP em Excel como documentos.

## 15. Phase 2
Cenários Downside/Upside com análise de sensibilidade; IRR e cash-flow mensal; checklist documental e "documentos em falta"; módulo Vendas (venda real, P&L fechado); Fornecedores (contratos, encomendas, histórico de preços); folha de medições (quantidades por comp × larg × alt) a alimentar o orçamento; PDF do auto de medição para o empreiteiro; fotografias e timeline de obra; tarefas e calendário; notificações (email) de próximas ações e faturas a vencer; extração de texto de documentos; OCR de faturas; exportações Excel; integração de email (Gmail/Outlook) para arquivar comunicações no negócio; mapa com os negócios.

## 16. Phase 3 — IA
Assistente sobre os dados da LOOP (Claude API): "que documentos faltam", "preço máximo para 30% ROI" (resolve o BP ao contrário), pesquisa em linguagem natural sobre negócios e obras, resumo semanal automático, leitura de anúncios (URL → pré-preenchimento do negócio), leitura de faturas e cadernetas prediais para preencher campos, sugestão de comparáveis.

## 17. Plano de desenvolvimento (passo a passo)

| Step | Entrega | Como testar |
|---|---|---|
| 01 | Criar projeto Next.js + Tailwind + shadcn, estrutura de pastas, layout com sidebar (Dashboard, Negócios, Obras, Imóveis, Contactos, Definições) | app abre com sidebar vazia |
| 02 | Supabase (projeto, `.env.local`), Drizzle, migração 0001 (organizations, profiles, settings base) | `drizzle-kit migrate` sem erros |
| 03 | Autenticação: login, logout, reset, convite; roles; RLS base | login funciona, rotas protegidas |
| 04 | Módulo Contactos (necessário para fonte e fornecedores) | criar/listar contacto |
| 05 | Entidade Property + ficha | criar imóvel |
| 06 | Entidade Deal + criação conjunta com imóvel + lista com pesquisa/filtros | criar negócio, ver na lista |
| 07 | Pipeline Kanban + mudança de fase + próxima ação + Dashboard v1 | arrastar cartão, ver dashboard |
| 08 | Ficha do negócio com tabs, Notas, Histórico (audit log) | mudar fase e ver no histórico |
| 09 | Business Plan: motor de cálculo (com testes contra o Excel) + UI do cenário Base + tabelas IMT em Definições | valores iguais ao BP_Benficat4 |
| 10 | Análise: avaliação por comparáveis | €/m² médio igual ao Excel |
| 11 | Documentos: upload, categorias, versões, preview, filtros (Negócio + Imóvel) | upload de uma caderneta |
| 12 | Proposta: template + geração PDF + versões | PDF gerado e arquivado |
| 13 | Obras: "Criar Obra", ficha, estados | obra criada a partir de negócio com escritura |
| 14 | Orçamento hierárquico + categorias + fornecedor por linha | reproduzir Orçamento Amadora (22.000 €) |
| 15 | Autos de medição mensais | fechar um auto e ver Executado por capítulo |
| 16 | Faturas + alocação + pagamentos + controlo orçamento vs real | inserir fatura parcialmente paga e ver desvio |
| 17 | Importação Notion (dry-run, relatório, importação) + validação | 216 negócios importados sem duplicados |
| 18 | Deploy: Dockerfile, VPS Hetzner + Coolify, domínio + HTTPS, R2 em produção, cron de backups, revisão de segurança | acesso por URL, 2 utilizadores, backup restaurado com sucesso |
| 19 | Checklists de processo (docs/06): tabelas, regras automáticas, templates Novo Negócio / Nova Obra, sincronização, backfill | `pnpm test` verde; `pnpm checklists:sync` cria as checklists dos negócios ativos |
| 20 | Negócio: tab Processo, progresso + próximo passo no cabeçalho, itens manuais / N/A / responsável, Histórico | carregar uma caderneta e ver o item concluir-se sozinho |
| 21 | Obra: tab Processo; progresso na lista e no Kanban de negócios; filtro | criar obra e ver a checklist nascer |
| 22 | Portas (gerar proposta, fases, obra em curso/concluída), cartões no dashboard, Definições → Procedimentos (leitura) | gerar proposta sem BP → mensagem com link |

Cada step é uma sessão curta: ficheiros indicados, comandos, teste, resultado esperado.

## 18. Importação do Notion (resumo)

1. Exportar do Notion: menu da base → Export → "Markdown & CSV", "Include subpages" e "Include files" (o zip atual já traz CSV + anexos; faltam as páginas de cada negócio se tiverem conteúdo).
2. Ficheiros a fornecer: o zip completo de cada base (Negócios e outras que existam), mais os Excel que vivem fora do Notion.
3. Mapeamento: tabela na secção 0; cada linha CSV gera 1 imóvel + 1 negócio (+ 1 contacto se Nome/Contacto preenchidos).
4. Duplicados: chave `morada normalizada + freguesia`; contactos por telefone normalizado; relatório de colisões antes de importar.
5. Transformação: Preço "€210,000.00" → numérico; Score → fase + prioridade; Status Excluido → Arquivado/Perdido; "Prédio" em Andar → `property_type = prédio`.
6. Documentos: só os 7 BP Excel anexados no Notion vão para o Storage, ligados ao negócio (categoria Financeiro → Business Plan). Restante documentação histórica não é importada.
7. Validação: contagens por fase iguais ao Notion, amostra de 10 negócios comparados campo a campo, relatório de linhas ignoradas. O Notion mantém-se intocado até validação.
