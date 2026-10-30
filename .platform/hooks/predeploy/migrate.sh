#!/usr/bin/env bash
set -euo pipefail

cd /var/app/staging

# hook에는 EB 환경변수가 자동으로 안 들어와서 직접 불러옴
eval "$(/opt/elasticbeanstalk/bin/get-config environment \
  | jq -r 'to_entries[] | "export \(.key)=\(.value | @sh)"')"

echo "[predeploy] Apply database migrations"
DB_CREDENTIALS="$(aws secretsmanager get-secret-value --region ap-southeast-2 \
  --secret-id "$DB_ADMIN_SECRET_ARN" --query SecretString --output text)" \
  pnpm --filter api exec prisma migrate deploy
