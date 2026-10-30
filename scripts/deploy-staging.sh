#!/usr/bin/env bash
# staging API 수동 배포
# 사용법: ./scripts/deploy-staging.sh <버전 번호>   (예: ./scripts/deploy-staging.sh 3 → api-v3-YYYYMMDDHHMMSS)
set -euo pipefail

REGION="ap-southeast-2"
APP_NAME="snappick-staging-api"
ENV_NAME="snappick-staging-api-env"
BUCKET="elasticbeanstalk-ap-southeast-2-982515248685"
HEALTH_URL="https://snappick-api.duckdns.org/health/db"

if [[ $# -ne 1 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "사용법: $0 <버전 번호>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

VERSION="api-v$1-$(date +%Y%m%d%H%M%S)"
KEY="snappick-api/$VERSION.zip"
COMMIT="$(git rev-parse --short HEAD)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[warn] 커밋하지 않은 변경이 있습니다. 배포 내용과 커밋 $COMMIT 이 다를 수 있습니다."
fi

echo "[1/5] AWS 로그인 확인"
aws sts get-caller-identity --query Account --output text >/dev/null

echo "[2/5] 빌드"
pnpm --filter @snappick/shared build
pnpm --filter api build

echo "[3/5] 배포 번들 생성: out/$VERSION.zip"
mkdir -p out
zip -rq "out/$VERSION.zip" \
  package.json pnpm-workspace.yaml pnpm-lock.yaml Procfile .platform \
  packages/shared/package.json packages/shared/dist \
  apps/api/package.json apps/api/dist apps/api/prisma apps/api/prisma.config.ts \
  apps/api/src/config/database-url.ts apps/api/certs \
  -x '*.DS_Store'

echo "[4/5] 업로드 및 버전 등록"
aws s3 cp "out/$VERSION.zip" "s3://$BUCKET/$KEY" --region "$REGION"
aws elasticbeanstalk create-application-version --region "$REGION" \
  --application-name "$APP_NAME" \
  --version-label "$VERSION" \
  --description "commit $COMMIT" \
  --source-bundle "S3Bucket=$BUCKET,S3Key=$KEY" \
  --process >/dev/null

while true; do
  STATUS="$(aws elasticbeanstalk describe-application-versions --region "$REGION" \
    --application-name "$APP_NAME" --version-labels "$VERSION" \
    --query 'ApplicationVersions[0].Status' --output text)"
  [[ "$STATUS" == "PROCESSED" ]] && break
  if [[ "$STATUS" == "FAILED" ]]; then
    echo "버전 처리 실패: $VERSION" >&2
    exit 1
  fi
  sleep 3
done

echo "[5/5] 환경 업데이트: $VERSION"
aws elasticbeanstalk update-environment --region "$REGION" \
  --environment-name "$ENV_NAME" \
  --version-label "$VERSION" >/dev/null
aws elasticbeanstalk wait environment-updated --region "$REGION" \
  --environment-names "$ENV_NAME"

aws elasticbeanstalk describe-environments --region "$REGION" \
  --environment-names "$ENV_NAME" \
  --query 'Environments[0].[VersionLabel,Status,Health]' --output text

echo "헬스체크: $HEALTH_URL"
curl -fsS "$HEALTH_URL"
echo
