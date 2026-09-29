import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/core/auth/current-user";
import { addDocumentVersion, createDocumentWithFile, MAX_FILE_BYTES, mimeFromName } from "@/modules/documents/service";

const metaSchema = z.object({
  mode: z.enum(["create", "version"]),
  documentId: z.uuid().optional(),
  propertyId: z.uuid().optional(),
  entityType: z.enum(["property", "deal", "project", "sale", "invoice", "proposal", "measurement_report"]).optional(),
  entityId: z.uuid().optional(),
  categoryId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  docDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * Upload multipart. `mode=create` cria o documento; `mode=version` acrescenta
 * uma versão a um documento existente. O ficheiro nunca passa pelo browser
 * para o storage: entra aqui, é validado e guardado pelo adaptador.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta o ficheiro." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "Ficheiro vazio." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Ficheiro acima de 50 MB." }, { status: 413 });

  const mimeType = mimeFromName(file.name, file.type);
  if (!mimeType) return NextResponse.json({ error: "Tipo de ficheiro não suportado." }, { status: 415 });

  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (k !== "file") raw[k] = v === "" ? null : v;
  const meta = metaSchema.safeParse(raw);
  if (!meta.success) return NextResponse.json({ error: meta.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const payload = { fileName: file.name, mimeType, bytes };

  try {
    if (meta.data.mode === "version") {
      if (!meta.data.documentId) return NextResponse.json({ error: "Falta o documento." }, { status: 400 });
      const result = await addDocumentVersion(user, meta.data.documentId, payload, meta.data.note ?? null);
      revalidatePath("/deals");
      revalidatePath("/properties");
      return NextResponse.json(result);
    }
    const { propertyId, entityType, entityId } = meta.data;
    if (!propertyId || !entityType || !entityId) return NextResponse.json({ error: "Falta o contexto do documento." }, { status: 400 });
    const result = await createDocumentWithFile(
      user,
      {
        propertyId,
        entityType,
        entityId,
        categoryId: meta.data.categoryId ?? null,
        name: meta.data.name ?? file.name.replace(/\.[^.]+$/, ""),
        description: meta.data.description ?? null,
        docDate: meta.data.docDate ?? null,
      },
      payload,
    );
    revalidatePath("/deals");
    revalidatePath("/properties");
    return NextResponse.json(result);
  } catch (e) {
    console.error("[documents/upload]", e);
    return NextResponse.json({ error: "Não foi possível guardar o ficheiro." }, { status: 500 });
  }
}
