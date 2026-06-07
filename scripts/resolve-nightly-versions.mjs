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
import {
    latestStableTag,
    latestTaggedRelease,
} from "./lib/git-release-tags.mjs";

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
