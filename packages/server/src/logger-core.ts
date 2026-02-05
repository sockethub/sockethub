import winston from "winston";

export type Logger = winston.Logger;

export interface LoggerOptions {
    level?: string;
    fileLevel?: string;
    file?: string;
}

/**
 * Creates a Winston logger instance with console and optional file transports.
 * This is the core logger creation function with no external Sockethub dependencies.
 *
 * Log levels: error, warn, info, debug
 *
 * NODE_ENV=production disables console timestamps (for systemd)
 */
export function createWinstonLogger(
    namespace?: string,
    options: LoggerOptions = {},
): Logger {
    const cfg: LoggerOptions = {
        level: options.level || "info",
        fileLevel: options.fileLevel || "debug",
        file: options.file || "",
    };

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
