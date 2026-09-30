# LOOP OS — Navegação, páginas e user flows (v0.1, 2026-09-29)

Complementa `01-visao-e-arquitetura.md`. Define cada página (objetivo, informação, ações, componentes, filtros) e os fluxos principais. Sem código.

---

## 1. Identidade visual (derivada do logótipo em `Brand/`)

| Token | Valor | Uso |
|---|---|---|
| `ink` | #262626 (preto quente do wordmark) | texto principal, sidebar, botões primários |
| `loop-orange` | #F97B22 (laranja da casa) | ação principal, destaques, estado "Compra", KPIs positivos |
| `canvas` | #F7F4EF (off-white do fundo) | fundo da app em modo claro |
| `surface` | #FFFFFF | cartões, tabelas |
| `muted` | #8A8580 | texto secundário, labels |
| `line` | #E6E1DA | bordas |
| `success` / `warning` / `danger` | #2E9E5B / #E0A400 / #D64545 | pago / em atraso / desvio negativo |

Tipografia: wordmark é uma geométrica arredondada; para a interface uso **Inter** (UI, números tabulares) e **Poppins** ou similar só em títulos e no PDF da proposta, para ecoar o logótipo. Modo escuro previsto desde o início (tokens CSS), não obrigatório no MVP.

Princípios de UI: densidade média (muita informação numérica sem parecer banco), cantos arredondados 8–12 px, sombras suaves, uma cor de ação (laranja) e o resto neutro. Mobile: sidebar vira barra inferior com 5 ícones; tabelas viram cartões; Kanban vira lista por fase com swipe.

Pedido: colocar em `Brand/` o logótipo em SVG ou PNG com fundo transparente (versões horizontal e só o símbolo da casa) antes do Step 12 (PDF).

## 2. Mapa de navegação

```
/login  /reset-password  /invite/[token]

/dashboard
/deals                          lista | kanban  (toggle)
/deals/new
/deals/[id]                     → redireciona para /deals/[id]/resumo
/deals/[id]/processo           checklist do procedimento (Step 20)
/deals/[id]/resumo
/deals/[id]/analise             comparáveis
/deals/[id]/business-plan       cenários lado a lado
/deals/[id]/documentos
/deals/[id]/proposta
/deals/[id]/notas
/deals/[id]/historico
/properties
/properties/[id]                resumo | documentos | negócios & obras
/projects
/projects/[id]/resumo
/projects/[id]/processo        checklist do procedimento (Step 21)
/projects/[id]/orcamento
/projects/[id]/autos
/projects/[id]/faturas          faturas + pagamentos
/projects/[id]/documentos
/contacts
/contacts/[id]
/settings                       geral | utilizadores | fases | fontes | categorias orçamento | categorias documentos | IMT | tags
/settings/procedimentos         checklists de processo (leitura, Step 22)
```

Sidebar (desktop): Dashboard · Negócios · Obras · Imóveis · Contactos · (separador) · Definições. Futuro: Vendas, Financeiro, Fornecedores, Documentos, Reporting, Tarefas, Calendário, CRM entram como itens novos sem alterar os existentes.

Barra superior: pesquisa global (⌘K: negócios, imóveis, contactos, documentos por nome), botão "+ Novo negócio", avatar com logout.

## 3. Páginas

### 3.1 Login / Reset / Convite
- Objetivo: entrar com email + password; recuperar password; aceitar convite e definir password.
- Componentes: formulário simples com logótipo; mensagens de erro claras; sem registo público (só por convite de admin).

### 3.2 Dashboard
- Objetivo: em 10 segundos saber o que precisa de ação hoje.
- Informação: (a) **Ações desta semana**: negócios com `next_action_date` até domingo, ordenados por data, atrasados a vermelho; (b) **Pipeline**: contagem e soma do preço pedido por fase (Lead Fria, Lead Morna, Visita, Proposta, Compra); (c) **Obras em curso**: por obra, Orçamentado / Executado / Faturado / Pago e desvio; (d) **Faturas por pagar** e **em atraso** (total e lista curta); (e) **Alertas**: IMT revenda a expirar (escritura + 3 anos < 6 meses), propostas geradas sem estado atualizado há 14 dias.
- Ações: clicar em qualquer item abre a ficha; marcar próxima ação como feita diretamente da lista.
- Componentes: cartões KPI, lista de ações, mini-tabela de obras, gráfico de barras do pipeline (simples).
- Filtros: responsável (todos / eu).

