// Copia os ficheiros de .storage/ (adaptador local) para o R2, com as mesmas chaves.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
const { R2_ACCOUNT_ID: acc, R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET: bucket } = process.env;
const s3 = new S3Client({ region: "auto", endpoint: `https://${acc}.r2.cloudflarestorage.com`, credentials: { accessKeyId: id, secretAccessKey: secret } });
const root = path.join(process.cwd(), ".storage");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let copied = 0, skipped = 0;
for (const file of walk(root).filter((f) => !f.endsWith(".meta.json"))) {
  const key = path.relative(root, file).split(path.sep).join("/");
  let contentType = "application/octet-stream";
  try { contentType = JSON.parse(readFileSync(file + ".meta.json", "utf8")).contentType ?? contentType; } catch {}
  try { await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); skipped++; continue; } catch {}
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: readFileSync(file), ContentType: contentType }));
  copied++;
  console.log("copiado:", key);
}
console.log(`total: ${copied} copiados, ${skipped} já existiam`);
