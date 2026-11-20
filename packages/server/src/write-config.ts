import { generateKeyPairSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
    SockethubConfigSchema,
    SockethubConfigSchemaId,
} from "@sockethub/schemas";

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
    flag = "--write-config",
): string | undefined {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === flag) {
            const value = argv[i + 1];
            if (!value || (value.startsWith("-") && value !== "-")) {
                return defaultTarget;
            }
            return value;
        }
        if (arg.startsWith(`${flag}=`)) {
            return arg.slice(flag.length + 1) || defaultTarget;
        }
    }
    return undefined;
}

export const WRITE_WEBPUSH_CONFIG_FLAG = "--write-config-webpush-enabled";
const WEBPUSH_SUBJECT_FLAG = "--webpush-subject";

/** The value of `--webpush-subject`, given as the next argument or after `=`. */
export function parseWebPushSubject(argv: Array<string>): string | undefined {
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === WEBPUSH_SUBJECT_FLAG) {
            return argv[i + 1];
        }
        if (arg.startsWith(`${WEBPUSH_SUBJECT_FLAG}=`)) {
            return arg.slice(WEBPUSH_SUBJECT_FLAG.length + 1);
        }
    }
    return undefined;
}

/** The test and demo platform, which does not belong in a deployment. */
const DUMMY_PLATFORM = "@sockethub/platform-dummy";

/**
 * The full default configuration as a JSON document, with a `$schema`
 * reference to the published schema for this version. The `dummy` platform
 * is left out of `platforms`: a written config is the starting point for a
 * real deployment, where it should not be enabled.
 */
export function renderDefaultConfig(): string {
    return render(defaultConfig());
}

const render = (config: unknown) => `${JSON.stringify(config, null, 4)}\n`;

