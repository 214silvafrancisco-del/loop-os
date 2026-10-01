# LOOP OS — Data model (v0.1, 2026-09-29)

PostgreSQL (Supabase). Tabelas, campos, tipos, chaves, índices e constraints. Sem código de migração ainda.

## 0. Convenções

- Nomes de tabelas e colunas em inglês, `snake_case`; labels na UI em português. Plural para tabelas.
- PK: `id uuid default gen_random_uuid()`. FKs com `on delete restrict` salvo indicação; `on delete cascade` só para filhos sem vida própria (versões, linhas, alocações).
- Colunas comuns em todas as tabelas de domínio: `organization_id uuid not null` (FK), `created_at timestamptz default now()`, `updated_at timestamptz` (trigger), `created_by uuid` (FK profiles), `updated_by uuid`. Soft delete onde indicado: `deleted_at timestamptz`.
- Dinheiro: `numeric(14,2)` em euros. Percentagens: `numeric(7,4)` como fração (0.0650 = 6,5 %). Áreas: `numeric(10,2)`. Datas sem hora: `date`.
- Listas fixas: `enum` Postgres. Listas configuráveis pelo utilizador: tabela própria.
- Referências: `properties.ref` = `LH-` + 4 dígitos, gerada por trigger a partir de `organizations.next_property_seq`. Negócios, obras e vendas mostram a ref do imóvel; um segundo negócio no mesmo imóvel mostra `LH-0042·2` (`deals.seq`).
- Valores calculados (executado, faturado, pago, resultados do BP) não se editam à mão: vêm de views ou são recalculados por código ao guardar, nunca introduzidos pelo utilizador.

## 1. Enums

| Enum | Valores |
|---|---|
| `user_role` | admin, manager, user |
| `property_type` | apartamento, predio, moradia, loja, terreno, outro |
| `property_status` | prospect, owned, for_sale, sold |
| `property_condition` | para_obras, habitavel, remodelado, novo |
| `deal_status` | active, excluded |
| `contact_kind` | person, company |
| `contact_role` | consultor, proprietario, fornecedor, banco, advogado, arquiteto, outro |
| `scenario_kind` | ato_continuo, remodelacao, custom |
| `imt_regime` | isento, hpp, hs |
| `tax_regime` | empresa, particular |
| `proposal_status` | draft, generated, sent, accepted, rejected |
| `project_status` | planeamento, a_iniciar, em_curso, pausada, concluida, cancelada |
| `measurement_status` | draft, closed |
| `payment_method` | transferencia, mb, cartao, numerario, outro |
| `document_entity` | property, deal, project, sale, invoice, proposal, measurement_report |
| `document_status` | active, superseded, archived |
| `audit_action` | insert, update, delete |

## 2. Core

### organizations
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text not null | "LOOP Homes" |
| nif | text | |
| address | text | |
| next_property_seq | int default 1 | contador para `LH-xxxx` |
| next_proposal_seq | int default 1 | contador por ano (reset por código) |
| settings | jsonb default '{}' | assinatura da proposta, condições predefinidas, IVA por defeito, ajuste de área, ROE alvo |
| created_at | timestamptz | |

### profiles (1:1 com `auth.users` do Supabase)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| organization_id | uuid FK | |
| full_name | text not null | |
| email | text not null unique | |
| role | user_role not null default 'user' | |
| is_active | bool default true | desativar sem apagar |
| avatar_url | text | |
| created_at, updated_at | timestamptz | |

### role_permissions
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| role | user_role not null | |
| module | text not null | deals, properties, projects, invoices, documents, contacts, settings, users |
| can_view, can_create, can_edit, can_delete, can_export | bool | |
| UNIQUE (organization_id, role, module) | | semente: admin tudo; manager tudo exceto users/settings; user view+create+edit sem delete/export |

### audit_log
| Coluna | Tipo | Notas |
|---|---|---|
| id | bigserial PK | |
| organization_id | uuid | |
| table_name | text not null | |
| row_id | uuid not null | |
| property_id | uuid | preenchido pelo trigger quando a linha tem `property_id` ou `deal_id`/`project_id` resolúvel, para o Histórico do negócio |
| action | audit_action not null | |
| changed_fields | text[] | só os campos alterados |
| old_data, new_data | jsonb | |
| user_id | uuid | de `auth.uid()` ou `current_setting('app.user_id')` |
| at | timestamptz default now() | |
| INDEX (table_name, row_id), INDEX (property_id, at desc) | | |

