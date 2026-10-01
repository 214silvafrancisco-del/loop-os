/**
 * Procedimentos da LOOP Homes como dados (docs/06). O seed e
 * `ensureChecklistSetup` gravam estes templates na base de dados; a partir daí
 * a versão gravada é a que manda. Para alterar um procedimento: editar aqui,
 * subir `version`, e a próxima sincronização cria a versão nova (instâncias
 * existentes mantêm a sua versão).
 *
 * Portas (`gates`): "hard:<porta>" bloqueia; "warn:<porta>" só avisa.
 * Portas usadas: proposal:generate, deal:stage:proposta, deal:stage:compra,
 * project:em_curso, project:concluida.
 */
import type { ChecklistEntityType } from "./schema";

export type TemplateItemDef = {
  code: string;
  section: string;
  label: string;
  help?: string;
  kind: "auto" | "manual";
  ruleKey?: string;
  required?: boolean;
  appliesWhen?: string;
  dependsOn?: string;
  defaultAssignee?: "owner" | "manager";
  gates?: string[];
  linkPath?: string;
};

export type TemplateDef = {
  code: string;
  name: string;
  entityType: ChecklistEntityType;
  version: number;
  items: TemplateItemDef[];
};

export const SECTION_LABELS: Record<string, string> = {
  registo: "Registo",
  qualificacao: "Qualificação",
  documentacao: "Documentação",
  analise: "Análise",
  decisao: "Decisão",
  compra: "Compra",
  criacao: "Criação",
  orcamento: "Orçamento",
  execucao: "Execução",
  controlo: "Controlo financeiro",
  fecho: "Fecho",
  preparacao: "Preparação",
  mercado: "Mercado",
};

const doc = (category: string) => `doc:${category}`;

