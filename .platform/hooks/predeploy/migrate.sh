#!/usr/bin/env bash
set -euo pipefail

cd /var/app/staging

# hook에는 EB 환경변수가 자동으로 안 들어와서 직접 불러옴
eval "$(/opt/elasticbeanstalk/bin/get-config environment \
  | jq -r 'to_entries[] | "export \(.key)=\(.value | @sh)"')"

echo "[predeploy] Apply database migrations"
pnpm --filter api exec prisma migrate deploy
