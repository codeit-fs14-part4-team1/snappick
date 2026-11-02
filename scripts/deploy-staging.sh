#!/usr/bin/env bash
# staging API 수동 배포
# 사용법: ./scripts/deploy-staging.sh <버전 번호> [--bundle-only | <zip 경로>]
#   <버전 번호>만: 빌드부터 배포까지 (예: 3 → api-v3-YYYYMMDDHHMMSS)
#   --bundle-only: out/에 zip만 생성 (AWS 호출 없음)
#   <zip 경로>: 빌드 없이 해당 zip으로 배포
set -euo pipefail

REGION="ap-southeast-2"
APP_NAME="snappick-staging-api"
ENV_NAME="snappick-staging-api-env"
BUCKET="elasticbeanstalk-ap-southeast-2-982515248685"
HEALTH_URL="https://snappick-api.duckdns.org/health/db"

# 인자가 1~2개가 아니거나, 숫자로 구성되지 않았으면 버전번호를 안내해라(에러로)
if [[ $# -lt 1 || $# -gt 2 || ! "$1" =~ ^[0-9]+$ ]]; then
  echo "사용법: $0 <버전 번호> [--bundle-only | <zip 경로>]" >&2
  exit 1 #종료
fi

cd "$(dirname "$0")/.."

# 배포
MODE="deploy"
ZIP=""
ARG2="${2:-}"

# 번들 조건
if [[ "$ARG2" == "--bundle-only" ]];then
  MODE="bundle"
elif [[ -n "$ARG2" ]]; then # 비어있지 않음
  if [[ ! -f "$ARG2" ]]; then # 파일이 없음
    echo "zip 파일이 없습니다: $ARG2" >&2
    exit 1
  fi
  ZIP="$ARG2"
fi

# 파일네이밍
if [[ -n "$ZIP" ]]; then
  VERSION="$(basename "$ZIP" .zip)"
else
  VERSION="api-v$1-$(date -u +%Y%m%d%H%M%S)"
fi
KEY="snappick-api/$VERSION.zip"
COMMIT="$(git rev-parse --short HEAD)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[warn] 커밋하지 않은 변경이 있습니다. 배포 내용과 커밋 $COMMIT 이 다를 수 있습니다."
fi

if [[ "$MODE" != "bundle" ]]; then
  echo "AWS 로그인 확인"
  aws sts get-caller-identity --query Account --output text >/dev/null
fi

if [[ -z "$ZIP" ]];then
  echo "빌드"
  pnpm --filter @snappick/shared build
  pnpm --filter api build

  ZIP="out/$VERSION.zip"
  echo "배포 번들 생성: $ZIP"
  mkdir -p out
  zip -rq "$ZIP" \
    package.json pnpm-workspace.yaml pnpm-lock.yaml Procfile .platform \
    packages/shared/package.json packages/shared/dist \
    apps/api/package.json apps/api/dist apps/api/prisma apps/api/prisma.config.ts \
    apps/api/src/config/database-url.ts apps/api/certs \
    -x '*.DS_Store'
fi

if [[ "$MODE" == "bundle" ]]; then
  echo "번들 생성 완료: $ZIP"
  exit 0 #성공
fi

echo "업로드 및 버전 등록"
aws s3 cp "$ZIP" "s3://$BUCKET/$KEY" --region "$REGION"
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

echo "환경 업데이트: $VERSION"
aws elasticbeanstalk update-environment --region "$REGION" \
  --environment-name "$ENV_NAME" \
  --version-label "$VERSION" >/dev/null
aws elasticbeanstalk wait environment-updated --region "$REGION" \
  --environment-names "$ENV_NAME"

# wait는 배포가 실패해서 이전 버전으로 돌아가도 Ready면 통과하므로 실제 버전을 비교
DEPLOYED="$(aws elasticbeanstalk describe-environments --region "$REGION" \
  --environment-names "$ENV_NAME" \
  --query 'Environments[0].VersionLabel' --output text)"
if [[ "$DEPLOYED" != "$VERSION" ]]; then
  echo "배포 실패: 실행 중인 버전이 $DEPLOYED 입니다 (기대: $VERSION). EB 이벤트를 확인하세요." >&2
  exit 1
fi
echo "배포 완료: $DEPLOYED"

echo "헬스체크: $HEALTH_URL"
curl -fsS "$HEALTH_URL"
echo
