#!/usr/bin/env bash
# Retry docker compose commands that pull external images (e.g. ghcr.io/ergochat/ergo).
set -euo pipefail

if [ "$#" -eq 0 ]; then
    echo "Usage: scripts/docker-compose-retry.sh <docker compose arguments...>" >&2
    exit 1
fi

max_attempts=5
delay_seconds=10

for ((attempt = 1; attempt <= max_attempts; attempt++)); do
    if docker compose "$@"; then
        exit 0
    fi

    if [ "$attempt" -eq "$max_attempts" ]; then
        echo "docker compose $* failed after ${max_attempts} attempts" >&2
        exit 1
    fi

    echo "docker compose $* failed (attempt ${attempt}/${max_attempts}); retrying in ${delay_seconds}s..." >&2
    sleep "$delay_seconds"
    delay_seconds=$((delay_seconds * 2))
done
