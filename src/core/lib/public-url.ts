import type { NextRequest } from "next/server";

/**
 * Endereço público da app para redirecionamentos em route handlers.
 * Em produção (standalone atrás do Traefik) request.url e request.nextUrl
 * apontam para o endereço interno do contentor (https://0.0.0.0:3000).
 * Ordem: NEXT_PUBLIC_APP_URL, cabeçalhos do proxy, endereço do pedido.
 */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0] ?? request.nextUrl.protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}

/** URL absoluto no endereço público para um caminho interno ("/x?y=1"). */
export function publicUrl(request: NextRequest, pathWithQuery: string): URL {
  return new URL(pathWithQuery, publicOrigin(request) + "/");
}
