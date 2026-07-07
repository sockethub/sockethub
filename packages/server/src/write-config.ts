import fs from "node:fs";
import path from "node:path";
import { SockethubConfigSchemaId } from "@sockethub/schemas";

import { getDefaultConfig } from "./config-schema.js";

const defaultTarget = "sockethub.config.json";

/**
 * Parse the `--write-config [path]` flag out of argv. Returns `undefined`
 * when the flag is absent; otherwise the target path, `"-"` for stdout, or
 * `sockethub.config.json` when no path was given. This module deliberately
 * avoids importing the config singleton so writing a fresh config works even
 * when an existing config file in the working directory is broken.
 */
export function parseWriteConfigTarget(
    argv: Array<string>,
): string | undefined {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--write-config") {
            const value = argv[i + 1];
            if (!value || (value.startsWith("-") && value !== "-")) {
                return defaultTarget;
            }
            return value;
        }
        if (arg.startsWith("--write-config=")) {
            return arg.slice("--write-config=".length) || defaultTarget;
        }
    }
    return undefined;
}

/**
 * The full default configuration as a JSON document, with a `$schema`
 * reference to the published schema for this version.
 */
export function renderDefaultConfig(): string {
    const config = {
        $schema: SockethubConfigSchemaId,
        ...getDefaultConfig(),
    };
    return `${JSON.stringify(config, null, 4)}\n`;
}

/**
 * Write the default config to `target` (`"-"` prints to stdout). Refuses to
 * overwrite an existing file. Returns the message to show the user.
 */
export function writeDefaultConfig(target: string): string {
    const body = renderDefaultConfig();
    if (target === "-") {
        process.stdout.write(body);
        return "";
    }
    const resolved = path.resolve(target);
    try {
        // "wx" fails when the file already exists, atomically.
        fs.writeFileSync(resolved, body, { flag: "wx" });
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EEXIST") {
            throw new Error(`refusing to overwrite existing file: ${resolved}`);
        }
        throw err;
    }
    return `wrote default config to ${resolved}`;
}
