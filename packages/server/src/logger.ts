import winston from "winston";

export type Logger = winston.Logger;

interface LoggerOptions {
    namespace?: string;
    level?: string;
    logFile?: string;
}

/**
 * Creates a Winston logger instance with console and optional file transports.
 *
 * Log levels: error, warn, info, debug
 *
 * Configuration:
 * - LOG_LEVEL env var or level option (default: 'info')
 * - logFile option for file output
 * - NODE_ENV=production disables console timestamps (for systemd)
 */
export function createLogger(options: LoggerOptions = {}): Logger {
    const namespace = options.namespace || "sockethub";
    const level = options.level || process.env.LOG_LEVEL || "info";
    const logFile = options.logFile;
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
            format: consoleFormat,
        }),
    ];

    if (logFile) {
        transports.push(
            new winston.transports.File({
                filename: logFile,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json(),
                ),
            }),
        );
    }

    return winston.createLogger({
        level,
        defaultMeta: { namespace },
        transports,
    });
}

// Default logger instance - created lazily to avoid circular deps with config
let defaultLogger: Logger;
export function getDefaultLogger(): Logger {
    if (!defaultLogger) {
        const config = require("./config.js").default;
        const logFile = config.get("logFile") as string;
        defaultLogger = createLogger({ logFile });
    }
    return defaultLogger;
}
