import { redirect } from "next/navigation";

// A raiz redireciona para o dashboard. No Step 03 passa a verificar sessão.
export default function RootPage() {
  redirect("/dashboard");
}
