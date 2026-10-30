#!/bin/bash
# Deploy do NutriSnap por "puxada": so implanta o que estiver na branch `production`
# (protegida; o merge do Fabio e a aprovacao). Uso: deploy.sh [run] | --check | status
# Roda a cada 5 min via cron com flock. Backup verificado antes; rollback automatico se a saude falhar.
cd /opt/fm/nutrisnap || exit 1
set -u
REF=${NUTRISNAP_REF:-production}
SRC=/opt/fm/nutrisnap/src
STATE=/opt/fm/nutrisnap/.deployed
FAILED=/opt/fm/nutrisnap/.failed-sha
MODE=${1:-run}
DC="docker compose -p nutrisnap -f $SRC/docker-compose.prod.yml"
log(){ echo "$(date -u +%FT%TZ) $*"; }
[ -f "$STATE" ] || echo "SHA=$(git -C "$SRC" rev-parse HEAD)" > "$STATE"
# shellcheck disable=SC1090
. "$STATE"
if [ "$MODE" = status ]; then echo "nutrisnap=$SHA"; exit 0; fi
N=$(git -C "$SRC" ls-remote origin "refs/heads/$REF" | head -1 | cut -f1)
[ -n "$N" ] || { [ "$MODE" = "--check" ] && echo "branch $REF nao encontrada"; exit 0; }
if [ "$N" = "$SHA" ]; then [ "$MODE" = "--check" ] && echo "sem mudancas (${SHA:0:7})"; exit 0; fi
if [ "$MODE" = "--check" ]; then echo "MUDARIA: ${SHA:0:7} -> ${N:0:7}"; exit 0; fi
[ "$(cat "$FAILED" 2>/dev/null)" = "$N" ] && exit 0
log "== DEPLOY inicio ${SHA:0:7}->${N:0:7}"
git -C "$SRC" fetch -q origin "refs/heads/$REF" || { log "falha no fetch"; exit 1; }
if ! git -C "$SRC" merge-base --is-ancestor "$SHA" "$N" 2>/dev/null; then
  log "RECUSADO: $N nao descende do implantado $SHA (historia reescrita). Nada foi alterado."; exit 2
fi
# Mudanca em docker/init.sql nao e aplicada em banco existente: exige revisao manual.
if git -C "$SRC" diff --name-only "$SHA" "$N" | grep -q '^docker/init.sql$'; then
  log "RECUSADO: docker/init.sql mudou; migracao de banco exige aprovacao manual. Nada foi alterado."; echo "$N" > "$FAILED"; exit 4
fi
log "backup do banco"
BK=$(/opt/fm/nutrisnap/backup.sh predeploy) || { log "FALHA no backup, abortando"; exit 3; }
BKFILE=${BK#OK }
sha256sum -c "$BKFILE.sha256" >/dev/null 2>&1 || { log "backup nao verificado, abortando"; exit 3; }
log "backup verificado: $BKFILE"
docker tag nutrisnap-backend:local nutrisnap-backend:prev
docker tag nutrisnap-frontend:local nutrisnap-frontend:prev
git -C "$SRC" checkout -q --detach "$N"
rollback(){
  log "ROLLBACK: $1"
  echo "$N" > "$FAILED"
  docker tag nutrisnap-backend:prev nutrisnap-backend:local
  docker tag nutrisnap-frontend:prev nutrisnap-frontend:local
  git -C "$SRC" checkout -q --detach "$SHA"
  $DC up -d --no-build backend frontend >/dev/null 2>&1
  log "ROLLBACK concluido (versao anterior no ar: ${SHA:0:7})"; exit 1
}
log "build"; $DC build backend frontend > /tmp/nutrisnap-build.log 2>&1 || rollback "build falhou (ver /tmp/nutrisnap-build.log)"
log "subindo"; $DC up -d db backend frontend 2>&1 | tail -n 3
ok=0
for i in $(seq 1 30); do
  A=$(docker exec nutrisnap-backend wget -qO- http://127.0.0.1:8080/api/v1/health 2>/dev/null | grep -c .)
  W=$(docker exec nutrisnap-frontend wget -qO- http://127.0.0.1/landing/ 2>/dev/null | grep -c .)
  [ "$A" -gt 0 ] && [ "$W" -gt 0 ] && { ok=1; break; }; sleep 4
done
[ $ok = 1 ] || rollback "saude falhou (api=$A web=$W)"
echo "SHA=$N" > "$STATE"; rm -f "$FAILED"
docker image prune -f >/dev/null 2>&1
log "== DEPLOY OK ${N:0:7}"
