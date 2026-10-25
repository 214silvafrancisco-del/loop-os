"use client";

import { ExternalLink, FileDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { exportMeasurementPdf } from "../measurements/actions";

/**
 * Gera o PDF do auto, arquiva-o nos Documentos da obra e abre-o num separador
 * novo (no telemóvel, o visualizador de PDF tem o botão de partilhar). Se o
 * browser bloquear a abertura automática, fica o link «Abrir PDF».
 */
export function ExportAutoButton({ reportId, projectId, status }: { reportId: string; projectId: string; status: "draft" | "closed" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ url: string; fileName: string } | null>(null);

  function run() {
    setError(null);
    setReady(null);
    startTransition(async () => {
      const r = await exportMeasurementPdf(reportId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const url = `/api/documents/${r.versionId}/download?inline=1`;
      setReady({ url, fileName: r.fileName });
      try {
        window.open(url, "_blank", "noopener");
      } catch {
        // bloqueado: fica o link
      }
      router.refresh();
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={run} disabled={pending} title={status === "draft" ? "O PDF fica marcado como rascunho" : "Gera o PDF e arquiva-o nos Documentos da obra"}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
        {pending ? "A gerar…" : "Exportar PDF"}
      </Button>
      {ready ? (
        <span className="flex items-center gap-2 text-xs">
          <a href={ready.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-primary hover:underline">
            <ExternalLink className="size-3.5" /> Abrir PDF
          </a>
          <Link href={`/projects/${projectId}/documentos`} className="text-muted-foreground hover:underline">
            arquivado nos Documentos
          </Link>
        </span>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
