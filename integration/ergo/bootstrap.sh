#!/bin/sh
# Ergo bootstrap for Sockethub integration tests.
#
# Seeds account jimmy/passw0rd on first start so SASL tests can log in
# without needing an external controller. Ergo has no YAML-level or CLI
# account seeding; the established pattern (used by ergochat's own irctest
# harness) is to drive NickServ REGISTER over a fresh IRC session.
#
# Behavior:
#   - Copies the mounted ircd.yaml into a writable location (the
#     upstream entrypoint expects to find it at /ircd/ircd.yaml and the
#     mount at /ircd-config is read-only via the compose volume).
#   - Starts ergo in the background, waits for :6667 to accept TCP,
#     then registers jimmy via NickServ.
#   - Only seeds on first run (when ircd.db does not yet exist).

set -e

SEED_NICK="jimmy"
SEED_PASS="passw0rd"
CONFIG_SRC="/ircd-config/ircd.yaml"
CONFIG_DST="/ircd/ircd.yaml"
DB_PATH="/ircd/ircd.db"

cp -f "$CONFIG_SRC" "$CONFIG_DST"

NEEDS_SEED=0
if [ ! -f "$DB_PATH" ]; then
    NEEDS_SEED=1
fi

/ircd-bin/ergo run --conf "$CONFIG_DST" &
ERGO_PID=$!

if [ "$NEEDS_SEED" = "1" ]; then
    # Wait up to ~15s for the plaintext listener to accept connections.
    i=0
    while [ $i -lt 60 ]; do
        if printf 'QUIT\r\n' | nc -w 1 127.0.0.1 6667 >/dev/null 2>&1; then
            break
        fi
        i=$((i+1))
        sleep 0.25
    done

    # NS REGISTER uses the current nick as account name; with no email
    # argument and enabled-callbacks=[none], ergo auto-verifies the account.
    printf 'NICK %s\r\nUSER %s 0 * :%s\r\nCAP END\r\nNS REGISTER %s\r\nQUIT\r\n' \
        "$SEED_NICK" "$SEED_NICK" "$SEED_NICK" "$SEED_PASS" \
        | nc -w 2 127.0.0.1 6667 >/dev/null 2>&1 || true
fi

wait "$ERGO_PID"