### Tabelas de configuração (todas com `organization_id`, `name text not null`, `sort int`, `is_active bool default true`, `created_at`)
- **deal_stages**: + `color text`, `is_purchase bool default false` (só uma por organização: índice único parcial), `is_default bool` (Lead Fria). Semente: Lead Fria, Lead Morna, Visita, Proposta, Compra.
- **source_channels**: semente Sites, Consultor, Proprietário, Placa de rua, Investidor, Outro.
- **budget_categories**: + `code text`. Semente na secção 3.15 do doc 02.
- **document_categories**: + `group text not null` (imovel, juridico, financeiro, tecnico, comercial), `default_entity document_entity`. Semente: Caderneta predial, Certidão permanente, Certidão matricial, Licença de utilização, Certificado energético, Plantas, Ficha técnica, Fotografias (imóvel) · CPCV, Contrato compra e venda, Procuração, Documentos dos proprietários, Proposta (jurídico) · Avaliação, Proposta bancária, Simulação, Financiamento, Business Plan, Fatura, Comprovativo de pagamento (financeiro) · Levantamento, Projeto, Orçamento, Relatório, Auto de medição, Fotografias de obra (técnico) · Fotografias comerciais, Brochura, Estudo de mercado (comercial) · Outros em cada grupo.
- **tags**: + `color text`. UNIQUE (organization_id, name).
- **imt_brackets**: `year int`, `regime imt_regime` (hpp, hs), `lower numeric(14,2)`, `upper numeric(14,2) null`, `rate numeric(7,4)`, `deduction numeric(14,2)`. UNIQUE (organization_id, year, regime, lower). Semente: tabelas 2026 do Excel.

## 3. Contactos

### contacts
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| kind | contact_kind not null | |
| name | text not null | |
| roles | contact_role[] not null default '{}' | um contacto pode ser consultor e proprietário |
| company_name | text | agência ou empresa |
| phone | text | como escrito |
| phone_normalized | text | E.164, gerado por trigger; índice para duplicados |
| email | text | |
| nif | text | obrigatório se `'fornecedor' = any(roles)` (check) |
| address | text | |
| iban | text | opcional, para fornecedores |
| notes | text | |
| deleted_at | timestamptz | |
| INDEX (organization_id, phone_normalized), INDEX (organization_id, nif), trigram em name | | |

## 4. Imóveis

### properties
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| ref | text not null | `LH-0001`, trigger; UNIQUE (organization_id, ref) |
| property_type | property_type not null default 'apartamento' | |
| status | property_status not null default 'prospect' | |
| name | text | opcional, ex. "T2 Charquinho" |
| address_line | text not null | |
| address_normalized | text | lower, sem acentos/pontuação, trigger; para deteção de duplicados |
| postal_code | text | formato 0000-000 (check regex) |
| parish | text | freguesia |
| municipality | text | concelho |
| district | text | |
| lat, lng | numeric(9,6) | |
| typology | text | T0…T6, "Prédio 4 frações" |
| gross_area, net_area | numeric(10,2) | |
| floor | text | RC, CV, 1, 2… |
| floors_count | int | |
| has_elevator, has_garage, has_balcony, has_terrace, has_yard | bool | |
| parking_spaces | int | |
| bedrooms, bathrooms | int | |
| condition | property_condition | |
| construction_year | int | check 1800–2100 |
| energy_class | text | A+…F |
| vpt | numeric(14,2) | valor patrimonial tributário |
| is_aru | bool default false | zona ARU → IVA obra 6 % |
| matrix_article | text | artigo matricial |
| fraction | text | |
| land_registry_description | text | n.º descrição predial |
| land_registry_office | text | conservatória |
| notes | text | |
| deleted_at | timestamptz | |
| INDEX (organization_id, status), INDEX (organization_id, address_normalized), trigram em address_line | | |

## 5. Negócios