export const NOVO_NEGOCIO: TemplateDef = {
  code: "novo_negocio",
  name: "Novo Negócio",
  entityType: "deal",
  version: 3,
  items: [
    // Registo
    { code: "registo.identificacao", section: "registo", label: "Identificação", help: "Nome do negócio ou tipologia e freguesia do imóvel.", kind: "auto", ruleKey: "deal.identified", linkPath: "resumo" },
    { code: "registo.morada", section: "registo", label: "Morada completa", help: "Morada, freguesia e concelho, sem \"por confirmar\".", kind: "auto", ruleKey: "deal.address_complete", required: true, gates: ["warn:deal:stage:proposta"], linkPath: "resumo" },
    { code: "registo.preco_pedido", section: "registo", label: "Preço pedido", kind: "auto", ruleKey: "deal.asking_price", required: true, gates: ["hard:proposal:generate"], linkPath: "resumo" },
    { code: "registo.origem", section: "registo", label: "Origem registada", help: "Fonte do negócio (site, consultor, proprietário…).", kind: "auto", ruleKey: "deal.source", required: true, gates: ["warn:deal:stage:proposta"], linkPath: "resumo" },
    { code: "registo.contacto", section: "registo", label: "Contacto registado", help: "Angariador ou proprietário, com telefone.", kind: "auto", ruleKey: "deal.contact", required: true, gates: ["warn:deal:stage:proposta"], linkPath: "resumo" },
    { code: "registo.responsavel", section: "registo", label: "Responsável definido", kind: "auto", ruleKey: "deal.owner", linkPath: "resumo" },
    { code: "registo.proxima_acao", section: "registo", label: "Próxima ação definida", help: "Texto e data no cabeçalho. Volta a pendente quando se conclui a ação.", kind: "auto", ruleKey: "deal.next_action", linkPath: "resumo" },

    // Documentação (auto por categoria de documento)
    { code: "documentacao.caderneta", section: "documentacao", label: "Caderneta predial", kind: "auto", ruleKey: doc("Caderneta predial"), required: true, gates: ["warn:deal:stage:proposta"], linkPath: "documentos?categoria=Caderneta predial" },
    { code: "documentacao.certidao_permanente", section: "documentacao", label: "Certidão permanente", kind: "auto", ruleKey: doc("Certidão permanente"), required: true, gates: ["warn:deal:stage:proposta"], linkPath: "documentos?categoria=Certidão permanente" },
    { code: "documentacao.licenca_utilizacao", section: "documentacao", label: "Licença de utilização", help: "Não aplicável a prédios anteriores a 1951.", kind: "auto", ruleKey: doc("Licença de utilização"), appliesWhen: "needs_licenca", linkPath: "documentos?categoria=Licença de utilização" },
    { code: "documentacao.certificado_energetico", section: "documentacao", label: "Certificado energético", kind: "auto", ruleKey: doc("Certificado energético"), linkPath: "documentos?categoria=Certificado energético" },
    { code: "documentacao.plantas", section: "documentacao", label: "Plantas", kind: "auto", ruleKey: doc("Plantas"), linkPath: "documentos?categoria=Plantas" },
    { code: "documentacao.fotografias", section: "documentacao", label: "Fotografias", kind: "auto", ruleKey: doc("Fotografias"), linkPath: "documentos?categoria=Fotografias" },
    { code: "documentacao.verificada", section: "documentacao", label: "Documentação verificada", help: "Li os documentos e confirmei áreas, ónus e titularidade.", kind: "manual", defaultAssignee: "owner" },

    // Análise
    { code: "analise.dados_imovel", section: "analise", label: "Dados do imóvel completos", help: "Área bruta, tipologia, andar, ano de construção e estado.", kind: "auto", ruleKey: "deal.property_data", linkPath: "resumo" },
    { code: "analise.comparaveis", section: "analise", label: "Comparáveis (mínimo 3)", kind: "auto", ruleKey: "deal.comparables", required: true, linkPath: "analise" },
    { code: "analise.business_plan", section: "analise", label: "Business Plan com cenário ativo", kind: "auto", ruleKey: "deal.business_plan", required: true, gates: ["hard:proposal:generate", "warn:deal:stage:proposta"], linkPath: "business-plan" },
    { code: "analise.preco_maximo", section: "analise", label: "Preço máximo definido", help: "Calculado no Business Plan e aplicado ao negócio.", kind: "auto", ruleKey: "deal.max_price", gates: ["warn:proposal:generate", "warn:deal:stage:proposta"], linkPath: "business-plan" },

    // Decisão
    { code: "decisao.proposta_gerada", section: "decisao", label: "Proposta gerada", kind: "auto", ruleKey: "deal.proposal_generated", dependsOn: "analise.preco_maximo", linkPath: "proposta" },
    { code: "decisao.proposta_enviada", section: "decisao", label: "Proposta enviada", help: "Marca o estado \"enviada\" na proposta depois de a enviares por WhatsApp ou email.", kind: "auto", ruleKey: "deal.proposal_sent", dependsOn: "decisao.proposta_gerada", linkPath: "proposta" },
    { code: "decisao.resultado", section: "decisao", label: "Resultado registado", help: "Proposta aceite ou recusada, ou negócio excluído.", kind: "auto", ruleKey: "deal.outcome", gates: ["warn:deal:stage:compra"], linkPath: "proposta" },

    // Compra
    { code: "compra.condicoes", section: "compra", label: "Condições de compra registadas", help: "Valor final e data de escritura (CPCV opcional).", kind: "auto", ruleKey: "deal.purchase_terms", required: true, appliesWhen: "stage_purchase", linkPath: "resumo" },
    { code: "compra.cpcv", section: "compra", label: "CPCV carregado", kind: "auto", ruleKey: doc("CPCV"), gates: ["warn:deal:stage:compra"], linkPath: "documentos?categoria=CPCV" },
    { code: "compra.financiamento", section: "compra", label: "Financiamento tratado", help: "Só aplicável quando o cenário ativo tem financiamento.", kind: "manual", appliesWhen: "has_financing", defaultAssignee: "owner" },
    { code: "compra.escritura", section: "compra", label: "Escritura registada", help: "Data da escritura preenchida no negócio e já passada.", kind: "auto", ruleKey: "deal.deed_done", appliesWhen: "stage_purchase", linkPath: "resumo" },
  ],
};

