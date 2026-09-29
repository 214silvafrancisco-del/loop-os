import type { NextRequest } from "next/server";
import { updateSession } from "@/core/auth/session";

// Next.js 16: `proxy.ts` substitui o antigo `middleware.ts`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Tudo exceto ficheiros estáticos e imagens.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