### deals
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| property_id | uuid FK properties not null | |
| seq | int not null default 1 | n.º do negócio dentro do imóvel; UNIQUE (property_id, seq) |
| name | text | por defeito = tipologia + freguesia |
| stage_id | uuid FK deal_stages not null | |
| status | deal_status not null default 'active' | |
| excluded_at | timestamptz | |
| owner_user_id | uuid FK profiles | responsável |
| entered_at | date not null default current_date | |
| source_channel_id | uuid FK source_channels | |
| source_contact_id | uuid FK contacts | |
| listing_url | text | |
| source_commission_pct | numeric(7,4) | |
| source_notes | text | |
| next_action | text | |
| next_action_date | date | |
| asking_price | numeric(14,2) | |
| target_price | numeric(14,2) | |
| max_price | numeric(14,2) | |
| estimated_works | numeric(14,2) | |
| estimated_sale_price | numeric(14,2) | |
| final_price | numeric(14,2) | ao passar a Compra |
| cpcv_date | date | |
| deed_date | date | escritura; obrigatória para criar obra |
| actual_acquisition_costs | numeric(14,2) | IS + escritura + registos + comissão reais |
| imt_resale_deadline | date | gerado: deed_date + 3 anos, quando regime isento |
| active_scenario_id | uuid | FK bp_scenarios (deferrable) |
| bp_profit_net, bp_margin, bp_roi, bp_roe, bp_annualized, bp_equity | numeric | cache do cenário ativo, escritos pelo código ao guardar o BP |
| deleted_at | timestamptz | |
| INDEX (organization_id, status, stage_id), INDEX (organization_id, next_action_date) WHERE status='active', INDEX (property_id), INDEX (owner_user_id) | | |

### deal_tags
`deal_id uuid FK cascade`, `tag_id uuid FK`, PK (deal_id, tag_id).

### deal_notes
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| deal_id | uuid FK cascade | |
| body | text not null | |
| is_pinned | bool default false | |
| created_by, created_at, updated_at | | |
| INDEX (deal_id, created_at desc) | | |

Histórico do negócio = `audit_log` filtrado por `property_id` (inclui imóvel, BP, propostas, documentos e obra do mesmo imóvel).

## 6. Business Plan

### business_plans
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| deal_id | uuid FK not null UNIQUE | 1:1 |
| notes | text | |
| created_at, updated_at | | |

### bp_scenarios
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| business_plan_id | uuid FK cascade | |
| name | text not null | UNIQUE (business_plan_id, name) |
| kind | scenario_kind not null | |
| sort | int | |
| **Venda** | | |
| sale_price | numeric(14,2) | |
| sale_commission_pct | numeric(7,4) default 0.05 | |
| commission_vat_pct | numeric(7,4) default 0.23 | |
| sale_cpcv_cost | numeric(14,2) default 0 | |
| marketing_cost | numeric(14,2) default 0 | |
| early_repayment_pct | numeric(7,4) default 0.005 | |
| **Aquisição** | | |
| purchase_price | numeric(14,2) | |
| vpt | numeric(14,2) | copiado do imóvel, editável |
| imt_regime | imt_regime default 'isento' | |
| imt_override | numeric(14,2) | se preenchido substitui o cálculo |
| stamp_duty_pct | numeric(7,4) default 0.008 | |
| deed_cost | numeric(14,2) default 500 | |
| registration_cost | numeric(14,2) default 225 | |
| cpcv_cost | numeric(14,2) default 0 | |
| acquisition_commission | numeric(14,2) default 0 | |
| other_acquisition | numeric(14,2) default 0 | |
| **Financiamento do imóvel** | | |
| ltv_pct | numeric(7,4) default 0 | |
| term_years | int default 40 | |
| interest_rate | numeric(7,4) default 0.04 | TAN |
| fee_dossier, fee_valuation, fee_formalization | numeric(14,2) | 300 / 250 / 700 |
| stamp_duty_financing_pct | numeric(7,4) default 0.006 | |
| mortgage_registration | numeric(14,2) default 250 | |
| **Obra** | | |
| works_method | text default 'manual' | manual / per_m2 |
| works_budget | numeric(14,2) | sem IVA |
| works_cost_per_m2 | numeric(14,2) | quando per_m2 |
| works_vat_pct | numeric(7,4) | 0.06 se `is_aru` senão 0.23; editável |
| contingency_pct | numeric(7,4) default 0 | |
| architecture_cost, licenses_cost, supervision_cost, other_works | numeric(14,2) default 0 | |
| works_financed_pct | numeric(7,4) default 0 | |
| works_term_years | int default 40 | |
| works_interest_rate | numeric(7,4) default 0.04 | |
| works_fee_dossier, works_fee_formalization, works_mortgage_registration | numeric(14,2) | |
| works_tranches | int default 2 | × 150 € |
| **Detenção** | | |
| holding_months | int not null default 6 | |
| insurance_month, condo_month, electricity_month, water_month | numeric(14,2) | |
| imi | numeric(14,2) default 0 | |
| other_holding | numeric(14,2) default 0 | |
| **Impostos** | | |
| tax_regime | tax_regime default 'empresa' | |
| irc_pct | numeric(7,4) default 0.19 | |
| irs_pct | numeric(7,4) default 0.48 | sobre 50 % |
| **Timeline** | | |
| acquisition_date, works_start, works_end, listing_date, sale_date | date | |
| works_months | int | |
| **Outputs (snapshot, escritos pelo motor)** | | |
| out_total_investment, out_equity, out_financing, out_total_cost, out_revenue, out_gross_profit, out_tax, out_net_profit | numeric(14,2) | |
| out_margin, out_roi, out_roe, out_annualized, out_irr | numeric(9,6) | irr null no MVP |
| out_profit_per_m2, out_break_even_price | numeric(14,2) | |
| out_calc_version | text | versão do motor que gerou o snapshot |
| calculated_at | timestamptz | |
| created_at, updated_at | | |

