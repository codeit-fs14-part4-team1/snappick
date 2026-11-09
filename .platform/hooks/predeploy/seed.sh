#!/usr/bin/env bash
set -euo pipefail

cd /var/app/staging

# hook에는 EB 환경변수가 자동으로 안 들어와서 직접 불러옴
eval "$(/opt/elasticbeanstalk/bin/get-config environment \
  | jq -r 'to_entries[] | "export \(.key)=\(.value | @sh)"')"

# 목데이터는 SEED_MOCK_DATA=true인 환경에만 넣음 (이미 있는 행은 건너뜀)
if [[ "${SEED_MOCK_DATA:-}" != "true" ]]; then
  echo "[predeploy] Skip mock data seed"
  exit 0
fi

echo "[predeploy] Seed mock data"
DB_CREDENTIALS="$(aws secretsmanager get-secret-value --region ap-southeast-2 \
  --secret-id "$DB_ADMIN_SECRET_ARN" --query SecretString --output text)" \
  node apps/api/dist/scripts/seed.js
