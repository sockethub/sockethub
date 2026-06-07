import type { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
    webServer: {
        command: "bun run scripts/smoke-server.mjs",
        url: "http://localhost:10550",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
    use: {
        baseURL: "http://localhost:10550",
    },
    testDir: "tests",
    testMatch: /smoke\.spec\.ts/,
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
};

export default config;
