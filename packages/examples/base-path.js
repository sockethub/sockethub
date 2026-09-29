/**
 * URL prefix the Sockethub server mounts the examples app under. Shared by the
 * SvelteKit config (`kit.paths.base`) and runtime code that builds URLs
 * outside the SvelteKit router, so the two cannot drift apart.
 */
export const EXAMPLES_BASE_PATH = "/examples";

/**
 * Branding assets the Sockethub server serves from its root, shared with the
 * server info page. The app links to them as root paths, so the prerenderer
 * must not treat them as broken links, and the standalone dev server proxies
 * them to a running Sockethub.
 */
export const SERVER_ASSET_PATHS = [
    "/favicon.svg",
    "/favicon.ico",
    "/sockethub-logo.svg",
];
