import winston from "winston";

export type Logger = winston.Logger;

export interface LoggerOptions {
    level?: string;
    fileLevel?: string;
    file?: string;
}

// Global configuration state (set once at bootstrap via initLogger)
let globalConfig: LoggerOptions | null = null;
let hasLoggedInit = false;

/**
 * Initialize the logger system with global configuration.
 *
 * Called once at server bootstrap with config settings. All subsequent
 * createLogger() calls will use these settings as defaults unless explicitly
 * overridden.
 *
 * @param options - Global logger configuration
 *
 * @example
 * ```typescript
 * // In server bootstrap
 * initLogger({
 *   level: config.get("logging:level"),
 *   fileLevel: config.get("logging:fileLevel"),
 *   file: config.get("logging:file"),
 * });
 * ```
 */
export function initLogger(options: LoggerOptions): void {
    globalConfig = options;

    if (!hasLoggedInit) {
        hasLoggedInit = true;
        const initLog = createLogger("sockethub:logger");
        initLog.debug("logger system initialized");
        if (options.file) {
            initLog.info(`log file path: ${options.file}`);
            initLog.info(`file log level: ${options.fileLevel || "debug"}`);
        }
        initLog.info(`console log level: ${options.level || "info"}`);
    }
}

/**
 * Creates a Winston logger instance with console and optional file transports.
 *
 * Configuration priority (highest to lowest):
 * 1. Explicit options parameter
 * 2. Global config (set via initLogger)
 * 3. Environment variables (LOG_LEVEL, LOG_FILE_LEVEL, LOG_FILE)
 * 4. Defaults (info for console, debug for file)
 *
 * Log levels: error, warn, info, debug
 *
 * NODE_ENV=production disables console timestamps (for systemd)
 *
 * @param namespace - Logger namespace (e.g., "sockethub:data-layer:queue:...")
 * @param options - Optional logger configuration overrides
 * @returns Winston logger instance
 *
 * @example
 * ```typescript
 * // Uses global config if initLogger() was called
 * const log = createLogger("sockethub:data-layer:queue:irc-123");
 *
 * // Override for specific use case (e.g., early bootstrap logging)
 * const earlyLog = createLogger("sockethub:bootstrap", { level: "info" });
 * ```
 */
export function createLogger(
    namespace: string,
    options: LoggerOptions = {},
): Logger {
    // Priority: explicit options > global config > ENV > defaults
    const cfg: LoggerOptions = {
        level:
            options.level ??
            globalConfig?.level ??
            process.env.LOG_LEVEL ??
            "info",
        fileLevel:
            options.fileLevel ??
            globalConfig?.fileLevel ??
            process.env.LOG_FILE_LEVEL ??
            "debug",
        file:
            options.file !== undefined
                ? options.file
                : globalConfig?.file !== undefined
                  ? globalConfig.file
                  : (process.env.LOG_FILE ?? ""),
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

/**
 * Reset logger state. Used primarily for testing.
 * @internal
 */
export function resetLoggerForTesting(): void {
    globalConfig = null;
    hasLoggedInit = false;
}