### 3.3 Negócios — lista
- Objetivo: encontrar e trabalhar negócios ativos.
- Informação: tabela com Ref, Nome/Morada, Freguesia, Tipologia, Piso, Preço pedido, Fase, Fonte, Próxima ação (texto + data), Responsável, Lucro estimado e ROE do cenário ativo, Data de entrada.
- Ações: novo negócio, abrir, mudar fase inline, excluir/reativar, editar próxima ação inline, exportar CSV da vista atual.
- Componentes: TanStack Table com colunas configuráveis e ordenação, pesquisa (morada, nome, freguesia, contacto), chips de filtros ativos, paginação 50.
- Filtros: fase (multi), status (ativo por defeito / excluído / todos), concelho e freguesia, tipologia, tipo de imóvel, fonte, responsável, tags, intervalo de preço, próxima ação (esta semana / atrasadas / sem ação), com BP / sem BP.
- Navegação: toggle Lista/Kanban no topo; a seleção fica guardada por utilizador.

### 3.4 Negócios — Kanban
- Objetivo: ver o pipeline e mover negócios entre fases.
- Informação: 5 colunas (Lead Fria, Lead Morna, Visita, Proposta, Compra) com contagem e soma; cartão mostra Ref, morada curta, tipologia, preço, próxima ação com data (vermelho se atrasada), avatar do responsável, ícone se tem BP.
- Ações: arrastar entre colunas (a passagem para Compra abre o diálogo de compra: valor final, data CPCV, data escritura); "+" no topo da coluna cria negócio já nessa fase; clique abre a ficha.
- Filtros: os mesmos da lista (partilhados).

### 3.5 Negócio — cabeçalho comum a todas as tabs
- Ref + nome, morada, badge de fase (clicável para mudar), status, preço pedido, resultado do cenário ativo (Lucro, Margem, ROE), próxima ação editável, responsável, tags. Botões: Gerar proposta, Excluir, "Criar Obra" (visível só com fase Compra e escritura).

### 3.6 Negócio — Resumo
- Objetivo: ficha de identificação e imóvel, editável inline.
- Informação: 4 blocos: Identificação (nome, fase, responsável, tags, data de entrada), Imóvel (todos os campos de `properties`, incluindo VPT e ARU), Origem (fonte, contacto com telefone clicável, link do anúncio, comissão, observações), Compra (visível a partir de Proposta: valor final, CPCV, escritura, custos reais).
- Ações: editar campo a campo (guardar automático com toast), abrir contacto, abrir imóvel.
- Componentes: formulário em secções colapsáveis; mapa pequeno se houver coordenadas (Phase 2).

### 3.7 Negócio — Análise (comparáveis)
- Objetivo: chegar a um €/m² de venda defensável.
- Informação: dados-base do imóvel (área bruta, ano, andar, elevador); tabela de comparáveis com colunas Preço, m², €/m², Andar, Elevador, Estado, Link, Notas e as 6 linhas de homogeneização (Negociação, Área, Localização, Idade, Conservação, Outros) com Total e €/m² ajustado; €/m² médio; valor de venda sugerido = média × área.
- Ações: adicionar/remover comparável, colar link (Phase 3: preencher automaticamente), "Usar €/m² no cenário Remodelação / Ato Contínuo", valores de referência manuais (Idealista, Maxwork, Consultor).
- Componentes: tabela editável em colunas (um comparável por coluna, como no Excel), cálculo em tempo real.
- Regra de ajuste de área: −(m² comparável − m² base) × 0,25 % por m², por defeito, editável em Definições.

