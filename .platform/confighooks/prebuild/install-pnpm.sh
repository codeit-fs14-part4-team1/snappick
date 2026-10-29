#!/usr/bin/env bash
set -euo pipefail

# 설정 변경 배포 때도 앱 배포와 같은 설치를 실행
exec /var/app/staging/.platform/hooks/prebuild/install-pnpm.sh
