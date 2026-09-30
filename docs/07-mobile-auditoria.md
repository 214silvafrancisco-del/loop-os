# LOOP OS — Auditoria mobile e responsividade (v0.2, 2026-10-01)

> Plano aprovado em 2026-10-01. **M1 feita**: PWA (`src/app/manifest.ts`, ícones em `public/icons`, `theme-color`, `apple-touch-icon`, `viewport-fit=cover`; `/manifest.webmanifest` é público) e câmara ("Tirar fotografia" nos Documentos com categoria Fotografias / Fotografias de obra pré-escolhida; "Fotografar fatura" no diálogo da fatura, sem OCR). **M2 feita**: cartões abaixo de 768 px nas listas de negócios (`DealCard`), obras (`ProjectCard`) e faturas (cartões no `InvoicesPanel`), tabelas mantêm-se em desktop; filtros da lista de negócios num painel de baixo (`DealsFilters`, Sheet) com chips dos filtros ativos. Segue-se M3.

Análise só de leitura do código e da app a correr num ecrã de 375 × 812 px (iPhone). **Nenhum código foi alterado.** No fim está a abordagem recomendada e o plano por etapas.

## Resposta curta

A app já foi desenhada responsiva desde o Step 01: sidebar escondida abaixo de 768 px, barra inferior com 5 ícones, tabelas que escondem colunas por largura, formulários numa coluna, diálogos com scroll interno. **Nenhuma das 30 páginas parte no telemóvel**: não há scroll horizontal da página em nenhuma, e as tabelas largas fazem scroll dentro do seu contentor. O que falta é a segunda metade: **experiência de uso mobile** (cartões em vez de tabelas, alvos de toque maiores, câmara, PWA), sobretudo nas Obras. Isso faz-se **adaptando a interface atual**, sem reconstruir nada e sem tocar em backend, base de dados ou autenticação.

---

## 1. Stack atual

| Camada | O que está |
|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript. Server Components + Server Actions; UI e backend no mesmo projeto |
| CSS | Tailwind CSS 4 com tokens da marca em `globals.css` (`--primary` laranja, `--success`, `--warning`, modo escuro previsto) |
| Componentes | shadcn/ui (Radix): Button, Input, Textarea, Checkbox, Dialog, DropdownMenu, Popover, Tooltip, Table, Card, Sheet, Badge. 51 componentes próprios em `src/modules/*/components` (≈ 6 000 linhas) |
| Layout | `AppShell`: sidebar 240 px (`hidden md:flex`), `Topbar` fixa (marca em mobile, pesquisa só ≥ 640 px, "Novo negócio" vira só ícone), `MobileNav` fixa em baixo (`md:hidden`), `main` com `pb-24` para não ficar por baixo da barra |
| Menus | DropdownMenu (Radix) em ações por linha, utilizador, "Novo auto"; Popover na próxima ação; selects nativos nos filtros e badges de fase e estado |
| Tabelas | Tabela HTML em listas (negócios, obras, imóveis, contactos, faturas, autos, totais por fornecedor) com colunas `hidden md:/lg:/xl:table-cell`; editores (orçamento, auto, comparáveis, procedimentos) com largura mínima e scroll interno |
| Formulários | `FormSection` em grelha `md:grid-cols-2` (uma coluna abaixo de 768 px); inputs de 32 px de altura, texto 16 px em mobile (evita zoom no iOS) |
| Modais | Dialog (Radix) com `max-h-[calc(100dvh-2rem)] overflow-y-auto` desde 2026-10-01 |
| Cards | KPI do dashboard, resumo da obra, painel de processo, colunas do Business Plan |
| Dashboards | KPIs em grelha 1 → 2 → 4 colunas; listas; sem biblioteca de gráficos (as barras do pipeline são `div`) |
| Drag & drop | dnd-kit no Kanban, já com `TouchSensor` (200 ms de toque longo) |
| Ficheiros | `<input type="file">` com `accept` de PDF e imagens; compressão de fotografias no browser antes do upload; limite 50 MB |
| Uploads/PDF | Route handlers (`/api/documents/upload`, `/api/documents/[id]/download`, extração de faturas); PDFs com @react-pdf no servidor |

**Backend.** Não há nada acoplado ao layout desktop. As Server Actions recebem `FormData` ou JSON e as rotas API recebem `multipart`. Qualquer interface, incluindo uma app nativa, usaria os mesmos pontos de entrada.

