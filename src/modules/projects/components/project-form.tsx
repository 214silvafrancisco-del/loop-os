"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection, NativeSelect } from "@/core/ui/form-field";
import type { UserOption } from "@/modules/settings/queries";
import type { ProjectFormState } from "../actions";
import type { Project } from "../schema";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectUpdateInput } from "../validation";

type Props = {
  action: (prev: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;
  project: Project;
  users: UserOption[];
  cancelHref: string;
};

function str(v: string | null | undefined) {
  return v ?? "";
}

export function ProjectForm({ action, project, users, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(action, {});
  const errors = state.fieldErrors ?? {};
  const v = state.values as Partial<ProjectUpdateInput> | undefined;
  const g = (key: keyof ProjectUpdateInput, fromProject: string | null | undefined) => (v ? str(v[key] as string | undefined) : str(fromProject));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormSection title="Identificação">
        <FormField id="name" label="Nome da obra" error={errors.name}>
          <Input id="name" name="name" defaultValue={g("name", project.name)} required />
        </FormField>
        <FormField id="status" label="Estado" error={errors.status}>
          <NativeSelect id="status" name="status" defaultValue={g("status", project.status)}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="managerUserId" label="Responsável" error={errors.managerUserId}>
          <NativeSelect id="managerUserId" name="managerUserId" defaultValue={g("managerUserId", project.managerUserId)}>
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </NativeSelect>
        </FormField>
      </FormSection>

      <FormSection title="Datas" description="Previstas ao planear; reais quando a obra arranca e termina.">
        <FormField id="plannedStart" label="Início previsto" error={errors.plannedStart}>
          <Input id="plannedStart" name="plannedStart" type="date" defaultValue={g("plannedStart", project.plannedStart)} />
        </FormField>
        <FormField id="plannedEnd" label="Conclusão prevista" error={errors.plannedEnd}>
          <Input id="plannedEnd" name="plannedEnd" type="date" defaultValue={g("plannedEnd", project.plannedEnd)} />
        </FormField>
        <FormField id="actualStart" label="Início real" error={errors.actualStart}>
          <Input id="actualStart" name="actualStart" type="date" defaultValue={g("actualStart", project.actualStart)} />
        </FormField>
        <FormField id="actualEnd" label="Conclusão real" error={errors.actualEnd}>
          <Input id="actualEnd" name="actualEnd" type="date" defaultValue={g("actualEnd", project.actualEnd)} />
        </FormField>
        <FormField id="notes" label="Notas" error={errors.notes} className="md:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={g("notes", project.notes)} />
        </FormField>
      </FormSection>

      {state.error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{state.error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={pending}>{pending ? "A guardar…" : "Guardar"}</Button>
      </div>
    </form>
  );
}