export const NOVA_OBRA: TemplateDef = {
  code: "nova_obra",
  name: "Nova Obra",
  entityType: "project",
  version: 4,
  items: [
    // Criação
    { code: "criacao.responsavel", section: "criacao", label: "Responsável definido", kind: "auto", ruleKey: "project.manager", required: true, gates: ["hard:project:em_curso"], linkPath: "resumo" },
    { code: "criacao.datas", section: "criacao", label: "Datas previstas", help: "Início e fim previstos.", kind: "auto", ruleKey: "project.planned_dates", gates: ["warn:project:em_curso"], linkPath: "resumo" },

    // Orçamento
    { code: "orcamento.criado", section: "orcamento", label: "Orçamento criado", help: "Pelo menos uma linha com valor (importar Excel ou criar à mão).", kind: "auto", ruleKey: "project.budget_exists", required: true, gates: ["hard:project:em_curso"], linkPath: "orcamento" },
    { code: "orcamento.fornecedores", section: "orcamento", label: "Fornecedores atribuídos", help: "Todos os capítulos com fornecedor da obra.", kind: "auto", ruleKey: "project.budget_suppliers", linkPath: "orcamento" },
    { code: "orcamento.validado", section: "orcamento", label: "Orçamento validado com o empreiteiro", kind: "manual", defaultAssignee: "manager" },

    // Documentação
    { code: "documentacao.projeto", section: "documentacao", label: "Projeto carregado", kind: "auto", ruleKey: doc("Projeto"), linkPath: "documentos?categoria=Projeto" },

    // Execução
    { code: "execucao.inicio", section: "execucao", label: "Início registado", help: "Estado \"Em curso\" ou data de início real.", kind: "auto", ruleKey: "project.started", required: true, linkPath: "resumo" },
    { code: "execucao.primeiro_auto", section: "execucao", label: "Primeiro auto de medição fechado", kind: "auto", ruleKey: "project.first_measurement", linkPath: "autos" },
    { code: "execucao.autos_em_dia", section: "execucao", label: "Autos em dia", help: "Enquanto a obra está em curso, cada fornecedor por autos tem o auto do mês anterior ou do atual fechado.", kind: "auto", ruleKey: "project.measurements_current", appliesWhen: "project_in_progress", linkPath: "autos" },
    { code: "execucao.faturas", section: "execucao", label: "Faturas registadas", kind: "auto", ruleKey: "project.invoices_exist", linkPath: "faturas" },

    // Controlo financeiro
    { code: "controlo.pagamentos", section: "controlo", label: "Pagamentos registados", kind: "auto", ruleKey: "project.payments_exist", linkPath: "faturas" },
    { code: "controlo.sem_vencidas", section: "controlo", label: "Sem faturas vencidas por pagar", kind: "auto", ruleKey: "project.no_overdue", linkPath: "faturas" },
    { code: "controlo.desvio", section: "controlo", label: "Desvio face ao orçamento verificado", kind: "manual", defaultAssignee: "manager" },

    // Fecho
    { code: "fecho.sem_rascunhos", section: "fecho", label: "Sem autos em rascunho", kind: "auto", ruleKey: "project.no_draft_measurements", gates: ["hard:project:concluida"], linkPath: "autos" },
    { code: "fecho.autos_100", section: "fecho", label: "Autos a 100 %", help: "Cada fornecedor por autos com o acumulado igual ao orçamentado.", kind: "auto", ruleKey: "project.measurements_complete", gates: ["warn:project:concluida"], linkPath: "autos" },
    { code: "fecho.faturas_pagas", section: "fecho", label: "Todas as faturas pagas", kind: "auto", ruleKey: "project.invoices_paid", gates: ["warn:project:concluida"], linkPath: "faturas" },
    { code: "fecho.custos_finais", section: "fecho", label: "Custos finais confirmados", kind: "manual", defaultAssignee: "manager" },
    { code: "fecho.fotografias_finais", section: "fecho", label: "Fotografias finais carregadas", kind: "auto", ruleKey: doc("Fotografias finais"), gates: ["warn:project:concluida"], linkPath: "documentos?categoria=Fotografias finais" },
    { code: "fecho.documentacao", section: "fecho", label: "Documentação arquivada", kind: "manual", defaultAssignee: "manager" },
    { code: "fecho.concluida", section: "fecho", label: "Obra concluída", kind: "auto", ruleKey: "project.completed", linkPath: "resumo" },
  ],
};

