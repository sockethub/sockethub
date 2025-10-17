#!/usr/bin/env bun
import { spawn } from "node:child_process";
import config from "../config.js";

const testFile = process.argv[2];

if (!testFile) {
    console.error("Usage: bun integration/browser/test-runner.js <test-file>");
    process.exit(1);
}

// Flattens nested config object into dot-notation query parameters
// e.g. {prosody: {host: "localhost"}} becomes "prosody.host=localhost"
function configToQueryParams(configObj) {
    const params = new URLSearchParams();
    
    function flattenConfig(obj, prefix = "") {
        for (const [key, value] of Object.entries(obj)) {
            const paramKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                flattenConfig(value, paramKey);
            } else {
                params.set(paramKey, String(value));
            }
        }
    }
    
    flattenConfig(configObj);
    return params.toString();
}

const queryParams = configToQueryParams(config);

// Run web-test-runner with query parameters
const cmd = "bunx";
const args = [
    "--bun", 
    "web-test-runner", 
    testFile, 
    "--node-resolve", 
    "--dev-server-query-params", 
    queryParams
];

const child = spawn(cmd, args, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code));