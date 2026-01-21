#!/usr/bin/env bun
/**
 * Build script to transpile TypeScript to JavaScript for npm distribution
 * This ensures Node.js users can run the package while Bun users get TypeScript
 */

import { build } from "bun";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";

const packageDir = process.cwd();
const srcDir = join(packageDir, "src");
const distDir = join(packageDir, "dist");

console.log(`Building package in ${packageDir}`);

// Clean dist directory
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

// Build with Bun - transpile TypeScript to JavaScript
const result = await build({
  entrypoints: [join(srcDir, "index.ts")],
  outdir: distDir,
  target: "node",
  format: "esm",
  sourcemap: "external",
  splitting: false,
  minify: false,
});

if (!result.success) {
  console.error("Build failed");
  process.exit(1);
}

console.log(`✓ Built to ${distDir}`);
