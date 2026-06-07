import { execSync } from "node:child_process";

/**
 * @param {"v:refname" | "-v:refname"} sort Git version sort order.
 * @returns {string[]} All `v*` tags sorted by semver.
 */
function listVersionTags(sort) {
    try {
        return execSync(`git tag -l 'v*' --sort=${sort}`, { encoding: "utf8" })
            .trim()
            .split("\n")
            .filter(Boolean);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to retrieve git tags:", message);
        return [];
    }
}

/** @returns {string[]} All `v*` tags sorted by semver ascending. */
function allVersionTags() {
    return listVersionTags("v:refname");
}

/** @returns {string | null} Latest stable semver tag without prerelease suffix (no `v` prefix). */
export function latestStableTag() {
    const stable = allVersionTags().filter((tag) =>
        /^v\d+\.\d+\.\d+$/.test(tag),
    );
    const latest = stable.at(-1);
    return latest ? latest.replace(/^v/, "") : null;
}

/** @returns {string | null} Most recent git tag matching `v*` (no `v` prefix). */
export function latestTaggedRelease() {
    const tag = listVersionTags("-v:refname")[0];
    return tag ? tag.replace(/^v/, "") : null;
}
