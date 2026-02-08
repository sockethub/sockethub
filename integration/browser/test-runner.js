#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import config from "../config.js";

const testFile = process.argv[2];

if (!testFile) {
    console.error("Usage: bun integration/browser/test-runner.js <test-file>");
    process.exit(1);
}

// Create temporary WTR config file with injected global config and HTTP-loaded scripts
const configPath = join(process.cwd(), "web-test-runner.config.temp.mjs");
const configContent = `export default {
    nodeResolve: true,
    open: ${process.argv.includes("--open")},
    manual: ${process.argv.includes("--manual")},
    testRunnerHtml: (testFramework) => \`
        <!DOCTYPE html>
        <html>
            <head>
                <script>
                    window.TEST_CONFIG = ${JSON.stringify(config)};
                </script>
                <!-- Load sockethub-client and socket.io from running Sockethub server -->
                <!-- These must load synchronously before the test framework -->
                <script src="${config.sockethub.url}/socket.io.js"></script>
                <script src="${config.sockethub.url}/sockethub-client.js"></script>
            </head>
            <body>
                <script type="module" src="\${testFramework}"></script>
            </body>
        </html>
    \`
};`;

writeFileSync(configPath, configContent);

// Run web-test-runner with temporary config
const cmd = "bunx";
const args = ["--bun", "web-test-runner", testFile, "--config", configPath];

const child = spawn(cmd, args, { stdio: "inherit" });
child.on("exit", (code) => {
    // Clean up temp config file
    try {
        unlinkSync(configPath);
    } catch (_e) {
        // Ignore cleanup errors
    }

    process.exit(code);
});