/** Procedimento «Venda» (Step 26b): curto e quase todo automático. */
export const NOVA_VENDA: TemplateDef = {
  code: "nova_venda",
  name: "Venda",
  entityType: "sale",
  version: 1,
  items: [
    // Preparação
    { code: "preparacao.responsavel", section: "preparacao", label: "Responsável definido", kind: "auto", ruleKey: "sale.owner", linkPath: "resumo" },
    { code: "preparacao.mediadora", section: "preparacao", label: "Mediadora definida", help: "Venda direta sem mediadora: marca «não aplicável».", kind: "auto", ruleKey: "sale.agency", linkPath: "resumo" },
    { code: "preparacao.certificado", section: "preparacao", label: "Certificado energético", kind: "auto", ruleKey: doc("Certificado energético"), linkPath: "documentos?categoria=Certificado energético" },
    { code: "preparacao.fotografias", section: "preparacao", label: "Fotografias finais carregadas", kind: "auto", ruleKey: doc("Fotografias finais"), linkPath: "documentos?categoria=Fotografias finais" },
    // Mercado
    { code: "mercado.anunciado", section: "mercado", label: "Preço e data de anúncio", kind: "auto", ruleKey: "sale.listed", required: true, linkPath: "resumo" },
    { code: "mercado.link", section: "mercado", label: "Link do anúncio", kind: "auto", ruleKey: "sale.listing_url", linkPath: "resumo" },
    { code: "mercado.primeiro_lead", section: "mercado", label: "Primeiro lead registado", kind: "auto", ruleKey: "sale.first_lead", linkPath: "leads" },
    { code: "mercado.proposta", section: "mercado", label: "Proposta recebida", kind: "auto", ruleKey: "sale.offer", linkPath: "leads" },
    // Fecho
    { code: "fecho.cpcv", section: "fecho", label: "CPCV assinado", help: "Data do CPCV no Resumo.", kind: "auto", ruleKey: "sale.cpcv", linkPath: "resumo" },
    { code: "fecho.cpcv_doc", section: "fecho", label: "CPCV de venda carregado", kind: "auto", ruleKey: doc("CPCV de venda"), linkPath: "documentos?categoria=CPCV de venda" },
    { code: "fecho.comprador", section: "fecho", label: "Comprador registado", kind: "auto", ruleKey: "sale.buyer", linkPath: "resumo" },
    { code: "fecho.escritura", section: "fecho", label: "Escritura de venda registada", help: "Fase «Vendido» com preço final e data.", kind: "auto", ruleKey: "sale.deed", required: true, linkPath: "resumo" },
    { code: "fecho.escritura_doc", section: "fecho", label: "Escritura de venda carregada", kind: "auto", ruleKey: doc("Escritura de venda"), appliesWhen: "sale_closed", linkPath: "documentos?categoria=Escritura de venda" },
    { code: "fecho.custos_reais", section: "fecho", label: "Custos reais confirmados", help: "Detenção e financiamento reais no Resumo; obra pelas faturas.", kind: "auto", ruleKey: "sale.real_costs", appliesWhen: "sale_closed", linkPath: "resumo" },
    { code: "fecho.resultado", section: "fecho", label: "Resultado fechado e revisto", help: "P&L revisto na tab Resultado.", kind: "manual", appliesWhen: "sale_closed", defaultAssignee: "owner" },
  ],
};

export const CHECKLIST_TEMPLATES: TemplateDef[] = [NOVO_NEGOCIO, NOVA_OBRA, NOVA_VENDA];

/** Categorias de documento que os procedimentos usam e que não existiam no seed inicial. */
export const CHECKLIST_DOCUMENT_CATEGORIES: { group: string; name: string; defaultEntity: "project" | "sale" }[] = [
  { group: "juridico", name: "Contrato de empreitada", defaultEntity: "project" },
  { group: "tecnico", name: "Fotografias finais", defaultEntity: "project" },
  { group: "juridico", name: "CPCV de venda", defaultEntity: "sale" },
  { group: "juridico", name: "Escritura de venda", defaultEntity: "sale" },
];
