import { NextResponse, type NextRequest } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";
import { hasModule } from "@/core/auth/access";
import { getCurrentUser } from "@/core/auth/current-user";
import { parseBudgetText } from "@/modules/projects/budget/pdf-parse";
import { parseBudgetSheet, type ParsedRow } from "@/modules/projects/budget/tree";
import { getProject } from "@/modules/projects/queries";

/**
 * Lê um Excel (mapa de quantidades) ou um PDF (texto, por regras) e devolve a
 * árvore. Não grava: o cliente junta ao orçamento e guarda com `saveBudget`.
 * No PDF devolve também o cabeçalho do fornecedor (nome, NIF, telefone, email)
 * e as dúvidas por artigo.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!hasModule(user, "obras")) return NextResponse.json({ error: "Sem acesso ao módulo Obras." }, { status: 403 });
  const { id } = await params;
  const project = await getProject(user.organizationId, id);
  if (!project) return NextResponse.json({ error: "Obra não encontrada." }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta o ficheiro." }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Ficheiro acima de 10 MB." }, { status: 413 });

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      const parsed = parseBudgetText(text);
      if (parsed.tree.length === 0) {
        return NextResponse.json(
          { error: text.trim().length < 50 ? "O PDF não tem texto (digitalização?). Usa o Excel ou cria os artigos à mão." : "Não encontrei linhas de orçamento no PDF (código, descrição, unidade, quantidade, unitário, total)." },
          { status: 422 },
        );
      }
      return NextResponse.json({ source: "pdf", sheet: null, sheets: [], pages: totalPages, ...parsed });
    } catch (e) {
      console.error("[budget/import pdf]", e);
      return NextResponse.json({ error: "Não foi possível ler o PDF." }, { status: 500 });
    }
  }

  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
    const requested = String(form.get("sheet") ?? "");
    const sheetName =
      (requested && wb.SheetNames.includes(requested) ? requested : null) ??
      wb.SheetNames.find((n) => /or[cç]amento/i.test(n)) ??
      wb.SheetNames[0]!;
    const rows = XLSX.utils.sheet_to_json<ParsedRow>(wb.Sheets[sheetName]!, { header: 1, raw: true, defval: null });
    const parsed = parseBudgetSheet(rows);
    if (parsed.tree.length === 0) {
      return NextResponse.json({ error: `Não encontrei artigos na folha "${sheetName}". Esperado: colunas Artigo, Referência, Qtd., un, Unitário.`, sheets: wb.SheetNames }, { status: 422 });
    }
    return NextResponse.json({ source: "excel", sheet: sheetName, sheets: wb.SheetNames, doubts: [], header: null, ...parsed });
  } catch (e) {
    console.error("[budget/import]", e);
    return NextResponse.json({ error: "Não foi possível ler o Excel." }, { status: 500 });
  }
}
