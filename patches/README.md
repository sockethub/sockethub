# Dependency patches

Applied automatically on `bun install` via `patchedDependencies` in the root
`package.json`. Both patches target the `@xmpp/*` packages pinned at `0.13.3`
(the versions pulled in by `@xmpp/client@0.13.6`).

## Why

`@xmpp/resolve` resolves the XMPP SRV target down to A/AAAA records and builds
connection URIs from the raw IP addresses (so it can cycle through them). It
never carries the SRV hostname — or the JID domain — through to the TLS layer,
and `@xmpp/client-core` never sets `servername`. Direct TLS (`xmpps://`) is
therefore validated against the bare IP and fails with
`ERR_TLS_CERT_ALTNAME_INVALID`. The client then falls back to plaintext
STARTTLS, which the Bun runtime mis-upgrades (oven-sh/bun#36534), leaking the
TLS handshake into the XML parser and surfacing as
`Illegal XML entity &…;` on connect.

## What the patches do

Both set `servername` to the JID's domain (XEP-0368 §3 (Requirements), rule 6)
on the transport parameters, leaving the IP-based candidate list and
per-address failover intact:

- `@xmpp/resolve` — `fallbackConnect()` (the SRV / bare-domain path)
- `@xmpp/client-core` — `Client#socketParameters()` (explicit-scheme `service`)

`@xmpp/tls` needs no change: `tls.connect({ port, host, servername })` already
honours `servername`, and STARTTLS already passes `{ host: domain }`.

## Removing

Drop these patches and the `patchedDependencies` entries once the fix is
released upstream (<https://github.com/xmppjs/xmpp.js>) and the `@xmpp/*`
dependencies are bumped to a version that includes it. The upstream change is
the same: set SNI to the JID domain without discarding the resolved IPs.
