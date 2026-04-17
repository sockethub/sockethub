/**
 * Minimal OAuth2 token introspection endpoint (RFC 7662) used only by the
 * integration tests. Ergo POSTs the SASL OAUTHBEARER token here and treats
 * `active: true` as a successful authentication, using `username` as the
 * IRC account name.
 *
 * Intentionally not a real OAuth2 server: it accepts a single hardcoded
 * token (TEST_TOKEN) and maps it to a fixed account. Any other token
 * returns `active: false`, which Ergo surfaces to the client as a SASL
 * failure.
 */

import http from "node:http";

const PORT = Number(process.env.PORT) || 8080;
const TEST_TOKEN = process.env.TEST_TOKEN || "integration-test-token";
// Distinct from the NickServ-seeded `jimmy` used by SASL PLAIN tests.
// Ergo autocreates this account on the first valid introspection response.
const TEST_USERNAME = process.env.TEST_USERNAME || "oauthuser";

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/introspect") {
        res.writeHead(404).end();
        return;
    }

    const body = await readBody(req);
    // RFC 7662: token=... in application/x-www-form-urlencoded
    const params = new URLSearchParams(body);
    const token = params.get("token");
    const active = token === TEST_TOKEN;

    const payload = active
        ? { active: true, username: TEST_USERNAME, scope: "irc" }
        : { active: false };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
    console.log(
        `[mock-oauth] token=${token?.slice(0, 8) || "(none)"}… active=${active}`,
    );
});

server.listen(PORT, () => {
    console.log(`[mock-oauth] listening on :${PORT}`);
});
