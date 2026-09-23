/**
 * URL prefix the Sockethub server mounts the examples app under. Shared by the
 * SvelteKit config (`kit.paths.base`) and runtime code that builds URLs
 * outside the SvelteKit router, so the two cannot drift apart.
 */
export const EXAMPLES_BASE_PATH = "/examples";
