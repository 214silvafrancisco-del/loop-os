import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/core/auth/current-user";
import { getStorage } from "@/core/storage";
import { getVersionForDownload } from "@/modules/documents/queries";

/**
 * Download/preview de uma versão. Verifica sessão e organização; com R2
 * redireciona para um URL assinado de 15 minutos, com disco local faz stream.
 * `?inline=1` abre no browser (PDF, imagens) em vez de descarregar.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { versionId } = await params;
  const row = await getVersionForDownload(user.organizationId, versionId);
  if (!row) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const inline = request.nextUrl.searchParams.get("inline") === "1";
  const storage = getStorage();
  const filename = row.version.fileName;

  const signed = await storage.getSignedUrl(row.version.storageKey, { filename, inline, expiresInSeconds: 900 });
  if (signed) return NextResponse.redirect(signed);

  const obj = await storage.getObject(row.version.storageKey);
  if (!obj) return NextResponse.json({ error: "Ficheiro em falta no storage." }, { status: 404 });

  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`;
  const body = obj.body instanceof Uint8Array ? new Blob([obj.body as BlobPart]) : obj.body;
  return new Response(body, {
    headers: {
      "Content-Type": obj.contentType || row.version.mimeType,
      "Content-Length": String(obj.size),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=0",
    },
  });
}