Regra: os inputs são a verdade; os `out_*` são cache. Se `out_calc_version` ≠ versão atual do motor, a app recalcula ao abrir.

### bp_comparables
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| business_plan_id | uuid FK cascade | |
| sort | int | |
| source_url | text | |
| price | numeric(14,2) not null | |
| area | numeric(10,2) not null | check > 0 |
| floor | text | |
| has_elevator | bool | |
| condition | property_condition | |
| adj_negotiation, adj_area, adj_location, adj_age, adj_condition, adj_other | numeric(7,4) default 0 | adj_area calculado por defeito, editável |
| notes | text | |
| is_included | bool default true | excluir da média sem apagar |

`business_plans` guarda ainda `reference_m2_idealista`, `reference_m2_maxwork`, `reference_m2_consultant numeric(14,2)` e `valuation_m2 numeric(14,2)` (média calculada, cache).

## 7. Propostas

### proposal_templates
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| code | text not null | UNIQUE (organization_id, code); ex. `proposta-aquisicao` |
| name | text not null | |
| layout_key | text not null | nome do componente React-PDF registado |
| pdf_defaults | jsonb | condições predefinidas, textos fixos |
| whatsapp_template | text | com placeholders `{{morada}}`, `{{valor}}`, `{{prazo}}`, `{{validade}}` |
| is_active | bool | |

### proposals
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| deal_id | uuid FK not null | |
| template_id | uuid FK not null | |
| number | text not null | `P-2026-014`; UNIQUE (organization_id, number) |
| version_no | int not null default 1 | UNIQUE (deal_id, number, version_no) |
| status | proposal_status default 'draft' | |
| offer_price | numeric(14,2) not null | |
| deadline_days | int | prazo para escritura |
| validity_days | int | |
| conditions | text | |
| observations | text | |
| data_snapshot | jsonb not null | tudo o que foi impresso |
| whatsapp_text | text | |
| document_id | uuid FK documents | PDF |
| generated_at, sent_at, decided_at | timestamptz | |
| created_by, created_at | | |
| INDEX (deal_id, created_at desc) | | |

## 8. Obras

### projects
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| property_id | uuid FK not null | |
| deal_id | uuid FK not null | check por código: deal na fase de compra com `deed_date` |
| name | text not null | |
| status | project_status default 'planeamento' | |
| manager_user_id | uuid FK profiles | |
| planned_start, actual_start, planned_end, actual_end | date | |
| notes | text | |
| deleted_at | timestamptz | |
| INDEX (organization_id, status), INDEX (property_id) | | |