**Base de dados.** Uma versão mobile usa exatamente a mesma base (Supabase Postgres, Drizzle) e os mesmos dados. Nada a mudar.

**Autenticação.** Supabase Auth por cookies (`@supabase/ssr`), login com email e password, recuperação por email, convites por link. Funciona em mobile tal como está; os links de email já abrem no browser do telemóvel e criam a sessão. Numa PWA instalada, a sessão em cookies mantém-se.

## 2. Estado atual da responsividade

Medido a 375 px de largura com sessão iniciada (scroll horizontal da página, colunas visíveis, alvos de toque):

| Página | Estado | Observado |
|---|---|---|
| Login / recuperação | 🟢 | Formulário simples numa coluna |
| Dashboard | 🟢 | KPIs empilhados, listas legíveis; a tabela "Obras em curso" tem largura mínima de 40 rem e faz scroll dentro do contentor; 42 alvos de toque abaixo de 32 px (links de texto e ícones) |
| Negócios · lista | 🟡 | Sem scroll horizontal; mostra só Ref, Negócio, Preço pedido e Fase; os 6 filtros ocupam meio ecrã; a próxima ação, o processo e o responsável ficam escondidos. Falta a vista em cartões |
| Negócios · Kanban | 🟡 | Colunas de 288 px com scroll lateral (1 188 px para 343 visíveis); arrastar entre colunas com toque longo funciona mas é pouco natural no telemóvel; falta um seletor de fase por cartão ou vista por lista de fases |
| Ficha do negócio · cabeçalho e tabs | 🟢 | Tabs com scroll lateral (7 tabs), cabeçalho com progresso e próxima ação legíveis |
| Negócio · Resumo (formulário) | 🟢 | 23 campos numa coluna; ok para editar |
| Negócio · Análise (comparáveis) | 🟡 | Tabela de 640 px em contentor de 341: usa-se com scroll lateral; no telemóvel é para consultar, não para editar |
| Negócio · Business Plan | 🔴 | Colunas fixas de 26 rem lado a lado (765 px para 375); 76 inputs; painel de resultados ok. É a página mais desktop da app: precisa de vista de um cenário de cada vez com acordeões por bloco |
| Negócio · Documentos | 🟢 | Zona de arrastar vira botão "escolhe no computador"; upload funciona; falta atalho de câmara e um texto mobile |
| Negócio · Proposta | 🟢 | 10 campos numa coluna; PDF abre no browser |
| Negócio · Processo (checklist) | 🟢 | Secções e itens legíveis; checkbox de 16 px é pequeno para o dedo; menu de três pontos ok |
| Negócio · Notas / Histórico | 🟢 | Listas simples |
| Obras · lista | 🟡 | Só Ref, Obra e Estado visíveis; sem processo, datas nem responsável. Falta a vista em cartões |
| Obra · Resumo | 🟡 | 6 cartões empilhados (ok); tabela por fornecedor de 671 px em contentor de 341 (scroll lateral); formulário da obra ok |
| Obra · Orçamento | 🔴 | Editor com largura mínima de 56 rem e 114 inputs numa tabela: no telemóvel serve para consultar com scroll lateral, não para editar. Precisa de vista de leitura por capítulo com totais, e edição de um artigo de cada vez |
| Obra · Autos | 🟡 | Secções por fornecedor ok; tabelas escondem colunas; o editor do auto (48 rem) é uma tabela de percentagens por artigo, difícil no telemóvel |
| Obra · Faturas | 🟡 | 6 cartões de totais ok; tabela mostra N.º, Fornecedor, S/ IVA, Por pagar, Estado; o diálogo da fatura já funciona (corrigido hoje); falta o atalho "fotografar fatura" |
| Obra · Documentos | 🟢 | Igual ao negócio |
| Obra · Processo | 🟢 | Igual ao negócio |
| Imóveis · lista e ficha | 🟢 | Tabela com colunas escondidas; ficha em formulário |
| Contactos | 🟢 | Idem |
| Definições / Procedimentos | 🟡 | Tabela de 672 px com scroll lateral; é página de administração, aceitável |
| Diálogos (fatura, fornecedor, adiantamento, pagamento, compra, N/A) | 🟢 | Corrigidos hoje: altura máxima do ecrã e scroll interno |

