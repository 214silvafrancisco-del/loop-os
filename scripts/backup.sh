#!/usr/bin/env bash
# Backup noturno da base de dados (Supabase Postgres 17) para o Cloudflare R2.
#
# Instalado no servidor em /opt/loop-os/backup.sh, cron diário (ver docs/05-deploy.md §7).
# Requisitos: postgresql-client-17 (repositório PGDG) e rclone.
#
# Configuração (ficheiros com chmod 600, fora do repositório):
#   /etc/loop-os/backup.env     DIRECT_URL, R2_BUCKET_BACKUPS, LOCAL_DIR, RETENTION_DAYS
#   /etc/loop-os/rclone.conf    remote [r2] tipo s3, provider Cloudflare
#
# Formato: pg_dump custom (-Fc), comprimido; restaura-se com pg_restore, inclusive só o
# schema public:  pg_restore --no-owner --no-privileges -n public -d <url> loop-os-<data>.dump
set -euo pipefail
umask 077   # dumps só legíveis pelo root
source "${BACKUP_ENV:-/etc/loop-os/backup.env}"
export RCLONE_CONFIG="${RCLONE_CONFIG:-/etc/loop-os/rclone.conf}"
PG_DUMP="${PG_DUMP:-/usr/lib/postgresql/17/bin/pg_dump}"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d)"
FILE="$TMP/loop-os-$STAMP.dump"
trap 'rm -rf "$TMP"' EXIT

echo "[$STAMP] pg_dump…"
"$PG_DUMP" --no-owner --no-privileges --format=custom --compress=9 --file="$FILE" "$DIRECT_URL"
SIZE="$(du -h "$FILE" | cut -f1)"
echo "[$STAMP] dump $SIZE"

echo "[$STAMP] upload para r2:$R2_BUCKET_BACKUPS/db/"
rclone copy "$FILE" "r2:$R2_BUCKET_BACKUPS/db/" --s3-no-check-bucket

if [[ -n "${LOCAL_DIR:-}" ]]; then
  mkdir -p "$LOCAL_DIR"
  cp "$FILE" "$LOCAL_DIR/"
  find "$LOCAL_DIR" -name 'loop-os-*.dump' -mtime +"${RETENTION_DAYS:-30}" -delete
fi

# Retenção no R2.
rclone delete "r2:$R2_BUCKET_BACKUPS/db/" --min-age "${RETENTION_DAYS:-30}d" --s3-no-check-bucket || true

echo "[$STAMP] ok"
