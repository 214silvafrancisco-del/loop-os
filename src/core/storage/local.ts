import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter, StoredObject } from "./adapter";

/**
 * Disco local (pasta `.storage/` do projeto, ignorada pelo Git). Só para
 * desenvolvimento: em produção usa-se o R2.
 */
export class LocalStorage implements StorageAdapter {
  readonly kind = "local" as const;
  private root: string;

  constructor(root = path.join(process.cwd(), ".storage")) {
    this.root = root;
  }

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Chave inválida.");
    return full;
  }

  async putObject(key: string, body: Uint8Array, contentType: string) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    await writeFile(full + ".meta.json", JSON.stringify({ contentType }));
  }

  async getObject(key: string): Promise<StoredObject | null> {
    const full = this.resolve(key);
    try {
      const [data, info] = await Promise.all([readFile(full), stat(full)]);
      let contentType = "application/octet-stream";
      try {
        contentType = JSON.parse(await readFile(full + ".meta.json", "utf8")).contentType ?? contentType;
      } catch {}
      return { body: new Uint8Array(data), contentType, size: info.size };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string) {
    const full = this.resolve(key);
    await rm(full, { force: true });
    await rm(full + ".meta.json", { force: true });
  }

  async getSignedUrl() {
    return null;
  }
}
