/**
 * Substitute the `/v/` placeholder segment in a canonical schema `$id` with a
 * concrete package version, e.g.
 * `https://sockethub.org/schemas/v/sockethub-config.json` →
 * `https://sockethub.org/schemas/3.0.0/sockethub-config.json`.
 *
 * Shared by the build's JSON-schema export (which stamps the version into the
 * published artifacts) and by `SockethubConfigSchemaId`, so the two never
 * drift.
 */
export function versionedSchemaId(id: string, version: string): string {
    return id.replace("/v/", `/${version}/`);
}
