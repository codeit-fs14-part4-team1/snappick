#!/usr/bin/env bash

set -euo pipefail

cd /var/app/staging

echo "[prebuild] Install pnpm 10.34.7"
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@10.34.7
fi
pnpm --version

echo "[prebuild] Install production dependencies"
pnpm install --prod --frozen-lockfile --ignore-scripts

echo "[prebuild] pnpm installation completed"
