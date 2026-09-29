import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, StoredObject } from "./adapter";

/** Cloudflare R2 através da API S3. */
export class R2Storage implements StorageAdapter {
  readonly kind = "r2" as const;
  private client: S3Client;
  private bucket: string;

  constructor(env: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.bucket = env.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    });
  }

  async putObject(key: string, body: Uint8Array, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getObject(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      return {
        body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
        contentType: res.ContentType ?? "application/octet-stream",
        size: res.ContentLength ?? 0,
      };
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }

  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, o: { filename: string; inline: boolean; expiresInSeconds: number }) {
    const disposition = `${o.inline ? "inline" : "attachment"}; filename="${o.filename}"; filename*=UTF-8''${encodeURIComponent(o.filename)}`;
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition });
    return presign(this.client, cmd, { expiresIn: o.expiresInSeconds });
  }
}