### 3.8 Negócio — Business Plan
- Objetivo: decidir preço máximo e ver retorno por cenário.
- Informação: cenários lado a lado (Ato Contínuo | Remodelação | + outro). Blocos colapsáveis: Venda, Aquisição (VPT, compra, regime IMT com "isento" por defeito, IS, escritura, registos, CPCV, comissão), Financiamento, Obra (orçamento manual ou método €/m² por tipologia, IVA 6 %/23 % conforme ARU, contingência), Detenção (meses, seguros, condomínio, eletricidade, água, juros calculados), Venda (comissão % + IVA, penalizações), Impostos (empresa/particular), Timeline. Painel fixo no topo com Resultados: Lucro bruto, Lucro líquido, Margem, ROI, ROE, Retorno anualizado, Capital próprio necessário, Lucro/m², Break-even.
- Ações: editar qualquer input (recalcula instantaneamente), duplicar cenário, definir cenário ativo (o que alimenta lista e dashboard), "Usar valor de venda da Análise", "Preço máximo para ROE alvo" (resolve por bissecção; simples de fazer no MVP com o motor puro), exportar Excel (Phase 2).
- Componentes: grelha de inputs numéricos com formatação €, %; resultados com cor por sinal; tooltip com a fórmula em cada resultado.

### 3.9 Negócio — Documentos
- Objetivo: arquivar e encontrar toda a documentação do negócio e do imóvel.
- Informação: árvore por grupo/categoria (Imóvel, Jurídico, Financeiro, Técnico, Comercial) com contagens; lista com nome, categoria, data do documento, versão, tamanho, quem carregou; badge "do imóvel" quando o documento pertence à property e não a este negócio.
- Ações: upload por arrastar (multi-ficheiro, pede categoria), preview (PDF/imagem), download, nova versão, substituir, editar metadados, eliminar (soft delete), mover de categoria.
- Filtros: categoria, tipo de ficheiro, texto, intervalo de datas, origem (negócio/imóvel/obra).

### 3.10 Negócio — Proposta
- Objetivo: gerar a proposta em segundos com os números certos.
- Informação: lista de propostas anteriores (número, versão, valor, estado, data, PDF); formulário da nova: template, valor (chips com sugestões: preço máximo do cenário ativo para o ROE alvo, target, pedido), prazo de escritura em dias, validade em dias, condições (texto com predefinições em Definições), observações.
- Ações: "Pré-visualizar", "Gerar PDF" (cria versão e guarda em Documentos → Jurídico/Proposta), "Copiar texto para WhatsApp", marcar estado (enviada / aceite / recusada). Nunca envia.
- Componentes: preview do PDF embebido, área de texto WhatsApp com botão copiar.

### 3.11 Negócio — Notas e Histórico
- Notas: lista cronológica de notas com autor e data, editor simples, fixar nota no topo. Este é o sítio das observações livres (o "Prox Ação" fica no cabeçalho).
- Histórico: audit log filtrado a este negócio, ao seu imóvel, BP, propostas e documentos: "Gonçalo mudou fase Visita → Proposta", "carregou Caderneta Predial v2", "gerou Proposta P-2026-014". Filtro por tipo e utilizador.

### 3.12 Imóveis — lista e ficha
- Lista: Ref, morada, freguesia, tipo, tipologia, área, estado (prospect/owned/for_sale/sold), n.º de negócios, obra ativa. Filtros: estado, concelho, tipo, tipologia.
- Ficha: Resumo (dados físicos e registrais, editáveis; os mesmos campos aparecem no negócio, são o mesmo registo), Documentos (consolidado: todos os documentos de todas as entidades ligadas, agrupados por origem), Negócios & Obras (linha do tempo: negócio 2025 perdido, negócio 2026 comprado, obra, venda).
- Ação: "Novo negócio para este imóvel" (quando um imóvel volta ao mercado).

