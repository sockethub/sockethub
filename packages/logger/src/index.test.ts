import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
    type Logger,
    type LoggerOptions,
    createLogger,
    initLogger,
    resetLoggerForTesting,
} from "./index.js";

describe("Logger Package", () => {
    beforeEach(() => {
        resetLoggerForTesting();
        delete process.env.LOG_LEVEL;
        delete process.env.LOG_FILE_LEVEL;
        delete process.env.LOG_FILE;
    });

    afterEach(() => {
        resetLoggerForTesting();
    });

    describe("createLogger", () => {
        it("creates a logger with namespace", () => {
            const log = createLogger("test:namespace");
            expect(log).toBeDefined();
            expect(log.info).toBeFunction();
            expect(log.warn).toBeFunction();
            expect(log.error).toBeFunction();
            expect(log.debug).toBeFunction();
        });

        it("uses default level info when no config provided", () => {
            const log = createLogger("test:namespace");
            expect(log).toBeDefined();
            // Winston loggers have transports array
            expect(log.transports).toBeArray();
            expect(log.transports.length).toBeGreaterThan(0);
        });

        it("respects explicit options over defaults", () => {
            const log = createLogger("test:namespace", { level: "error" });
            expect(log).toBeDefined();
            const consoleTransport = log.transports[0];
            expect(consoleTransport.level).toBe("error");
        });

        it("respects environment variables when no global config", () => {
            process.env.LOG_LEVEL = "warn";
            const log = createLogger("test:namespace");
            const consoleTransport = log.transports[0];
            expect(consoleTransport.level).toBe("warn");
        });

        it("creates file transport when file path provided", () => {
            const log = createLogger("test:namespace", {
                file: "/tmp/test.log",
            });
            expect(log.transports.length).toBe(2); // console + file
        });

        it("does not create file transport when file is empty string", () => {
            const log = createLogger("test:namespace", { file: "" });
            expect(log.transports.length).toBe(1); // console only
        });
    });

    describe("initLogger", () => {
        it("sets global config for subsequent createLogger calls", () => {
            initLogger({
                level: "debug",
                fileLevel: "info",
                file: "/tmp/global.log",
            });

            const log = createLogger("test:namespace");
            expect(log.transports.length).toBe(2); // console + file
            const consoleTransport = log.transports[0];
            expect(consoleTransport.level).toBe("debug");
        });

        it("allows explicit options to override global config", () => {
            initLogger({ level: "info" });

            const log = createLogger("test:namespace", { level: "error" });
            const consoleTransport = log.transports[0];
            expect(consoleTransport.level).toBe("error");
        });

        it("global config takes precedence over ENV vars", () => {
            process.env.LOG_LEVEL = "warn";
            initLogger({ level: "debug" });

            const log = createLogger("test:namespace");
            const consoleTransport = log.transports[0];
            expect(consoleTransport.level).toBe("debug");
        });
    });

    describe("configuration priority", () => {
        it("follows priority: explicit > global > env > default", () => {
            // Set up all sources
            process.env.LOG_LEVEL = "warn";
            initLogger({ level: "info" });

            // Explicit wins
            const log1 = createLogger("test:1", { level: "error" });
            expect(log1.transports[0].level).toBe("error");

            // Global wins over env
            const log2 = createLogger("test:2");
            expect(log2.transports[0].level).toBe("info");
        });

        it("falls back to env when no global config", () => {
            process.env.LOG_LEVEL = "warn";
            const log = createLogger("test:namespace");
            expect(log.transports[0].level).toBe("warn");
        });

        it("falls back to default when no config at all", () => {
            const log = createLogger("test:namespace");
            expect(log.transports[0].level).toBe("info");
        });
    });

    describe("edge cases", () => {
        it("handles createLogger before initLogger", () => {
            // This happens during early bootstrap
            const earlyLog = createLogger("bootstrap", { level: "info" });
            expect(earlyLog).toBeDefined();

            // Later, initLogger is called
            initLogger({ level: "debug" });

            // New loggers get global config
            const laterLog = createLogger("later");
            expect(laterLog.transports[0].level).toBe("debug");

            // But early logger keeps its config
            expect(earlyLog.transports[0].level).toBe("info");
        });

        it("handles file: undefined vs file: empty string", () => {
            initLogger({ file: "/tmp/test.log" });

            // Explicit empty string disables file
            const log1 = createLogger("test:1", { file: "" });
            expect(log1.transports.length).toBe(1);

            // No explicit option uses global
            const log2 = createLogger("test:2");
            expect(log2.transports.length).toBe(2);
        });
    });
});
