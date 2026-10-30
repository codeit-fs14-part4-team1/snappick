#!/usr/bin/env bash
set -euo pipefail

exec /var/app/current/.platform/hooks/postdeploy/certbot.sh
