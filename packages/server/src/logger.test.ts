import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { createLogger } from "./logger";

describe("logger", () => {
    describe("createLogger", () => {
        test("creates logger with default namespace", () => {
            const logger = createLogger();
            expect(logger).toBeDefined();
            expect(logger.info).toBeDefined();
            expect(logger.debug).toBeDefined();
            expect(logger.warn).toBeDefined();
            expect(logger.error).toBeDefined();
        });

        test("creates logger with custom namespace", () => {
            const logger = createLogger("test:namespace");
            expect(logger).toBeDefined();
            // @ts-ignore - accessing internal winston property
            expect(logger.defaultMeta.namespace).toBe("test:namespace");
        });

        test("creates logger with string namespace (simplified API)", () => {
            const logger = createLogger("sockethub:test");
            expect(logger).toBeDefined();
            // @ts-ignore - accessing internal winston property
            expect(logger.defaultMeta.namespace).toBe("sockethub:test");
        });

        test("allows custom log level via options", () => {
            const logger = createLogger("test", { level: "error" });
            // @ts-ignore - accessing internal winston property
            const consoleTransport = logger.transports.find(
                (t) => t.constructor.name === "Console",
            );
            // @ts-ignore
            expect(consoleTransport.level).toBe("error");
        });

        test("creates logger with file transport when file specified", () => {
            const logger = createLogger("test", { file: "test.log" });
            // @ts-ignore - accessing internal winston property
            const fileTransport = logger.transports.find(
                (t) => t.constructor.name === "File",
            );
            expect(fileTransport).toBeDefined();
        });

        test("uses different log levels for console and file", () => {
            const logger = createLogger("test", {
                level: "warn",
                fileLevel: "debug",
                file: "test.log",
            });

            // @ts-ignore - accessing internal winston property
            const consoleTransport = logger.transports.find(
                (t) => t.constructor.name === "Console",
            );
            // @ts-ignore - accessing internal winston property
            const fileTransport = logger.transports.find(
                (t) => t.constructor.name === "File",
            );

            // @ts-ignore
            expect(consoleTransport.level).toBe("warn");
            // @ts-ignore
            expect(fileTransport.level).toBe("debug");
        });

        test("options parameter overrides defaults", () => {
            const logger = createLogger("test", { level: "error" });
            // @ts-ignore
            const consoleTransport = logger.transports.find(
                (t) => t.constructor.name === "Console",
            );
            // @ts-ignore
            expect(consoleTransport.level).toBe("error");
        });
    });

    describe("multiple logger instances", () => {
        test("creates independent logger instances", () => {
            const logger1 = createLogger("test1", { level: "debug" });
            const logger2 = createLogger("test2", { level: "error" });

            // @ts-ignore
            expect(logger1.defaultMeta.namespace).toBe("test1");
            // @ts-ignore
            expect(logger2.defaultMeta.namespace).toBe("test2");

            // @ts-ignore
            const transport1 = logger1.transports[0];
            // @ts-ignore
            const transport2 = logger2.transports[0];

            // @ts-ignore
            expect(transport1.level).toBe("debug");
            // @ts-ignore
            expect(transport2.level).toBe("error");
        });

        test("subsequent loggers can override with explicit options", () => {
            const logger1 = createLogger("test1", { level: "info" });
            const logger2 = createLogger("test2", { level: "error" });

            // @ts-ignore
            const transport1 = logger1.transports.find(
                (t) => t.constructor.name === "Console",
            );
            // @ts-ignore
            const transport2 = logger2.transports.find(
                (t) => t.constructor.name === "Console",
            );

            // @ts-ignore
            expect(transport1.level).toBe("info");
            // @ts-ignore
            expect(transport2.level).toBe("error");
        });
    });

    describe("file logging", () => {
        const testLogFile = path.resolve(
            process.cwd(),
            "test-logger-output.log",
        );

        afterEach(() => {
            // Cleanup test log files
            if (fs.existsSync(testLogFile)) {
                fs.unlinkSync(testLogFile);
            }
        });

        test("creates log file when file option provided", async () => {
            const logger = createLogger("test", {
                file: testLogFile,
                fileLevel: "debug",
            });

            logger.info("test message");

            // Give winston a moment to write
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(fs.existsSync(testLogFile)).toBe(true);
        });

        test("file transport uses JSON format", () => {
            const logger = createLogger("test", { file: testLogFile });

            // @ts-ignore
            const fileTransport = logger.transports.find(
                (t) => t.constructor.name === "File",
            );
            expect(fileTransport).toBeDefined();

            // File transport should use JSON format
            // @ts-ignore
            expect(fileTransport.format).toBeDefined();
        });

        test("respects fileLevel for file output", () => {
            const logger = createLogger("test", {
                file: testLogFile,
                fileLevel: "warn",
            });

            // @ts-ignore
            const fileTransport = logger.transports.find(
                (t) => t.constructor.name === "File",
            );

            // @ts-ignore
            expect(fileTransport.level).toBe("warn");
        });
    });

    describe("edge cases", () => {
        test("handles empty namespace", () => {
            const logger = createLogger("");
            expect(logger).toBeDefined();
            // @ts-ignore
            expect(logger.defaultMeta.namespace).toBe("");
        });

        test("handles undefined namespace", () => {
            const logger = createLogger(undefined);
            expect(logger).toBeDefined();
        });

        test("handles empty options object", () => {
            const logger = createLogger("test", {});
            expect(logger).toBeDefined();
        });

        test("handles partial options", () => {
            const logger1 = createLogger("test1", { level: "warn" });
            const logger2 = createLogger("test2", { file: "test.log" });

            expect(logger1).toBeDefined();
            expect(logger2).toBeDefined();
        });
    });
});
