"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/core/ui/form-field";
import { cn } from "@/lib/utils";
import { reassignOpenTasks, setUserActive, setUserModule } from "../admin-actions";
import { APP_MODULES, type AppModule } from "../access";

export type MatrixUser = { id: string; fullName: string; email: string; role: "admin" | "manager" | "user"; isActive: boolean; modules: AppModule[]; openTasks: number };

/** Matriz utilizadores × módulos com interruptores; desativar e reatribuir tarefas. */
export function UsersMatrix({ users, adminId }: { users: MatrixUser[]; adminId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(u: MatrixUser, m: AppModule, on: boolean) {
    setBusy(`${u.id}:${m}`);
    setMsg(null);
    startTransition(async () => {
      const r = await setUserModule(u.id, m, on);
      if (!r.ok) setMsg(r.error);
      setBusy(null);
      router.refresh();
    });
  }
  function active(u: MatrixUser, on: boolean) {
    if (!on && !confirm(`Desativar ${u.fullName}? Deixa de conseguir entrar; o histórico e as tarefas ficam.`)) return;
    setBusy(`${u.id}:active`);
    startTransition(async () => {
      const r = await setUserActive(u.id, on);
      if (!r.ok) setMsg(r.error);
      setBusy(null);
      router.refresh();
    });
  }
  function reassign(u: MatrixUser, to: string) {
    if (!confirm(`Reatribuir as ${u.openTasks} tarefas abertas de ${u.fullName}?`)) return;
    setBusy(`${u.id}:tasks`);
    startTransition(async () => {
      const r = await reassignOpenTasks(u.id, to || null);
      setMsg(r.ok ? `${r.moved} tarefas reatribuídas.` : r.error);
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">Utilizador</th>
              {APP_MODULES.map((m) => (
                <th key={m.key} className="px-2 py-2 text-center font-medium" title={m.description}>
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isAdmin = u.role === "admin";
              return (
                <tr key={u.id} className={cn("border-b last:border-0", !u.isActive && "opacity-60")}>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {u.fullName}
                      {u.id === adminId ? <span className="ml-2 rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">tu</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.email} · {isAdmin ? "Founder (acesso global)" : u.role === "manager" ? "Gestor" : "Utilizador"}
                      {u.openTasks ? ` · ${u.openTasks} tarefas abertas` : ""}
                    </div>
                  </td>
                  {APP_MODULES.map((m) => {
                    const on = isAdmin || u.modules.includes(m.key);
                    const key = `${u.id}:${m.key}`;
                    return (
                      <td key={m.key} className="px-2 py-2 text-center">
                        {isAdmin ? (
                          <span className="text-xs text-muted-foreground">sempre</span>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center gap-1.5">
                            <input type="checkbox" checked={on} disabled={pending && busy === key} onChange={(e) => toggle(u, m.key, e.target.checked)} className="size-5 accent-primary" aria-label={`${m.label} para ${u.fullName}`} />
                            {busy === key ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
                          </label>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2">
                    {isAdmin ? (
                      <span className="text-xs text-muted-foreground">ativo</span>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <Button type="button" size="sm" variant={u.isActive ? "outline" : "default"} className="h-8 w-fit" onClick={() => active(u, !u.isActive)} disabled={pending}>
                          {u.isActive ? "Desativar" : "Reativar"}
                        </Button>
                        {u.openTasks ? (
                          <NativeSelect aria-label={`Reatribuir tarefas de ${u.fullName}`} defaultValue="" onChange={(e) => e.target.value !== "" && reassign(u, e.target.value === "none" ? "" : e.target.value)} className="h-8 w-auto text-xs">
                            <option value="">Reatribuir tarefas abertas…</option>
                            <option value="none">Sem responsável</option>
                            {users
                              .filter((x) => x.id !== u.id && x.isActive)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.fullName}
                                </option>
                              ))}
                          </NativeSelect>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      <p className="text-xs text-muted-foreground">Com acesso = pode usar o módulo com as regras funcionais existentes. Sem acesso = o módulo não aparece e as páginas, ações, pesquisas e documentos ficam bloqueados. As alterações aplicam-se no pedido seguinte. Novos utilizadores começam sem acessos; convida com `pnpm user:invite`.</p>
    </div>
  );
}