Resumo: 17 🟢, 8 🟡, 2 🔴. Nenhuma página com scroll horizontal do documento.

## 3. Problemas encontrados

1. **Tabelas largas de edição** (orçamento 896 px, auto 768 px, comparáveis 640 px, procedimentos 672 px, totais por fornecedor 671 px): fazem scroll dentro do contentor, mas editar percentagens ou preços numa tabela de 9 colunas no telemóvel é penoso.
2. **Listas em tabela** escondem as colunas que importam no telemóvel (próxima ação, progresso do processo, responsável, datas da obra). O padrão certo é o cartão.
3. **Alvos de toque pequenos**: checkboxes de 16 px, botões de ícone de 28 a 32 px, links de texto pequenos nas listas. Apple e Google recomendam 44 px.
4. **Filtros** ocupam meio ecrã na lista de negócios (6 selects em coluna). Precisam de ficar num painel "Filtros" que abre por cima (Sheet), com chips do que está ativo.
5. **Kanban** por arrastar é pouco natural no telemóvel; o toque longo funciona mas conflitua com o scroll.
6. **Business Plan** lado a lado não cabe: 26 rem por cenário.
7. **Pesquisa global** desaparece abaixo de 640 px (e ainda está desativada em desktop).
8. **Tabs da ficha** (7 no negócio, 6 na obra) precisam de scroll lateral; aceitável, mas sem indicação visual de que há mais.
9. **Câmara**: os inputs de ficheiro aceitam imagens, mas sem `capture` e sem botão "Tirar fotografia" explícito; o cabeçalho `Permissions-Policy: camera=()` bloqueia a API de câmara dentro da página (não afeta o seletor de ficheiros do sistema, que é o que se usa).
10. **PWA**: sem manifest, sem ícones de instalação, sem `theme-color`, sem service worker. O `viewport` está correto (Next.js por defeito).
11. **Popovers e menus** Radix funcionam com toque; o popover da próxima ação tem 288 px, cabe.
12. **Texto cortado**: não encontrei. Truncamentos são intencionais (`truncate`) em nomes longos.
13. **Elementos sobrepostos**: não encontrei; o `pb-24` do `main` evita a barra inferior tapar conteúdo.

## 4. Mobile UX: onde a experiência deve ser diferente

| Desktop | Mobile |
|---|---|
| Lista de negócios em tabela | Cartão: `LH-0034 · T2 Odivelas`, 225 000 €, T2 · RC · Odivelas, badge de fase, próxima ação com data, progresso do processo |
| Kanban com arrastar | Lista por fase com o badge de fase clicável em cada cartão (já existe na ficha), ou "mover para…" no menu do cartão |
| Filtros em linha | Botão "Filtros" que abre um painel de baixo (Sheet) com os mesmos selects, e chips dos filtros ativos |
| Business Plan com cenários lado a lado | Um cenário de cada vez (seletor no topo), resultados fixos no topo, blocos em acordeão (Venda, Aquisição, Obra, Detenção…) |
| Orçamento como folha de cálculo | Vista de leitura por fornecedor e capítulo com totais; tocar num artigo abre um diálogo para editar quantidade, unidade e preço |
| Auto de medição em tabela | Lista de artigos com um controlo de percentagem grande por linha (campo + botões 25/50/75/100) |
| Lista de obras em tabela | Cartão: nome, morada, estado, progresso do processo, executado / faturado / pago |
| Documentos com "arrastar para aqui" | Dois botões grandes: "Tirar fotografia" e "Escolher ficheiro"; categoria pré-escolhida |
| Faturas em tabela | Cartão por fatura (n.º, fornecedor, total, por pagar, estado) e botão "Fotografar fatura" |
| Checklist com checkbox pequeno | Linha inteira tocável, checkbox de 24 px, ações num menu de baixo (Sheet) |
| Sidebar | Já é barra inferior com 5 itens; Definições e Imóveis ficam no menu do utilizador |

## 5. Obras: prioridade mobile

