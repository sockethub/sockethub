import path from "node:path";
import {
    type Logger,
    type LoggerOptions,
    createLogger as createLoggerCore,
    initLogger,
} from "@sockethub/logger";

import config from "./config.js";

export type { Logger, LoggerOptions };

let hasInitialized = false;

/**
 * Initializes the global logger system with configuration.
 * Called automatically on first createLogger() call.
 */
function initializeLogger(): void {
    if (hasInitialized) return;
    hasInitialized = true;

    const loggingConfig = config.get("logging");

    // Resolve file path to absolute if provided
    const logFile = loggingConfig.file
        ? path.resolve(loggingConfig.file as string)
        : "";

    // Initialize global logger config
    initLogger({
        level: loggingConfig.level ?? "info",
        fileLevel: loggingConfig.fileLevel ?? "debug",
        file: logFile,
    });
}

/**
 * Creates a Winston logger instance with console and optional file transports.
 *
 * On first call, initializes the global logger system with config settings.
 * Subsequent calls will use the global config unless overridden.
 *
 * Log levels: error, warn, info, debug
 *
 * Configuration priority (highest to lowest):
 * 1. options parameter (level, fileLevel, file)
 * 2. Global config (from config file, set on first call)
 * 3. Environment variables (LOG_LEVEL, LOG_FILE_LEVEL, LOG_FILE)
 * 4. Defaults (info for console, debug for file)
 *
 * NODE_ENV=production disables console timestamps (for systemd)
 *
 * @param namespace - Logger namespace (defaults to empty string if not provided)
 * @param options - Optional overrides for this specific logger
 */
export function createLogger(
    namespace?: string,
    options: LoggerOptions = {},
): Logger {
    // Initialize global config on first call
    if (!hasInitialized) {
        initializeLogger();
    }

    return createLoggerCore(namespace || "", options);
}
