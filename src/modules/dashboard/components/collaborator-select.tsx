"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/core/ui/form-field";

/** Founder: escolhe a visão global ou a visão consolidada de um colaborador (`/dashboard?u=`). */
export function CollaboratorSelect({ users, value, selfId }: { users: { id: string; fullName: string }[]; value: string; selfId: string }) {
  const router = useRouter();
  return (
    <NativeSelect value={value} onChange={(e) => router.push(e.target.value ? `/dashboard?u=${e.target.value}` : "/dashboard")} aria-label="Ver como" className="h-10 w-auto md:h-9">
      <option value="">Visão global</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.fullName}
          {u.id === selfId ? " (eu)" : ""}
        </option>
      ))}
    </NativeSelect>
  );
}
