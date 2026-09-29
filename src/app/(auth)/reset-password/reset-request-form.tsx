"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/core/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Recuperar password</CardTitle>
        <CardDescription>Enviamos um link para o teu email.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.ok ? (
          <div className="flex flex-col gap-4 text-sm">
            <p>Se o email existir, vais receber um link nos próximos minutos.</p>
            <Button asChild variant="outline">
              <Link href="/login">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "A enviar…" : "Enviar link"}
            </Button>
            <Link href="/login" className="text-center text-xs text-muted-foreground hover:text-foreground">
              Voltar ao login
            </Link>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
