/**
 * Cleanup utilities for test-installed-version script
 */

import { rm } from "node:fs/promises";

/**
 * Clean up resources after test run
 * @param {ServiceManager} services - Service manager instance
 * @param {string} installDir - Installation directory path
 * @param {Logger} logger - Logger instance
 */
export async function cleanup(services, installDir, logger) {
  await logger.info("Cleaning up resources...");

  // Stop all Docker services
  try {
    await services.stop();
    await logger.success("Stopped all services");
  } catch (error) {
    await logger.error("Failed to stop services", error);
  }

  // Remove install directory if it's the default test directory
  if (installDir.startsWith("./test-install")) {
    try {
      await rm(installDir, { recursive: true, force: true });
      await logger.success(`Removed installation directory: ${installDir}`);
    } catch (error) {
      await logger.error("Failed to remove installation directory", error);
    }
  } else {
    await logger.info(
      `Keeping custom installation directory: ${installDir}`,
    );
  }
}
