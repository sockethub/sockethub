import path from "node:path";
import config from "./config.js";
import {
    type Logger,
    type LoggerOptions,
    createWinstonLogger,
} from "./logger-core.js";

export type { Logger, LoggerOptions };

const initializedOptions: LoggerOptions = {};
let initLogger: Logger | null = null;

function mapOptions(options: LoggerOptions = {}): LoggerOptions {
    return {
        level: options.level || initializedOptions?.level || "info",
        fileLevel:
            options.fileLevel || initializedOptions?.fileLevel || "debug",
        file: options.file || initializedOptions?.file || "",
    };
}

function init(options: LoggerOptions): LoggerOptions {
    if (Object.keys(options).length > 0) {
        return mapOptions(options);
    }
    if (Object.keys(initializedOptions).length > 0) {
        return initializedOptions;
    }

    // Lazy creation of init logger to avoid circular dependency
    if (!initLogger) {
        initLogger = createWinstonLogger("sockethub:server:logger", {
            level: "info",
        });
    }

    initLogger.debug("logger module initialized");

    const loggingConfig = config.get("logging");
    const logFile = loggingConfig.file;

    if (logFile) {
        const absolutePath = path.resolve(logFile);
        initLogger.info(`log file path: ${absolutePath}`);
        initLogger.info(`file log level: ${loggingConfig.fileLevel}`);
    }
    initLogger.info(`console log level: ${loggingConfig.level}`);

    initializedOptions.level = loggingConfig.level;
    initializedOptions.fileLevel = loggingConfig.fileLevel;
    initializedOptions.file = loggingConfig.file;
    return initializedOptions;
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
    const cfg: LoggerOptions = init(options);
    return createWinstonLogger(namespace, cfg);
}
