#!/usr/bin/env bun
/**
 * Resolve git refs for nightly integration test matrix.
 *
 * Outputs a JSON array of { name, ref } objects for:
 * - master
 * - latest stable git tag (semver without prerelease)
 * - latest tagged git release (most recent v* tag)
 */
import {
    latestStableTag,
    latestTaggedRelease,
} from "./lib/git-release-tags.mjs";

/** @typedef {{ name: string, ref: string }} IntegrationTarget */

/** @param {string} version Version without `v` prefix. */
function tagRef(version) {
    return `v${version}`;
}

/** @type {IntegrationTarget[]} */
const targets = [{ name: "master", ref: "master" }];
const refs = new Set(targets.map((target) => target.ref));

const stable = latestStableTag();
if (stable) {
    const ref = tagRef(stable);
    if (!refs.has(ref)) {
        targets.push({ name: "latest-stable", ref });
        refs.add(ref);
    }
}

const tagged = latestTaggedRelease();
if (tagged) {
    const ref = tagRef(tagged);
    if (!refs.has(ref)) {
        targets.push({ name: "latest-tag", ref });
        refs.add(ref);
    }
}

if (!stable && !tagged) {
    console.error(
        "Warning: no git release tags found; nightly matrix will only test master",
    );
}

console.log(JSON.stringify(targets));
