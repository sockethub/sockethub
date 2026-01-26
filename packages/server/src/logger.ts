import path from "node:path";
import winston from "winston";
import config from "./config.js";

export type Logger = winston.Logger;
const initializedOptions: LoggerOptions = {};

interface LoggerOptions {
    level?: string;
    fileLevel?: string;
    file?: string;
}

const log = initWinstonLogger("sockethub:server:logger", mapOptions());

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

    log.debug("logger module initialized");

    const loggingConfig = config.get("logging");
    const logFile = loggingConfig.file;

    if (logFile) {
        const absolutePath = path.resolve(logFile);
        log.info(`log file path: ${absolutePath}`);
        log.info(`file log level: ${loggingConfig.fileLevel}`);
    }
    log.info(`console log level: ${loggingConfig.level}`);

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
    return initWinstonLogger(namespace, cfg);
}

function initWinstonLogger(
    namespace: string | undefined,
    cfg: LoggerOptions,
): Logger {
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
            level: cfg.level,
            format: consoleFormat,
        }),
    ];

    if (cfg.file) {
        transports.push(
            new winston.transports.File({
                level: cfg.fileLevel,
                filename: cfg.file,
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
