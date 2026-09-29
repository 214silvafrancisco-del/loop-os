# src/core

Código transversal, sem regras de negócio de um módulo específico.

```
core/
  navigation.ts     itens da sidebar
  ui/               shell da app (sidebar, topbar, mobile nav), page-header, estados vazios
  db/               (Step 02) cliente Drizzle, migrações, helpers de transação
  auth/             (Step 03) sessão, utilizador atual, permissões
  storage/          (Step 11) adaptador de ficheiros (R2 / Supabase Storage)
  audit/            (Step 08) leitura do audit log
  pdf/              (Step 12) motor React-PDF e registo de templates
  lib/              utilitários (formatação €, datas, normalização de texto)
```

`src/components/ui` é o shadcn/ui (componentes copiados, editáveis).
