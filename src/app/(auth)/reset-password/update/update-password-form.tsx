"use client";

import { useActionState } from "react";
import { updatePassword, type AuthFormState } from "@/core/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    updatePassword,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Definir password</CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Nova password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirmar password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "A guardar…" : "Guardar e entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
