import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Zap } from "lucide-react";
import { requireUser } from "@/core/auth/current-user";
import { PageHeader } from "@/core/ui/page-header";
import { listTemplatesWithItems } from "@/modules/checklists/queries";
import { SECTION_LABELS } from "@/modules/checklists/templates";

export const metadata: Metadata = { title: "Procedimentos" };

const GATE_LABEL: Record<string, string> = {
  "proposal:generate": "gerar proposta",
  "deal:stage:proposta": "fase Proposta",
  "deal:stage:compra": "fase Compra",
  "project:em_curso": "obra em curso",
  "project:concluida": "obra concluída",
};

function gateText(g: string) {
  const [mode, ...rest] = g.split(":");
  const key = rest.join(":");
  return `${mode === "hard" ? "bloqueia" : "avisa"}: ${GATE_LABEL[key] ?? key}`;
}

/** Procedimentos da empresa (só leitura no MVP; edição e versões na Phase 2). */
export default async function ProcedimentosPage() {
  const user = await requireUser();
  const templates = await listTemplatesWithItems(user.organizationId);

  return (
    <>
      <PageHeader
        title="Procedimentos"
        description="As checklists que acompanham cada negócio e cada obra. Os passos automáticos seguem os dados; os manuais marcam-se à mão. Edição e versões novas: Phase 2."
        actions={
          <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
            ← Definições
          </Link>
        }
      />
      <div className="flex flex-col gap-8">
        {templates.map((t) => {
          const sections = new Map<string, typeof t.items>();
          for (const it of t.items) {
            if (!sections.has(it.section)) sections.set(it.section, []);
            sections.get(it.section)!.push(it);
          }
          return (
            <section key={t.id} className="rounded-xl border bg-card">
              <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                <h2 className="text-base font-semibold">{t.name}</h2>
                <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
                  v{t.version} · {t.entityType === "deal" ? "negócio" : "obra"} · {t.items.length} passos
                </span>
                {!t.isActive ? <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">inativo</span> : null}
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Passo</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Obrigatório</th>
                      <th className="px-3 py-2 text-left">Aplica-se quando</th>
                      <th className="px-3 py-2 text-left">Portas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sections.entries()].map(([code, items]) => (
                      <SectionRows key={code} label={SECTION_LABELS[code] ?? code} items={items} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function SectionRows({ label, items }: { label: string; items: Awaited<ReturnType<typeof listTemplatesWithItems>>[number]["items"] }) {
  return (
    <>
      <tr className="border-b bg-muted/40">
        <td colSpan={5} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </td>
      </tr>
      {items.map((it) => (
        <tr key={it.id} className="border-b last:border-0">
          <td className="px-4 py-2">
            <div>{it.label}</div>
            {it.help ? <div className="text-xs text-muted-foreground">{it.help}</div> : null}
          </td>
          <td className="px-3 py-2 text-muted-foreground">
            {it.kind === "auto" ? (
              <span className="inline-flex items-center gap-1">
                <Zap className="size-3" /> auto
                {it.ruleKey ? <code className="ml-1 rounded bg-muted px-1 text-[11px]">{it.ruleKey}</code> : null}
              </span>
            ) : (
              "manual"
            )}
          </td>
          <td className="px-3 py-2">{it.isRequired ? <span className="rounded bg-primary/10 px-1 text-[10px] font-medium uppercase text-primary">sim</span> : <span className="text-muted-foreground">—</span>}</td>
          <td className="px-3 py-2 text-muted-foreground">{it.appliesWhen ? <code className="rounded bg-muted px-1 text-[11px]">{it.appliesWhen}</code> : "sempre"}</td>
          <td className="px-3 py-2 text-xs text-muted-foreground">
            {it.gates.length ? (
              <ul className="flex flex-col gap-0.5">
                {it.gates.map((g) => (
                  <li key={g} className="inline-flex items-center gap-1">
                    {g.startsWith("hard:") ? <Lock className="size-3" /> : null}
                    {gateText(g)}
                  </li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </td>
        </tr>
      ))}
    </>
  );
}
