#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const packagesDir = join(repoRoot, "packages");

async function readJson(filePath) {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents);
}

async function getPackageDirs() {
    const entries = await readdir(packagesDir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(packagesDir, entry.name));
}

function runIntegration(cwd, name) {
    console.log(`\n==> ${name}: test:integration`);
    const result = spawnSync("bun", ["run", "test:integration"], {
        cwd,
        stdio: "inherit",
    });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

const packageDirs = await getPackageDirs();
let ranAny = false;

for (const pkgDir of packageDirs) {
    const packageJsonPath = join(pkgDir, "package.json");
    try {
        const pkg = await readJson(packageJsonPath);
        if (pkg?.scripts?.["test:integration"]) {
            ranAny = true;
            runIntegration(pkgDir, pkg.name ?? pkgDir);
        }
    } catch (err) {
        // Skip directories without package.json or invalid JSON
    }
}

if (!ranAny) {
    console.log("No packages define test:integration");
}
