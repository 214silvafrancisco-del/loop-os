"use client";

import { Download, Eye, FileText, Image as ImageIcon, MoreHorizontal, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDate } from "@/core/lib/format";
import { FormField, NativeSelect } from "@/core/ui/form-field";
import { deleteDocument, updateDocumentMeta } from "../actions";
import { compressImageIfNeeded } from "../compress-image";
import type { DocumentEntityType, DocumentRow } from "../queries";

type Category = { id: string; name: string; group: string; defaultEntity: string | null };

type Props = {
  context: { propertyId: string; entityType: DocumentEntityType; entityId: string };
  documents: DocumentRow[];
  categories: Category[];
  canDelete: boolean;
  /** Mostra a origem (imóvel / negócio / obra) ao lado de cada documento. */
  showOrigin?: boolean;
};

const GROUP_LABEL: Record<string, string> = { imovel: "Imóvel", juridico: "Jurídico", financeiro: "Financeiro", tecnico: "Técnico", comercial: "Comercial" };
const GROUP_ORDER = ["imovel", "juridico", "financeiro", "tecnico", "comercial"];
const ENTITY_LABEL: Record<string, string> = { property: "imóvel", deal: "negócio", project: "obra", sale: "venda", invoice: "fatura", proposal: "proposta", measurement_report: "auto" };

