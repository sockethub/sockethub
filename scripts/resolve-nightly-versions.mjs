#!/usr/bin/env bun
/**
 * Resolve npm/git versions for nightly package verification.
 *
 * Outputs a JSON array with:
 * - latest (npm dist-tag)
 * - latest stable git tag (semver without prerelease)
 * - latest tagged git release (most recent v* tag)
 */
import { execSync } from "node:child_process";

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

function latestTaggedRelease() {
    const tag = execSync("git tag -l 'v*' --sort=-v:refname", {
        encoding: "utf8",
    })
        .trim()
        .split("\n")[0];
    return tag ? tag.replace(/^v/, "") : null;
}

const versions = ["latest"];
const stable = latestStableTag();
const tagged = latestTaggedRelease();

if (stable) {
    versions.push(stable);
}
if (tagged && !versions.includes(tagged)) {
    versions.push(tagged);
}

console.log(JSON.stringify(versions));