### project_suppliers (Step 23, 2026-09-30)
Fornecedores da obra, preenchidos em cada obra (não nos Contactos). Reutilizam-se de obras anteriores por cópia.

| Coluna | Notas |
|---|---|
| project_id | cascade |
| name, kind, nif, phone, email, notes | `name` único por obra; `kind` livre (Empreiteiro, Carpinteiro…) |
| control_mode | enum `autos` (autos de medição mensais) / `fatura` (as faturas comparam-se com o orçamentado) |
| contact_id | ligação opcional a um contacto |
| sort | ordem |

`budget_lines.project_supplier_id`: o fornecedor define-se no capítulo e copia-se para todas as linhas dele. `measurement_reports.project_supplier_id` (obrigatório, único por fornecedor e mês). `invoices.project_supplier_id` (obrigatório; número único por fornecedor). As colunas `supplier_id` → contactos foram removidas (migrações 0016/0017).

### budget_lines (árvore)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK cascade | |
| parent_id | uuid FK budget_lines | null = capítulo |
| depth | int not null | 0 capítulo, 1 subcapítulo, 2 artigo; check 0–2 |
| code | text | "1.1.1", gerado a partir da posição, editável |
| sort | int not null | |
| category_id | uuid FK budget_categories | obrigatório em capítulos, herdado abaixo |
| description | text not null | |
| supplier_id | uuid FK contacts | só em artigos |
| quantity | numeric(12,3) | só em artigos |
| unit | text | vg, un, m², ml, m³, h |
| unit_price | numeric(14,4) | |
| budgeted | numeric(14,2) | = quantity × unit_price, trigger; capítulos: soma dos filhos (view) |
| vat_rate | numeric(7,4) default 0.23 | |
| notes | text | |
| deleted_at | timestamptz | |
| INDEX (project_id, parent_id, sort) | | |
| Check: valores (quantity, unit_price, supplier_id) só quando depth = 2 | | |

### measurement_reports (autos de medição)
Desde o Step 24 há dois tipos (`kind`): `trabalho` (trabalho executado no mês, % por artigo) e `adiantamento` (corresponde à fatura de adiantamento; `advance_pct` guarda a fração, ex. 0.33, `total_period` o valor). A fatura ligada a um auto tem o líquido calculado: adiantamento = valor do auto; trabalho = valor × (1 − % do último auto de adiantamento fechado do fornecedor, ou 0). Cálculo puro em `measurements/advance.ts`. O índice único fornecedor+mês só se aplica a autos de trabalho.

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK cascade | |
| number | int not null | UNIQUE (project_id, number) |
| period_month | date not null | primeiro dia do mês; UNIQUE (project_id, period_month) |
| report_date | date not null | |
| status | measurement_status default 'draft' | fechado = imutável (trigger bloqueia update das linhas) |
| notes | text | |
| document_id | uuid FK documents | PDF assinado, opcional |
| created_by, created_at, closed_at | | |

### measurement_lines
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| report_id | uuid FK cascade | |
| budget_line_id | uuid FK not null | só artigos |
| pct_cumulative | numeric(5,4) not null | 0–1, check |
| amount_cumulative | numeric(14,2) | = pct × budgeted no momento do fecho (snapshot) |
| amount_period | numeric(14,2) | = cumulative − cumulative do auto anterior |
| UNIQUE (report_id, budget_line_id) | | |

### invoices
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| project_id | uuid FK not null | |
| supplier_id | uuid FK contacts not null | |
| number | text not null | UNIQUE (supplier_id, number) |
| issue_date | date not null | |
| due_date | date | |
| description | text | |
| net_amount | numeric(14,2) not null | |
| vat_rate | numeric(7,4) | |
| vat_amount | numeric(14,2) not null | |
| total | numeric(14,2) not null | check = net + vat (tolerância 0,01) |
| measurement_report_id | uuid FK | opcional |
| document_id | uuid FK documents | PDF |
| notes | text | |
| deleted_at | timestamptz | |
| INDEX (project_id, issue_date desc), INDEX (organization_id, due_date) | | |

