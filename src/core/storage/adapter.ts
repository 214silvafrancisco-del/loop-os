/**
 * Adaptador de ficheiros. A app só fala com esta interface; a implementação
 * (R2 em produção, disco local em desenvolvimento) é escolhida por `index.ts`.
 * As chaves nunca são expostas ao browser: o download passa sempre pelo
 * servidor, que verifica a sessão e a organização.
 */
export type StoredObject = {
  body: ReadableStream<Uint8Array> | Uint8Array;
  contentType: string;
  size: number;
};

export interface StorageAdapter {
  readonly kind: "r2" | "local";
  putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
  /**
   * URL temporário para o browser descarregar diretamente (R2). `null` quando
   * o adaptador não suporta, e o servidor faz stream do ficheiro.
   */
  getSignedUrl(key: string, options: { filename: string; inline: boolean; expiresInSeconds: number }): Promise<string | null>;
}

/** Nome de ficheiro seguro para chave e cabeçalhos: sem caminhos nem caracteres estranhos. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "ficheiro";
  return (
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 120) || "ficheiro"
  );
}
