import winston from "winston";

export type Logger = winston.Logger;

interface LoggerOptions {
    namespace?: string;
    level?: string;
    fileLevel?: string;
    logFile?: string;
}

/**
 * Creates a Winston logger instance with console and optional file transports.
 *
 * Log levels: error, warn, info, debug
 *
 * Configuration priority (highest to lowest):
 * 1. options parameter (level, fileLevel, logFile)
 * 2. Environment variables (LOG_LEVEL, LOG_FILE_LEVEL)
 * 3. Config file (logging.level, logging.fileLevel, logging.file)
 * 4. Defaults (info for console, debug for file)
 *
 * NODE_ENV=production disables console timestamps (for systemd)
 */
export function createLogger(options: LoggerOptions = {}): Logger {
    const namespace = options.namespace || "sockethub";

    // Load config values
    let configLogLevel = "info";
    let configFileLevel = "debug";
    let configLogFile = "";
    try {
        const config = require("./config.js").default;
        const loggingConfig = config.get("logging");
        if (loggingConfig) {
            configLogLevel = loggingConfig.level || "info";
            configFileLevel = loggingConfig.fileLevel || "debug";
            configLogFile = loggingConfig.file || "";
        }
    } catch (err) {
        // Config not available yet (e.g., during bootstrap)
    }

    // Priority: options > env > config > defaults
    const level = options.level || process.env.LOG_LEVEL || configLogLevel;
    const fileLevel =
        options.fileLevel || process.env.LOG_FILE_LEVEL || configFileLevel;
    const logFile = options.logFile || configLogFile;

    const isProduction = process.env.NODE_ENV === "production";

    const consoleFormat = isProduction
        ? winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(
                  ({ level, message, namespace, ...meta }) => {
                      const ns = namespace ? `${namespace} ` : "";
                      const metaStr =
                          Object.keys(meta).length > 0
                              ? ` ${JSON.stringify(meta)}`
                              : "";
                      return `${level}: ${ns}${message}${metaStr}`;
                  },
              ),
          )
        : winston.format.combine(
              winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
              winston.format.colorize(),
              winston.format.printf(
                  ({ level, message, timestamp, namespace, ...meta }) => {
                      const ns = namespace ? `${namespace} ` : "";
                      const metaStr =
                          Object.keys(meta).length > 0
                              ? ` ${JSON.stringify(meta)}`
                              : "";
                      return `${timestamp} ${level}: ${ns}${message}${metaStr}`;
                  },
              ),
          );

    const transports: winston.transport[] = [
        new winston.transports.Console({
            level: level,
            format: consoleFormat,
        }),
    ];

    if (logFile) {
        transports.push(
            new winston.transports.File({
                level: fileLevel,
                filename: logFile,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json(),
                ),
            }),
        );
    }

    return winston.createLogger({
        level: "debug", // Set to lowest level, let transports filter
        defaultMeta: { namespace },
        transports,
    });
}

// Default logger instance - created lazily to avoid circular deps with config
let defaultLogger: Logger;
export function getDefaultLogger(): Logger {
    if (!defaultLogger) {
        const config = require("./config.js").default;
        const loggingConfig = config.get("logging");
        const logFile = loggingConfig?.file || "";
        defaultLogger = createLogger({ logFile });
    }
    return defaultLogger;
}