Estado da fatura é derivado na view: `paid` se soma pagamentos ≥ total; `partial` se > 0; `overdue` se por pagar e `due_date < hoje`; senão `unpaid`.

Sem tabela de repartição por rubricas (decisão 2026-09-29). A fatura liga-se, no máximo, a um auto de medição; o controlo por capítulo é feito com orçamentado e executado, e o controlo por fornecedor com orçamentado (linhas do fornecedor), faturado e pago.

### payments
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK cascade | |
| paid_on | date not null | |
| amount | numeric(14,2) not null | check > 0 |
| method | payment_method | |
| reference | text | |
| document_id | uuid FK documents | comprovativo |
| notes | text | |
| created_by, created_at | | |
| Trigger: soma dos pagamentos não pode exceder `total` | | |

## 8b. Checklists de processo (Step 19, 2026-09-30)

Procedimentos da LOOP Homes como dados, ligados aos dados reais (ver `06-processos-e-checklists.md`). Regras automáticas em código (`src/modules/checklists/rules.ts`), templates em `templates.ts` gravados por `ensureChecklistSetup`.

### checklist_templates
| Coluna | Tipo | Notas |
|---|---|---|
| id, organization_id | | |
| code | text | `novo_negocio`, `nova_obra` |
| name | text | |
| entity_type | enum checklist_entity | deal, project |
| version | int | versão nova = linha nova; só a mais recente fica ativa |
| is_active, trigger | | trigger `on_create` |

### checklist_template_items
| Coluna | Notas |
|---|---|
| template_id, code, section, label, help, sort | `code` único por template |
| kind | enum auto / manual |
| rule_key | chave da regra (só auto); `doc:<categoria>` verifica documentos |
| is_required | conta para as portas |
| applies_when | condição de contexto (falsa → não aplicável) |
| depends_on_code | item que tem de estar concluído antes (bloqueado, derivado) |
| default_assignee | owner (negócio) / manager (obra) |
| gates | text[]: `hard:<porta>` bloqueia, `warn:<porta>` avisa |
| link_path | onde se resolve, relativo à ficha |

### checklists (instância)
| Coluna | Notas |
|---|---|
| template_id, template_version, entity_type, entity_id | única por entidade |
| property_id | para o Histórico |
| done_count, total_count, progress | contadores (excluem não aplicáveis) para listas e Kanban |
| synced_at | última sincronização |

### checklist_items
| Coluna | Notas |
|---|---|
| checklist_id, template_item_id, code, section, sort, kind, is_required | copiados do template |
| status | enum pending / done / not_applicable |
| source | enum auto / manual / context |
| detail | "12 de 15", "último: 2026-08" |
| completed_at, completed_by, na_note | quem e quando |
| assignee_user_id, due_date, priority | prazos/prioridade sem UI no MVP |

Triggers: `set_updated_at`, `checklist_items_audit` (o `audit_trigger()` resolve imóvel e organização pela checklist; contadores e `detail` ignorados). Sincronização: `syncChecklist()` (`sync.ts`) ao abrir a ficha e depois das ações; script `pnpm checklists:sync` para todos.

## 9. Documentos

### documents
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| property_id | uuid FK not null | sempre; para a vista consolidada |
| entity_type | document_entity not null | |
| entity_id | uuid not null | |
| category_id | uuid FK document_categories | |
| name | text not null | |
| description | text | |
| doc_date | date | |
| status | document_status default 'active' | |
| current_version_id | uuid | FK document_versions (deferrable) |
| created_by, created_at, updated_at | | |
| deleted_at | timestamptz | soft delete; purga do storage após 30 dias por job |
| INDEX (property_id), INDEX (entity_type, entity_id), INDEX (category_id), trigram em name | | |

### document_tags
`document_id`, `tag_id`, PK composta.

### document_versions
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| document_id | uuid FK cascade | |
| version_no | int not null | UNIQUE (document_id, version_no) |
| storage_key | text not null | caminho no bucket R2 |
| file_name | text not null | original |
| mime_type | text not null | lista permitida: pdf, jpeg, png, heic, docx, xlsx, zip, dwg |
| size_bytes | bigint not null | check ≤ 50 MB (configurável) |
| checksum_sha256 | text | deteção de ficheiro repetido |
| thumbnail_key | text | para imagens/PDF |
| uploaded_by, uploaded_at | | |
| note | text | "versão assinada" |

