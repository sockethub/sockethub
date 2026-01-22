/**
 * Local package building and packing for test-installed-version script
 */

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build and pack packages locally for testing
 * @param {Logger} logger - Logger instance
 * @returns {Promise<string>} Path to the main sockethub tarball
 */
export async function buildAndPackLocally(logger) {
  await logger.info("Building all packages...");

  // Build all packages
  try {
    execSync("bun run build", {
      cwd: process.cwd(),
      stdio: logger.verbose ? "inherit" : "pipe",
    });
    await logger.success("Built all packages");
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }

  // Get the sockethub version
  const sockethubPkgPath = join(
    process.cwd(),
    "packages/sockethub/package.json",
  );
  const sockethubPkg = JSON.parse(await readFile(sockethubPkgPath, "utf-8"));
  const version = sockethubPkg.version;

  await logger.info(`Packing sockethub@${version}...`);

  // Pack the main sockethub package
  try {
    const output = execSync("npm pack", {
      cwd: join(process.cwd(), "packages/sockethub"),
      encoding: "utf-8",
    });

    const tarballName = output.trim().split("\n").pop();
    const tarballPath = join(
      process.cwd(),
      "packages/sockethub",
      tarballName,
    );

    await logger.success(`Packed: ${tarballName}`);
    return tarballPath;
  } catch (error) {
    throw new Error(`Packing failed: ${error.message}`);
  }
}
