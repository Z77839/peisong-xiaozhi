#!/bin/bash
# ============================================
# 配送小智 - PostgreSQL 自动备份脚本
# 建议加入 crontab: 0 2 * * * /path/backup-db.sh
# ============================================

set -e

# 配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-peisong}"
DB_USER="${DB_USER:-peisong}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/peisong}"
KEEP_DAYS="${KEEP_DAYS:-30}"  # 保留 30 天

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/peisong_${TIMESTAMP}.sql.gz"

# 备份（gzip 压缩）
echo "[$(date)] 开始备份: $BACKUP_FILE"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner --no-acl \
  --clean --if-exists \
  | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] 备份成功: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] 备份失败！"
  exit 1
fi

# 清理 30 天前的备份
find "$BACKUP_DIR" -name "peisong_*.sql.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] 已清理 $KEEP_DAYS 天前的旧备份"

# 上传到云存储（可选 - 阿里云 OSS）
# ossutil cp "$BACKUP_FILE" oss://your-bucket/db-backups/ 2>/dev/null || true

echo "[$(date)] 备份完成"
