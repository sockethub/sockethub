import { execSync } from "node:child_process";

/** @returns {string[]} All `v*` tags sorted by semver ascending. */
function allVersionTags() {
    return execSync("git tag -l 'v*'", { encoding: "utf8" })
        .trim()
        .split("\n")
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
    const tag = execSync("git tag -l 'v*' --sort=-v:refname", {
        encoding: "utf8",
    })
        .trim()
        .split("\n")[0];
    return tag ? tag.replace(/^v/, "") : null;
}