### document_requirements (Phase 2, criada já vazia)
`organization_id`, `category_id`, `applies_to` (deal/project), `from_stage_id`, `is_required`.

## 10. Vendas (Phase 2, definida, não criada no MVP)
`sales`: property_id, deal_id, buyer_contact_id, listing_date, cpcv_date, deed_date, listing_price, sale_price, commission, other_costs, status. Alimenta `v_property_pnl`.

## 11. Views

| View | Conteúdo |
|---|---|
| `v_deal_list` | deals + property (morada, freguesia, tipologia, piso) + stage + source + owner + cache BP; base da lista/Kanban |
| `v_budget_line_totals` | por linha: budgeted (folhas ou soma de filhos), executed_pct e executed (último auto fechado) |
| `v_project_summary` | por obra: orçamentado, executado (soma dos autos fechados), faturado, pago, por pagar, desvio; e as mesmas somas por categoria (orçamentado, executado) e por fornecedor (orçamentado, faturado, pago) |
| `v_invoice_status` | invoices + paid_amount + status derivado |
| `v_property_pnl` | por imóvel: BP ativo (out_*) vs real (final_price + custos reais + faturado obra + pagamentos + venda quando existir) |
| `v_dashboard` | contagens e somas por fase, ações da semana, faturas por pagar/em atraso, alertas IMT |

## 12. Triggers e funções

- `set_updated_at()` em todas as tabelas.
- `assign_property_ref()` antes de insert em properties.
- `normalize_contact_phone()`, `normalize_property_address()`.
- `compute_budget_line_amount()` (budgeted = qty × price).
- `lock_closed_measurement()` impede alterar linhas de auto fechado.
- `check_payments_total()`.
- `audit_trigger()` genérico em: properties, deals, deal_notes, business_plans, bp_scenarios, bp_comparables, proposals, projects, budget_lines, measurement_reports, measurement_lines, invoices, payments, documents, document_versions, contacts.
- `set_property_status_on_purchase()`: quando deal passa para a fase `is_purchase`, property.status = owned; se sair dessa fase, volta a prospect (só se não houver obra).

## 13. Segurança (RLS)

- Todo o acesso a dados é feito pelo servidor Next.js (Server Actions e Route Handlers). O browser nunca fala diretamente com o Postgres nem com o R2.
- Ligação via Drizzle com um role de aplicação (não superuser). Cada transação começa com `set_config('app.user_id', …)` e `set_config('app.org_id', …)`; as políticas RLS e o audit trigger leem daí. RLS é a segunda linha de defesa: mesmo com um bug no código, ninguém lê fora da sua organização.
- Políticas: `organization_id = current_setting('app.org_id')::uuid` em todas as tabelas; delete só para admin/manager via `role_permissions`; `profiles` só edita o próprio ou admin.
- Ficheiros: `storage_key` nunca é exposto; o servidor verifica permissão e devolve URL assinada de 15 minutos. Upload por URL assinada de escrita, também gerada pelo servidor, com limite de tamanho e tipo.
- Secrets: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (só servidor), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, em `.env.local` e no Coolify. Nunca no repositório (`.gitignore` desde o Step 01).

## 14. Índices de pesquisa

Extensão `pg_trgm` com índices GIN em `properties.address_line`, `properties.parish`, `contacts.name`, `documents.name`, `deals.name`. A pesquisa global (⌘K) usa `ILIKE` com trigram; suficiente para dezenas de milhares de registos.

## 10. Notificações (M6, 2026-10-01)

### push_subscriptions
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| user_id | uuid FK profiles | on delete cascade |
| endpoint | text not null | UNIQUE; URL do serviço de push do browser |
| p256dh, auth | text not null | chaves da subscrição (Web Push) |
| user_agent | text | |
| created_at, last_seen_at | timestamptz | |

Um registo por dispositivo. Sem trigger de auditoria (dados técnicos). Quando o serviço de push responde 404/410 a linha é apagada no envio seguinte. O resumo diário (`sendDailyDigest`) agrupa por organização e envia a todos os utilizadores ativos com subscrição.
