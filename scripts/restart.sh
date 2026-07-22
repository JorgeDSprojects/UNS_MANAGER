#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  echo ".env not found. Copy .env.example to .env and set values." >&2
  exit 1
fi

docker compose down
docker compose up -d "$@"