| Funcionalidade | Hoje no telemóvel | Otimizar? |
|---|---|---|
| Consultar uma obra | Resumo em cartões: bom | Baixo: tabela por fornecedor em cartões |
| Consultar orçamento | Scroll lateral numa tabela de 9 colunas | **Sim**: vista de leitura por capítulo |
| Consultar faturas | Tabela com 5 colunas: aceitável | Sim: cartões |
| Registar uma fatura | Diálogo funciona; leitura do PDF funciona | **Sim**: botão "Fotografar fatura" que abre a câmara, carrega a imagem e liga ao auto (sem OCR de imagem por agora) |
| Tirar fotografia | Só via "escolher ficheiro" → o telemóvel oferece a câmara | **Sim**: botão explícito com `capture="environment"`, categoria "Fotografias de obra" pré-escolhida, compressão já existe |
| Upload de documento | Funciona | Baixo: texto e botões mobile |
| Consultar checklist | Bom | Baixo |
| Completar checklist | Checkbox pequeno, funciona | Médio: alvos maiores, linha tocável |
| Adicionar nota | Notas existem só no negócio, não na obra | Médio: acrescentar notas à obra (é funcionalidade nova, fora do âmbito de responsividade) |
| Alterar estado | Select no cabeçalho: bom | Baixo |
| Consultar fornecedores | Lista no topo do Orçamento: bom | Baixo: mover para o Resumo ou tab própria em mobile |

Conclusão: no módulo Obras, as três frentes que valem o esforço são **fotografar e carregar** (obra e fatura), **orçamento em vista de leitura** e **listas em cartões**. O auto de medição pode manter-se para desktop e ganhar a variante de percentagem por artigo em mobile numa segunda fase.

## 6. Câmara e documentos

A arquitetura atual já permite os dois fluxos sem alterações estruturais:

- **Fotografia → upload → obra**: o `DocumentsPanel` já aceita imagens, comprime no browser (`compress-image.ts`) e envia por `multipart` para `/api/documents/upload` com `entityType=project`. Falta apenas um `<input type="file" accept="image/*" capture="environment">` com um botão "Tirar fotografia" e a categoria "Fotografias de obra" pré-selecionada. No iPhone e no Android isto abre a câmara diretamente.
- **Fotografia da fatura → upload → obra**: o diálogo da fatura já aceita imagens e arquiva o ficheiro como documento da fatura. Falta o botão de câmara e, opcionalmente, deixar guardar a fatura só com a foto e o auto, preenchendo os valores mais tarde. Sem OCR, como pedido.
- O cabeçalho `Permissions-Policy` só precisa de mudar se um dia quisermos a câmara dentro da página (getUserMedia). Para o seletor de ficheiros com `capture` não é preciso.
- Limite atual de 50 MB e compressão de imagens: adequados a fotografias de telemóvel.

## 7. PWA

Possível com esforço baixo, porque a app já corre em HTTPS:

| Capacidade | Como | Esforço |
|---|---|---|
| Adicionar ao ecrã inicial, ícone próprio, abrir como app | `manifest.json` (nome, ícones 192/512 a partir do logótipo, `display: standalone`, `theme_color` laranja) + `apple-touch-icon` + `theme-color` no `layout.tsx`. O Next.js gera o manifest a partir de `app/manifest.ts` | 🟢 |
| Fullscreen | `display: standalone` (recomendado; `fullscreen` esconde a barra de estado) | 🟢 |
| Notificações no futuro | Service worker + Web Push (VAPID) + tabela de subscrições + envio a partir do servidor (ex.: próximas ações, faturas a vencer). No iPhone só funciona com a app instalada no ecrã inicial (iOS 16.4+) | 🟡 |
| Offline no futuro | Service worker com cache do shell e das páginas visitadas (leitura). Escrita offline (fila de uploads) é 🔴 e não recomendo para já | 🟡 a 🔴 |

Ressalva: a app é 100 % server-rendered. Uma PWA de leitura offline exige decidir o que se cacheia; o mais realista a curto prazo é "instalar e abrir como app", sem offline.

## 8. Esforço estimado

**Global: 🟡 Médio.** Não há reconstrução; há uma camada de variantes mobile em cima dos mesmos componentes e dados.

| Item | Estimativa |
|---|---|
| Páginas a alterar | 10 de 30 (dashboard, negócios lista/Kanban, business plan, análise, obras lista, obra resumo, orçamento, autos, faturas) |
| Componentes a alterar | 12 (deals-table, kanban, filtros, scenario-board, comparables-panel, projects-table, budget-editor, measurement-editor, invoices-panel, documents-panel, checklist-panel, supplier-totals-table) |
| Componentes novos | 8 (DealCard, ProjectCard, InvoiceCard, FiltersSheet, ResponsiveTable/CardList genérico, CameraButton, BudgetReadView, ScenarioMobileView) + manifest e ícones |
| Backend | Nenhuma alteração |
| Base de dados | Nenhuma alteração |
| Autenticação | Nenhuma alteração |
| Configuração | `Permissions-Policy` só se houver câmara na página; manifest e ícones |

