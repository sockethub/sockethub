import path from "node:path";
import config from "./config.js";
import {
    type Logger,
    type LoggerOptions,
    createWinstonLogger,
} from "./logger-core.js";

export type { Logger, LoggerOptions };

let hasLoggedInit = false;

function logInitialization(): void {
    if (hasLoggedInit) return;
    hasLoggedInit = true;

    // Use a simple logger for initialization messages
    const initLogger = createWinstonLogger("sockethub:server:logger", {
        level: "info",
    });

    initLogger.debug("logger module initialized");

    const loggingConfig = config.get("logging");
    const logFile = loggingConfig.file;

    if (logFile) {
        const absolutePath = path.resolve(logFile);
        initLogger.info(`log file path: ${absolutePath}`);
        initLogger.info(`file log level: ${loggingConfig.fileLevel}`);
    }
    initLogger.info(`console log level: ${loggingConfig.level}`);
}

/**
 * Creates a Winston logger instance with console and optional file transports.
 *
 * Log levels: error, warn, info, debug
 *
 * Configuration priority (highest to lowest):
 * 1. options parameter (level, fileLevel, file)
 * 2. Environment variables (LOG_LEVEL, LOG_FILE_LEVEL, LOG_FILE)
 * 3. Config file (logging.level, logging.fileLevel, logging.file)
 * 4. Defaults (info for console, debug for file)
 *
 * NODE_ENV=production disables console timestamps (for systemd)
 */
export function createLogger(
    namespace?: string,
    options: LoggerOptions = {},
): Logger {
    // Log initialization on first call
    if (!hasLoggedInit) {
        logInitialization();
    }

    const loggingConfig = config.get("logging");

    // Explicit undefined check to allow passing empty string to disable file logging
    const cfg: LoggerOptions = {
        level:
            options.level !== undefined
                ? options.level
                : (loggingConfig.level ?? "info"),
        fileLevel:
            options.fileLevel !== undefined
                ? options.fileLevel
                : (loggingConfig.fileLevel ?? "debug"),
        file:
            options.file !== undefined
                ? options.file
                : (loggingConfig.file ?? ""),
    };

    return createWinstonLogger(namespace, cfg);
}
