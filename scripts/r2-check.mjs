// Testa o acesso ao R2 (escrever, ler, apagar) sem imprimir credenciais.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
const { R2_ACCOUNT_ID: acc, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET } = process.env;
const mask = (v) => (v ? `ok (${v.length} chars)` : "VAZIO");
console.log("R2_ACCOUNT_ID", mask(acc), "| R2_ACCESS_KEY_ID", mask(id), "| R2_SECRET_ACCESS_KEY", mask(secret), "| R2_BUCKET", R2_BUCKET || "VAZIO");
if (!acc || !id || !secret) process.exit(1);
const s3 = new S3Client({ region: "auto", endpoint: `https://${acc.trim()}.r2.cloudflarestorage.com`, credentials: { accessKeyId: id.trim(), secretAccessKey: secret.trim() } });
for (const bucket of [R2_BUCKET || "loop-documents", "loop-backups"]) {
  const key = `_healthcheck/${Date.now()}.txt`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "ok", ContentType: "text/plain" }));
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await r.Body.transformToString();
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`${bucket}: escrever/ler/apagar OK (${body})`);
  } catch (e) {
    console.log(`${bucket}: FALHOU → ${e.name}: ${e.message}`);
  }
}