Por etapa: 🟢 PWA e câmara (dias), 🟡 cartões e filtros (uma a duas sessões cada), 🔴 Business Plan e orçamento mobile (as duas maiores, uma sessão cada).

## 9. Arquitetura recomendada

| | Opção A · Adaptar a app atual (responsive + variantes mobile) | Opção B · Componentes mobile específicos com o mesmo backend | Opção C · App mobile separada (React Native / Expo) |
|---|---|---|---|
| Complexidade | Baixa a média: Tailwind já tem os breakpoints; variantes por componente | Média: duplicar os componentes de lista e edição, uma vez para desktop e outra para mobile | Alta: novo projeto, novo build, lojas, autenticação por token em vez de cookies |
| Tempo | 5 a 7 sessões | 8 a 12 sessões | Meses |
| Manutenção | Uma base de código; cada funcionalidade nova nasce responsiva | Duas variantes por componente para manter em sincronia | Duas aplicações, dois deploys, uma API a contratar |
| Custos | Zero adicionais | Zero adicionais | Contas Apple/Google, tempo de publicação, mais servidor de API |
| Vantagens | Tudo o que já existe continua a funcionar; PWA dá ícone e ecrã inteiro; câmara pelo browser | Liberdade total de layout mobile | Notificações nativas, câmara e offline de primeira classe |
| Desvantagens | Algumas páginas (BP, orçamento) precisam de variantes reais, não só CSS | Duplicação e risco de divergência | Reconstruir a interface do zero; a lógica de UI (cálculo do BP, orçamento) teria de ser partilhada por pacote |

**Recomendação: Opção A, com um toque da B onde conta.** Adaptar a app atual, mantendo um único componente por funcionalidade, e criar variantes mobile apenas nos cinco sítios onde o CSS não chega: listas em cartões, filtros em painel, Business Plan de um cenário, orçamento em vista de leitura e Kanban por lista. Isto respeita o que pediste (mesma base, backend, autenticação, lógica e dados), mantém uma só base de código e chega ao "instalar como app" com a PWA. A opção C só faria sentido se a prioridade fossem notificações nativas e offline em obra sem rede, e mesmo aí a PWA cobre as notificações.

## 10. Plano de implementação por etapas

| Etapa | Entrega | Esforço |
|---|---|---|
| M1 · PWA e câmara | Manifest, ícones, `theme-color`, instalar no ecrã inicial. Botões "Tirar fotografia" nos documentos da obra e do negócio, e "Fotografar fatura" no diálogo da fatura, com categoria pré-escolhida | 🟢 |
| M2 · Listas em cartões | `DealCard`, `ProjectCard`, `InvoiceCard` abaixo de 768 px; tabela mantém-se em desktop. Painel de filtros (Sheet) com chips na lista de negócios | 🟡 |
| M3 · Toque e navegação | Alvos de 44 px em checklists, botões de ícone e linhas de lista; tabs com indicação de scroll; pesquisa global no topo em mobile; Imóveis e Definições no menu do utilizador | 🟢 |
| M4 · Obras em mobile | Orçamento em vista de leitura por fornecedor e capítulo com edição de artigo em diálogo; totais por fornecedor em cartões; auto de medição com controlo de percentagem por artigo | 🟡 a 🔴 |
| M5 · Business Plan e Kanban | Um cenário de cada vez com acordeões e resultados fixos; comparáveis em cartões; Kanban vira lista por fase com "mover para…" | 🔴 |
| M6 · Notificações (opcional, mais tarde) | Service worker, Web Push, subscrições, envio diário de próximas ações e faturas a vencer | 🟡 |

Cada etapa é uma sessão no formato habitual: ficheiros exatos, comandos, como testar num telemóvel real (abrir `https://app.89.58.58.97.sslip.io` no Safari ou Chrome) e no emulador de 375 px que usei aqui.

**Nada foi alterado nesta análise.** Só depois da tua aprovação começo pela etapa M1.
