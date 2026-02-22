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

// Process-wide logger context (set once at process startup)
let loggerContext = "";
let loggerNamespaceStore = new WeakMap<Logger, string>();

function safeStringify(value: unknown): string {
    try {
        const seen = new WeakSet<object>();
        return JSON.stringify(value, (_key, innerValue) => {
            if (innerValue instanceof Error) {
                return {
                    name: innerValue.name,
                    message: innerValue.message,
                    stack: innerValue.stack,
                };
            }
            if (typeof innerValue === "bigint") {
                return innerValue.toString();
            }
            if (typeof innerValue === "object" && innerValue !== null) {
                if (seen.has(innerValue)) {
                    return "[Circular]";
                }
                seen.add(innerValue);
            }
            return innerValue;
        });
    } catch {
        return '"[Unserializable]"';
    }
}

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
 * Set the logger context for this process.
 *
 * All subsequent createLogger() calls will prepend this context to their namespace.
 * This is typically set once at process startup to identify the process (e.g., "sockethub"
 * for the main server, or "sockethub:platform:irc:abc123" for a platform child process).
 *
 * @param context - The context string to prepend to all logger namespaces in this process
 *
 * @example
 * ```typescript
 * // In main server process
 * setLoggerContext('sockethub');
 * const log = createLogger('server:listener');
 * // Output namespace: "sockethub:server:listener"
 *
 * // In platform child process
 * setLoggerContext('sockethub:platform:irc:abc123');
 * const log = createLogger('main');
 * // Output namespace: "sockethub:platform:irc:abc123:main"
 * ```
 */
export function setLoggerContext(context: string): void {
    loggerContext = context;
}

/**
 * Get the current logger context for this process.
 *
 * @returns The current logger context string, or empty string if not set
 *
 * @example
 * ```typescript
 * const context = getLoggerContext();
 * if (context.includes(':platform:')) {
 *   // We're in a platform child process
 * }
 * ```
 */
export function getLoggerContext(): string {
    return loggerContext;
}

/**
 * Reset the logger context.
 *
 * Primarily used for testing to reset state between test cases.
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   resetLoggerContext();
 * });
 * ```
 */
export function resetLoggerContext(): void {
    loggerContext = "";
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
    // Prepend logger context if set
    const fullNamespace = loggerContext
        ? `${loggerContext}:${namespace}`
        : namespace;

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
                              ? ` ${safeStringify(meta)}`
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
                              ? ` ${safeStringify(meta)}`
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

    const logger = winston.createLogger({
        level: "debug", // Set to lowest level, let transports filter
        defaultMeta: { namespace: fullNamespace },
        transports,
    });
    loggerNamespaceStore.set(logger, fullNamespace);
    return logger;
}

/**
 * Get the namespace from a logger instance.
 *
 * Extracts the full namespace (including context) that was set when the logger was created.
 * Useful for reusing the namespace in other systems like Redis connection names.
 *
 * @param logger - Logger instance created by createLogger()
 * @returns The full namespace string, or empty string if not found
 *
 * @example
 * ```typescript
 * const log = createLogger('data-layer:queue');
 * const namespace = getLoggerNamespace(log);
 * // Returns: "sockethub:data-layer:queue" (if context is "sockethub")
 *
 * // Use for Redis connection name
 * redisConfig.connectionName = namespace;
 * ```
 */
export function getLoggerNamespace(logger: Logger): string {
    return (
        loggerNamespaceStore.get(logger) ??
        (logger.defaultMeta as { namespace?: string })?.namespace ??
        ""
    );
}

/**
 * Reset logger state. Used primarily for testing.
 * @internal
 */
export function resetLoggerForTesting(): void {
    globalConfig = null;
    hasLoggedInit = false;
    loggerContext = "";
    loggerNamespaceStore = new WeakMap<Logger, string>();
}
