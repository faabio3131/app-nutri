#!/bin/bash
# Backup do banco do NutriSnap (pg_dump comprimido, verificado, retencao de 14 dias).
# Uso: backup.sh [rotulo]   -> imprime "OK <arquivo>" ou sai com erro.
set -u
BASE=/opt/fm/nutrisnap
DEST=$BASE/backups
LABEL=${1:-diario}
mkdir -p "$DEST"; chmod 700 "$DEST"
getv(){ grep -E "^$1=" "$BASE/.env.db" | head -1 | cut -d= -f2-; }
U=$(getv POSTGRES_USER); D=$(getv POSTGRES_DB)
[ -n "$U" ] && [ -n "$D" ] || { echo "ERRO: .env.db sem POSTGRES_USER/POSTGRES_DB"; exit 1; }
F="$DEST/nutrisnap-$LABEL-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
umask 077
if ! docker exec nutrisnap-db pg_dump -U "$U" -d "$D" --no-owner | gzip -9 > "$F"; then
  rm -f "$F"; echo "ERRO: pg_dump falhou"; exit 1
fi
gzip -t "$F" && [ "$(stat -c %s "$F")" -gt 200 ] || { echo "ERRO: backup invalido"; rm -f "$F"; exit 1; }
sha256sum "$F" > "$F.sha256"
find "$DEST" -name 'nutrisnap-*.sql.gz*' -mtime +14 -delete
echo "OK $F"
