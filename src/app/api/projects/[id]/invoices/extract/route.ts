import { NextResponse, type NextRequest } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { getCurrentUser } from "@/core/auth/current-user";
import { parseInvoiceText } from "@/modules/projects/invoices/extract";
import { getProject } from "@/modules/projects/queries";

/**
 * Lê o texto de um PDF de fatura e devolve os campos reconhecidos por regras.
 * Não grava nada: o diálogo da fatura pré-preenche o formulário e o
 * utilizador confirma. Digitalizações sem texto devolvem campos vazios.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await getProject(user.organizationId, id);
  if (!project) return NextResponse.json({ error: "Obra não encontrada." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta o ficheiro." }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "Ficheiro acima de 15 MB." }, { status: 413 });
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ ok: true, extracted: parseInvoiceText(""), note: "Só leio PDFs; para imagens preenche os campos à mão." });
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const extracted = parseInvoiceText(text);
    return NextResponse.json({ ok: true, extracted, pages: totalPages, chars: text.length });
  } catch (e) {
    console.error("[invoices/extract]", e);
    return NextResponse.json({ error: "Não foi possível ler o PDF." }, { status: 422 });
  }
}