### 3.13 Obras — lista e ficha
- Lista: Ref, imóvel/morada, estado, responsável, início previsto/real, fim previsto/real, Orçamentado, Executado %, Faturado, Pago, Desvio. Filtros: estado, responsável, concelho.
- Resumo: identificação e datas editáveis; painel com os totais Orçamentado / Executado / Faturado / Pago / Por pagar / Desvio; gráfico de barras por capítulo (orçamentado vs executado) e por fornecedor (orçamentado vs faturado); últimos autos e últimas faturas; alertas "faturado > executado" e "fatura difere do auto".
- Orçamento: árvore Capítulo → Subcapítulo → Artigo com colunas Código, Descrição, Fornecedor, Qtd, Un, Unitário, Orçamentado, Executado % e Executado € (do último auto fechado); adicionar capítulo/subcapítulo/artigo, reordenar, duplicar, importar de Excel no formato do teu mapa de quantidades (Step 14, importação simples por colunas), exportar Excel; total geral, por capítulo e por fornecedor.
- Autos: lista de autos (n.º, mês, data, estado, valor do período, acumulado, faturas ligadas); novo auto abre a árvore do orçamento com coluna "% acumulada" editável (pré-preenchida com o auto anterior), valor do período e acumulado calculados; fechar auto torna-o imutável; correções vão no auto seguinte; PDF do auto (Phase 2).
- Faturas: tabela (n.º, fornecedor, data, vencimento, líquido, IVA, total, pago, por pagar, estado, auto ligado, PDF); nova fatura: upload do PDF, fornecedor, dados, auto de medição opcional (a app mostra o valor do auto ao lado para comparar); registar pagamento (data, valor, método, comprovativo); filtros: fornecedor, estado, mês.
- Documentos: mesma componente do negócio, contexto = obra (projetos, licenças, fotografias de obra).

### 3.14 Contactos
- Lista: nome, tipo (pessoa/empresa), papéis (consultor, proprietário, fornecedor, banco, advogado, outro), telefone, email, NIF, agência/empresa, n.º de negócios, n.º de faturas. Filtros: papel, texto.
- Ficha: dados, negócios em que é fonte, faturas como fornecedor (total faturado e por pagar), notas.
- Regra: telefone normalizado (+351) para detetar duplicados ao criar.

### 3.15 Definições
- Geral: nome da empresa, NIF, morada, texto de assinatura da proposta ("LOOP Homes"), condições predefinidas da proposta, IVA por defeito, ajuste de área nos comparáveis, ROE alvo por defeito, moeda/formatos.
- Utilizadores: convidar por email, papel (admin/manager/user), desativar. Matriz de permissões por módulo (ver, criar, editar, eliminar, exportar) por papel.
- Fases: nome, cor, ordem, "é fase final de compra" (só uma), ativa.
- Fontes: nome, ordem, ativa.
- Categorias de orçamento: nome, ordem (semente: Demolições e apoio CC, Construção civil, Eletricidade, Canalização, AVAC, Carpintaria, Caixilharia, Cozinha, Casas de banho, Pavimentos, Pintura e pladur, Portas, Equipamentos, Mobiliário, Materiais, Logística, Outros).
- Categorias de documentos: grupo, nome, entidade por defeito, ordem.
- IMT: tabelas por ano e regime (HPP, HS), editáveis; regime por defeito "isento (revenda)".
- Tags: nome, cor.

## 4. User flows

### F1. Registar um negócio (o que hoje é criar uma linha no Notion)
1. "+ Novo negócio" (qualquer página) → diálogo de um só ecrã: morada, freguesia/concelho (autocomplete a partir de registos existentes), tipo de imóvel, tipologia, piso, preço pedido, fonte, contacto (autocomplete ou criar inline com telefone), link do anúncio, fase inicial (Lead Fria por defeito), próxima ação + data.
2. Guardar → cria `property` (prospect) + `deal` numa transação; atribui Ref LH-xxxx; abre a ficha em Resumo.
3. Se a morada normalizada já existir noutro imóvel, a app avisa e propõe "usar imóvel existente" (cria só o negócio).

