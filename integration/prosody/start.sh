#!/bin/bash
set -e

# Start prosody in background
prosody &
PROSODY_PID=$!

sleep 3

# Create users on each startup
echo -e "passw0rd\npassw0rd" | prosodyctl adduser jimmy@localhost || true
echo -e "passw0rd\npassw0rd" | prosodyctl adduser jimmy@prosody || true

echo "Users created"

# Keep prosody running in foreground
wait $PROSODY_PID
