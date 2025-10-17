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

// Create temporary WTR config file with injected global config
const configPath = join(process.cwd(), "web-test-runner.config.temp.mjs");
const configContent = `export default {
    nodeResolve: true,
    testRunnerHtml: (testFramework) => \`
        <!DOCTYPE html>
        <html>
            <body>
                <script>
                    window.TEST_CONFIG = ${JSON.stringify(config)};
                </script>
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
    } catch (e) {
        // Ignore cleanup errors
    }
    process.exit(code);
});
