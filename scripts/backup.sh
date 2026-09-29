#!/usr/bin/env bash
# Backup noturno da base de dados para o Cloudflare R2 (e opcionalmente uma pasta local).
#
# No VPS (Coolify): cron  15 3 * * *  /opt/loop-os/scripts/backup.sh >> /var/log/loop-backup.log 2>&1
# Requisitos: postgresql-client (pg_dump), rclone configurado com o remote "r2" (API S3 do R2).
#   rclone config → n → nome r2 → tipo s3 → provider Cloudflare → access key / secret → endpoint https://<account>.r2.cloudflarestorage.com
#
# Variáveis (em /etc/loop-os/backup.env, chmod 600):
#   DIRECT_URL=postgresql://...            ligação de sessão (porta 5432)
#   R2_BUCKET_BACKUPS=loop-backups         bucket dos backups (separado dos documentos)
#   LOCAL_DIR=/var/backups/loop-os         opcional: cópia local
#   RETENTION_DAYS=30
set -euo pipefail
source "${BACKUP_ENV:-/etc/loop-os/backup.env}"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d)"
FILE="$TMP/loop-os-$STAMP.sql.gz"
trap 'rm -rf "$TMP"' EXIT

echo "[$STAMP] pg_dump…"
pg_dump --no-owner --no-privileges --format=plain "$DIRECT_URL" | gzip -9 > "$FILE"
SIZE="$(du -h "$FILE" | cut -f1)"
echo "[$STAMP] dump $SIZE"

echo "[$STAMP] upload para r2:$R2_BUCKET_BACKUPS/db/"
rclone copy "$FILE" "r2:$R2_BUCKET_BACKUPS/db/" --s3-no-check-bucket

if [[ -n "${LOCAL_DIR:-}" ]]; then
  mkdir -p "$LOCAL_DIR"
  cp "$FILE" "$LOCAL_DIR/"
  find "$LOCAL_DIR" -name 'loop-os-*.sql.gz' -mtime +"${RETENTION_DAYS:-30}" -delete
fi

# Retenção no R2: apaga dumps com mais de RETENTION_DAYS.
rclone delete "r2:$R2_BUCKET_BACKUPS/db/" --min-age "${RETENTION_DAYS:-30}d" --s3-no-check-bucket || true

echo "[$STAMP] ok"
EOF
