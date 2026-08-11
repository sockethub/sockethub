import { describe, expect, it } from "bun:test";

describe("metadata sequential network fetches", () => {
    it("recovers from failure and reuses one pooled dispatcher", async () => {
        // Run outside this test process because index.test.ts intentionally
        // installs a process-wide open-graph-scraper mock.
        const child = Bun.spawn(
            [
                process.execPath,
                "run",
                new URL(
                    "./test-fixtures/sequential-fetch.ts",
                    import.meta.url,
                ).pathname,
            ],
            { stdout: "pipe", stderr: "pipe" },
        );
        const [exitCode, stdout, stderr] = await Promise.all([
            child.exited,
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
        ]);
        expect(exitCode, stderr).toEqual(0);
        expect(stdout).toContain(
            "failure recovery and sequential fetches completed",
        );
    });
});