function sizeLabel(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const canPreview = (mime: string | null) => !!mime && (mime === "application/pdf" || mime.startsWith("image/"));
const LAST_CATEGORY_KEY = "docs.lastCategory";

export function DocumentsPanel({ context, documents, categories, canDelete, showOrigin }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const versionInput = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<DocumentRow | null>(null);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [versionTarget, setVersionTarget] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const defaultCategoryId = (() => {
    try {
      const last = localStorage.getItem(LAST_CATEGORY_KEY);
      if (last && categories.some((c) => c.id === last)) return last;
    } catch {}
    return categories.find((c) => c.defaultEntity === context.entityType)?.id ?? categories[0]?.id ?? "";
  })();

  function pick(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length) setPendingFiles(list);
  }

  async function upload(formData: FormData) {
    const categoryId = String(formData.get("categoryId") ?? "");
    const docDate = String(formData.get("docDate") ?? "");
    const description = String(formData.get("description") ?? "");
    try {
      localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
    } catch {}
    setUploading(true);
    setError(null);
    try {
      for (const [i, original] of pendingFiles.entries()) {
        setProgress(`${i + 1}/${pendingFiles.length} · ${original.name}`);
        const file = await compressImageIfNeeded(original);
        const body = new FormData();
        body.set("mode", "create");
        body.set("file", file);
        body.set("propertyId", context.propertyId);
        body.set("entityType", context.entityType);
        body.set("entityId", context.entityId);
        body.set("categoryId", categoryId);
        body.set("name", pendingFiles.length === 1 ? String(formData.get("name") ?? "") || file.name : file.name.replace(/\.[^.]+$/, ""));
        body.set("docDate", docDate);
        body.set("description", description);
        const res = await fetch("/api/documents/upload", { method: "POST", body });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erro ${res.status}`);
      }
      setPendingFiles([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function uploadVersion(documentId: string, file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("mode", "version");
      body.set("file", await compressImageIfNeeded(file));
      body.set("documentId", documentId);
      const res = await fetch("/api/documents/upload", { method: "POST", body });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erro ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  function remove(doc: DocumentRow) {
    if (!confirm(`Eliminar "${doc.name}"?`)) return;
    startTransition(async () => {
      const r = await deleteDocument(doc.id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  function saveMeta(formData: FormData) {
    if (!editing) return;
    startTransition(async () => {
      const r = await updateDocumentMeta(editing.id, {
        name: String(formData.get("name") ?? ""),
        categoryId: String(formData.get("categoryId") ?? "") || null,
        docDate: String(formData.get("docDate") ?? "") || null,
        description: String(formData.get("description") ?? "") || null,
      });
      if (!r.ok) return setError(r.error);
      setEditing(null);
      router.refresh();
    });
  }

  const groups = GROUP_ORDER.map((g) => ({
    key: g,
    label: GROUP_LABEL[g] ?? g,
    docs: documents.filter((d) => (d.categoryGroup ?? "outros") === g),
  })).filter((g) => g.docs.length);
  const ungrouped = documents.filter((d) => !d.categoryGroup);

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card",
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <p>
          Arrasta ficheiros para aqui ou{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => fileInput.current?.click()}>
            escolhe no computador
          </button>
        </p>
        <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOCX, XLSX, ZIP, DWG · até 50 MB · fotografias são comprimidas</p>
        <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => e.target.files && pick(e.target.files)} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Ainda sem documentos.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {[...groups, ...(ungrouped.length ? [{ key: "outros", label: "Sem categoria", docs: ungrouped }] : [])].map((g) => (
            <section key={g.key}>
              <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                📁 {g.label} <span className="font-normal normal-case">({g.docs.length})</span>
              </h3>
              <ul className="divide-y rounded-lg border bg-card">
                {g.docs.map((d) => {
                  const isImage = d.mimeType?.startsWith("image/");
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{isImage ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <button type="button" className="truncate font-medium hover:underline" onClick={() => (canPreview(d.mimeType) ? setPreview(d) : window.open(`/api/documents/${d.versionId}/download`, "_blank"))}>
                            {d.name}
                          </button>
                          {d.categoryName ? <span className="text-xs text-muted-foreground">{d.categoryName}</span> : null}
                          {showOrigin && d.entityType !== context.entityType ? (
                            <span className="rounded bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">do {ENTITY_LABEL[d.entityType] ?? d.entityType}</span>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {d.fileName} · {sizeLabel(d.sizeBytes)} · v{d.versionNo ?? 1}
                          {d.docDate ? ` · doc. ${formatDate(d.docDate)}` : ""} · carregado {formatDate(d.uploadedAt)} por {d.uploaderName ?? "—"}
                          {d.description ? ` · ${d.description}` : ""}
                        </div>
                      </div>
                      {canPreview(d.mimeType) ? (
                        <Button variant="ghost" size="icon" className="size-8" title="Pré-visualizar" onClick={() => setPreview(d)}>
                          <Eye className="size-4" />
                        </Button>
                      ) : null}
                      <Button asChild variant="ghost" size="icon" className="size-8" title="Descarregar">
                        <a href={`/api/documents/${d.versionId}/download`}>
                          <Download className="size-4" />
                        </a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded-md p-1.5 hover:bg-accent" aria-label="Mais opções">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(d)}>
                            <Pencil className="size-4" /> Editar dados
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setVersionTarget(d.id); versionInput.current?.click(); }}>
                            <Paperclip className="size-4" /> Nova versão
                          </DropdownMenuItem>
                          {canDelete ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => remove(d)}>
                                <Trash2 className="size-4" /> Eliminar
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <input
        ref={versionInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && versionTarget) void uploadVersion(versionTarget, f);
          e.target.value = "";
        }}
      />

      {/* Diálogo de upload */}
      <Dialog open={pendingFiles.length > 0} onOpenChange={(o) => !o && !uploading && setPendingFiles([])}>
        <DialogContent>
          <form action={upload}>
            <DialogHeader>
              <DialogTitle>{pendingFiles.length === 1 ? "Novo documento" : `${pendingFiles.length} documentos`}</DialogTitle>
              <DialogDescription>
                {pendingFiles.map((f) => f.name).slice(0, 5).join(", ")}
                {pendingFiles.length > 5 ? "…" : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 grid gap-3">
              {pendingFiles.length === 1 ? (
                <FormField id="up-name" label="Nome">
                  <Input id="up-name" name="name" defaultValue={pendingFiles[0]!.name.replace(/\.[^.]+$/, "")} autoFocus />
                </FormField>
              ) : null}
              <FormField id="up-cat" label="Categoria">
                <NativeSelect id="up-cat" name="categoryId" defaultValue={defaultCategoryId}>
                  {GROUP_ORDER.map((g) => (
                    <optgroup key={g} label={GROUP_LABEL[g]}>
                      {categories.filter((c) => c.group === g).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="up-date" label="Data do documento (opcional)">
                <Input id="up-date" name="docDate" type="date" />
              </FormField>
              <FormField id="up-desc" label="Descrição (opcional)">
                <Textarea id="up-desc" name="description" rows={2} />
              </FormField>
            </div>
            {progress ? <p className="mb-2 text-xs text-muted-foreground">A carregar {progress}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendingFiles([])} disabled={uploading}>Cancelar</Button>
              <Button type="submit" disabled={uploading}>{uploading ? "A carregar…" : "Carregar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar metadados */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing ? (
            <form action={saveMeta}>
              <DialogHeader>
                <DialogTitle>Editar documento</DialogTitle>
              </DialogHeader>
              <div className="my-4 grid gap-3">
                <FormField id="ed-name" label="Nome"><Input id="ed-name" name="name" defaultValue={editing.name} required /></FormField>
                <FormField id="ed-cat" label="Categoria">
                  <NativeSelect id="ed-cat" name="categoryId" defaultValue={editing.categoryId ?? ""}>
                    <option value="">—</option>
                    {GROUP_ORDER.map((g) => (
                      <optgroup key={g} label={GROUP_LABEL[g]}>
                        {categories.filter((c) => c.group === g).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id="ed-date" label="Data do documento"><Input id="ed-date" name="docDate" type="date" defaultValue={editing.docDate ?? ""} /></FormField>
                <FormField id="ed-desc" label="Descrição"><Textarea id="ed-desc" name="description" rows={2} defaultValue={editing.description ?? ""} /></FormField>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Pré-visualização */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] w-[min(96vw,64rem)] max-w-none overflow-hidden p-0 sm:max-w-none">
          {preview ? (
            <div className="flex h-[85vh] flex-col">
              <DialogHeader className="border-b px-4 py-3">
                <DialogTitle className="text-sm">{preview.name} <span className="font-normal text-muted-foreground">· {preview.fileName}</span></DialogTitle>
              </DialogHeader>
              {preview.mimeType?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/documents/${preview.versionId}/download?inline=1`} alt={preview.name} className="h-full w-full object-contain bg-muted" />
              ) : (
                <iframe src={`/api/documents/${preview.versionId}/download?inline=1`} title={preview.name} className="h-full w-full" />
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