function defaultConfig(): Record<string, unknown> {
    const defaults = getDefaultConfig() as Record<string, unknown>;
    const config: Record<string, unknown> = {
        $schema: SockethubConfigSchemaId,
        ...defaults,
    };
    if (Array.isArray(defaults.platforms)) {
        config.platforms = defaults.platforms.filter(
            (name) => name !== DUMMY_PLATFORM,
        );
    }
    return config;
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

const WEBPUSH_PACKAGE = "@sockethub/platform-webpush";
const SECRET_ADDED = "a scheduled delivery secret";
const WEBPUSH_SCHEMA =
    SockethubConfigSchema.properties.packageConfig.properties[WEBPUSH_PACKAGE]
        .properties;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** The object at `parent[key]`, created when absent. */
function objectAt(
    parent: Record<string, unknown>,
    key: string,
): Record<string, unknown> {
    const value = parent[key] ?? {};
    if (!isPlainObject(value)) {
        throw new Error(`\`${key}\` must be an object`);
    }
    parent[key] = value;
    return value;
}

/** A new P-256 key pair, encoded the way Web Push passes keys around. */
function generateVapidKeys(): { publicKey: string; privateKey: string } {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const { x, y, d } = privateKey.export({ format: "jwk" });
    const bytes = (value?: string) => Buffer.from(value ?? "", "base64url");
    return {
        publicKey: Buffer.concat([
            Buffer.from([4]),
            bytes(x),
            bytes(y),
        ]).toString("base64url"),
        privateKey: d ?? "",
    };
}

/**
 * Set up Web Push in `config`: load the platform, give it a key pair, and turn
 * on scheduled delivery. Only what is missing is added. A key pair or secret
 * already there is never replaced, because every subscription and stored
 * schedule depends on it. Returns what was added.
 */
export function enableWebPush(
    config: Record<string, unknown>,
    subject?: string,
): Array<string> {
    const added: Array<string> = [];
    // A file without `platforms` runs the defaults; keep them when adding one.
    const platforms = config.platforms ?? getDefaultConfig().platforms;
    if (!Array.isArray(platforms)) {
        throw new Error("`platforms` must be an array");
    }
    if (!platforms.includes(WEBPUSH_PACKAGE)) {
        config.platforms = [...platforms, WEBPUSH_PACKAGE];
        added.push("the platform");
    }
    const webpush = objectAt(
        objectAt(config, "packageConfig"),
        WEBPUSH_PACKAGE,
    );
    if (webpush.vapid === undefined) {
        if (
            !new RegExp(WEBPUSH_SCHEMA.vapid.properties.subject.pattern).test(
                subject ?? "",
            )
        ) {
            throw new Error(
                `${WEBPUSH_SUBJECT_FLAG} is required: your contact URI, as ` +
                    "mailto: or https:, where push services can reach you, for example " +
                    `${WEBPUSH_SUBJECT_FLAG} mailto:ops@example.org`,
            );
        }
        webpush.vapid = { ...generateVapidKeys(), subject };
        added.push("a key pair");
    }
    const scheduled = objectAt(webpush, "scheduledDelivery");
    // An empty secret is the operator's way of turning it off; leave it.
    if (scheduled.secret === undefined) {
        const defaults = Object.fromEntries(
            Object.entries(WEBPUSH_SCHEMA.scheduledDelivery.properties).map(
                ([key, setting]) => [key, setting.default],
            ),
        );
        webpush.scheduledDelivery = {
            ...defaults,
            ...scheduled,
            secret: randomBytes(32).toString("base64url"),
        };
        added.push(SECRET_ADDED);
    }
    return added;
}

/**
 * Write a config with Web Push set up to `target` (`"-"` prints a new one to
 * stdout). An existing file is updated in place; a new one starts from the
 * defaults. Returns the message to show the user.
 */
export function writeWebPushConfig(target: string, subject?: string): string {
    if (target === "-") {
        const config = defaultConfig();
        enableWebPush(config, subject);
        process.stdout.write(render(config));
        return "";
    }
    const resolved = path.resolve(target);
    const exists = fs.existsSync(resolved);
    let config = defaultConfig();
    if (exists) {
        try {
            config = JSON.parse(fs.readFileSync(resolved, "utf8"));
        } catch (err) {
            throw new Error(
                `cannot read ${resolved}: ${(err as Error).message}`,
            );
        }
        if (!isPlainObject(config)) {
            throw new Error(`${resolved} does not hold a JSON object`);
        }
    }
    const added = enableWebPush(config, subject);
    if (added.length === 0) {
        return `Web Push is already set up in ${resolved}; nothing changed`;
    }
    const notes = [
        `${exists ? "updated" : "wrote"} ${resolved}, adding ${added.join(", ")}`,
    ];
    if (exists) {
        const mode = replaceFile(resolved, render(config));
        if (mode & 0o004 && process.platform !== "win32") {
            notes.push(
                `${resolved} holds a private key and any user on this machine ` +
                    `can read it. Consider: chmod 600 ${resolved}`,
            );
        }
    } else {
        // It holds a private key, so only its owner may read it.
        fs.writeFileSync(resolved, render(config), {
            flag: "wx",
            mode: 0o600,
        });
    }
    if (added.includes(SECRET_ADDED)) {
        notes.push(
            "Back up the key pair and the secret, and turn on Redis " +
                "persistence (AOF): scheduled messages are lost without it.",
        );
    }
    return notes.join("\n");
}

/**
 * Replace `file` in one step, so a write that fails partway cannot leave the
 * config, and the keys in it, cut short. The new file keeps the old one's
 * owner and permissions, and a symlink keeps pointing at it. Returns the mode.
 */
function replaceFile(file: string, body: string): number {
    const target = fs.realpathSync(file);
    const { mode, uid, gid } = fs.statSync(target);
    const staged = `${target}.${process.pid}.tmp`;
    // Fails, touching nothing, if something else already has this name.
    fs.closeSync(fs.openSync(staged, "wx", 0o600));
    try {
        fs.writeFileSync(staged, body);
        try {
            fs.chownSync(staged, uid, gid);
        } catch {
            throw new Error(
                `cannot keep the owner of ${target}: run this as the user ` +
                    "that owns the file",
            );
        }
        fs.chmodSync(staged, mode & 0o7777);
        fs.renameSync(staged, target);
    } catch (err) {
        fs.rmSync(staged, { force: true });
        throw err;
    }
    return mode;
}
