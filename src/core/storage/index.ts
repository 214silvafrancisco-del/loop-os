import "server-only";
import type { StorageAdapter } from "./adapter";
import { LocalStorage } from "./local";
import { R2Storage } from "./r2";

export type { StorageAdapter } from "./adapter";
export { safeFileName } from "./adapter";

const globalForStorage = globalThis as unknown as { storageAdapter?: StorageAdapter };

/** R2 quando as quatro variáveis existem; senão, disco local (desenvolvimento). */
export function getStorage(): StorageAdapter {
  if (globalForStorage.storageAdapter) return globalForStorage.storageAdapter;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  const adapter: StorageAdapter =
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
      ? new R2Storage({ accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET })
      : new LocalStorage();
  if (process.env.NODE_ENV === "production" && adapter.kind === "local") {
    console.warn("[storage] R2 não configurado: a usar disco local em produção.");
  }
  globalForStorage.storageAdapter = adapter;
  return adapter;
}
