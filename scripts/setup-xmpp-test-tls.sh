#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
cert_dir=integration/prosody/certs
mkdir -p "$cert_dir"

if [ -f "$cert_dir/test.key" ] &&
    openssl x509 -in "$cert_dir/test.crt" -checkend 86400 -noout 2>/dev/null; then
    exit 0
fi

# Disposable fixture certificate; trust only in integration test processes.
openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
    -keyout "$cert_dir/test.key" -out "$cert_dir/test.crt" \
    -config /dev/stdin <<'EOF'
[req]
distinguished_name = dn
x509_extensions = extensions
prompt = no
[dn]
CN = prosody
[extensions]
subjectAltName = DNS:localhost,DNS:prosody
basicConstraints = critical,CA:TRUE
keyUsage = critical,digitalSignature,keyEncipherment,keyCertSign
extendedKeyUsage = serverAuth
EOF

# The container runs as prosody with a different UID; this key is test-only.
chmod 755 "$cert_dir"
chmod 644 "$cert_dir/test.key" "$cert_dir/test.crt"
