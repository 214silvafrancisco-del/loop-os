# src/modules

Um diretório por módulo de domínio. Estrutura de cada módulo:

```
modules/<modulo>/
  schema.ts       tabelas Drizzle do módulo
  queries.ts      leituras (server only)
  actions.ts      escritas: Server Actions com validação zod e autorização
  validation.ts   schemas zod partilhados entre formulários e actions
  types.ts        tipos públicos do módulo
  components/     componentes React do módulo
  calc/           lógica pura (ex.: motor do Business Plan)
```

Regras:
- Um módulo importa de `@/core/*` e dos seus próprios ficheiros.
- Nunca importa componentes de outro módulo; só `queries`, `types` ou `validation` públicos.
- As rotas em `src/app/(app)/<rota>` são finas: chamam queries e renderizam componentes do módulo.

Módulos previstos: `contacts`, `properties`, `deals`, `business-plan`, `proposals`, `projects`, `documents`, `dashboard`, `settings`.
