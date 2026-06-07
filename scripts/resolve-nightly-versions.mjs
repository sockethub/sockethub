#!/usr/bin/env bun
/**
 * Resolve npm/git versions for nightly package verification.
 *
 * Outputs a JSON array with:
 * - latest (npm dist-tag)
 * - alpha (npm dist-tag for the current pre-release line)
 * - master (local build and pack from the master branch)
 * - latest stable git tag (semver without prerelease)
 * - latest tagged git release (most recent v* tag)
 */
import { execSync } from "node:child_process";

/** @returns {string | null} Latest stable semver tag without prerelease suffix. */
function latestStableTag() {
    const tags = execSync("git tag -l 'v*'", { encoding: "utf8" })
        .trim()
        .split("\n")
        .filter(Boolean);
    const stable = tags
        .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const latest = stable.at(-1);
    return latest ? latest.replace(/^v/, "") : null;
}

/** @returns {string | null} Most recent git tag matching `v*`. */
function latestTaggedRelease() {
    const tag = execSync("git tag -l 'v*' --sort=-v:refname", {
        encoding: "utf8",
    })
        .trim()
        .split("\n")[0];
    return tag ? tag.replace(/^v/, "") : null;
}

const versions = ["latest", "alpha", "master"];
const stable = latestStableTag();
const tagged = latestTaggedRelease();

if (stable) {
    versions.push(stable);
}
if (tagged && !versions.includes(tagged)) {
    versions.push(tagged);
}

if (!stable && !tagged) {
    console.error(
        "Warning: no git release tags found; nightly matrix will only test latest, alpha, and master",
    );
}

console.log(JSON.stringify(versions));