### F2. Follow-up diário
1. Dashboard → "Ações desta semana" → item.
2. Na ficha, atualizar próxima ação e data, ou marcar feita (limpa e pede a seguinte).
3. Mudar fase pelo badge ou no Kanban. Cada mudança fica no histórico.

### F3. Estudo de mercado e Business Plan
1. Negócio → Análise: adicionar 3–4 comparáveis, ajustar homogeneização, ver €/m² médio.
2. "Usar no cenário Remodelação" → abre Business Plan com valor de venda preenchido.
3. Preencher aquisição (IMT isento por defeito, VPT), obra (método €/m² ou orçamento), detenção, venda. Resultados ao vivo.
4. Definir cenário ativo. A lista e o dashboard passam a mostrar esse lucro/ROE.
5. "Preço máximo para ROE 30 %" → mostra o valor; pode copiar para `max_price` do negócio.

### F4. Proposta
1. Negócio → Proposta → "Nova proposta": valor pré-sugerido, prazo, validade, condições.
2. "Copiar texto para WhatsApp" e/ou "Gerar PDF".
3. Enviar por fora. Marcar "enviada"; mais tarde "aceite" ou "recusada". Fase muda para Proposta automaticamente se ainda estava atrás.

### F5. Compra e criação da obra
1. Kanban: arrastar para Compra (ou badge de fase) → diálogo: valor final, data CPCV, data escritura, custos reais de aquisição (IMT 0, IS, escritura, registos, comissão).
2. Imóvel passa a `owned`. Alerta de revenda a 3 anos é agendado.
3. Botão "Criar Obra" (ativo só com escritura) → cria `project` com nome, imóvel, responsável, datas previstas (início = escritura + X dias por defeito, duração = `works_months` do cenário ativo); copia o orçamento do BP como um único artigo "Orçamento BP" no capítulo "Geral", para ser substituído pelo mapa de quantidades real.
4. Obra → Orçamento: importar Excel do mapa de quantidades ou construir à mão; atribuir fornecedor por linha.

### F6. Auto de medição mensal
1. Obra → Autos → "Novo auto" (mês corrente).
2. Percorrer a árvore e escrever a % acumulada por artigo; total do período e acumulado atualizam.
3. Fechar auto. Resumo mostra Executado. Se chegar uma fatura do empreiteiro, liga-se ao auto.

### F7. Fatura e pagamento
1. Obra → Faturas → "Nova fatura": arrastar PDF, escolher fornecedor (autocomplete por NIF/nome), n.º, datas, líquido, IVA (total calculado).
2. Opcional: ligar ao auto de medição do mês; a app mostra o valor do auto e avisa se a fatura for diferente.
3. Guardar → estado "por pagar". Dashboard mostra vencimento. O painel da obra atualiza Faturado e o desvio face ao orçamentado.
4. Mais tarde "Registar pagamento": data, valor (total ou parcial), método, comprovativo. Estado passa a parcial/pago.

### F8. Documentos
1. Em qualquer ficha → Documentos → arrastar ficheiros → diálogo pede categoria (memoriza a última) e data do documento.
2. Fotografias são comprimidas no browser antes de subir.
3. Nova versão: arrastar sobre um documento existente ou botão "Nova versão"; a anterior fica acessível.

### F9. Excluir e reativar
1. Botão Excluir → status excluído, sai de lista e Kanban (filtro "excluídos" mostra).
2. Reativar repõe status ativo na mesma fase.

### F10. Importação Notion (uma vez)
1. `pnpm import:notion --dry-run` lê o CSV `_all`, normaliza, deteta duplicados por morada+freguesia e telefone, e escreve `import-report.md` com contagens por fase/status e a lista de colisões.
2. Rever o relatório; `pnpm import:notion --apply` cria imóveis, negócios, contactos e anexa os 7 BP Excel.
3. Emília das Neves e Gonçalves Crespo: criar obra manualmente na app e carregar orçamento (importação Excel) e faturas históricas.
4. Validação: contagens iguais ao Notion, 10 negócios comparados campo a campo. Notion mantém-se intocado.
