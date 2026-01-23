import { exec } from "node:child_process";
/**
 * System profiler - generates unique system profiles for baseline storage
 */
import os from "node:os";
import { promisify } from "node:util";
import type { SystemProfile } from "../types";

const execAsync = promisify(exec);

export async function getSystemProfile(): Promise<SystemProfile> {
    const hostname = os.hostname();
    const cpus = os.cpus().length;
    const memory_gb = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const osType = os.platform();

    let redis_version: string | undefined;
    try {
        const { stdout } = await execAsync("redis-cli --version");
        const match = stdout.match(/redis-cli (\d+\.\d+\.\d+)/);
        redis_version = match ? match[1] : undefined;
    } catch {
        redis_version = undefined;
    }

    return {
        hostname,
        cpus,
        memory_gb,
        os: osType,
        redis_version,
    };
}

export function getSystemId(profile: SystemProfile): string {
    return `${profile.hostname}-${profile.cpus}c-${profile.memory_gb}gb`;
}

export function getBaselineFilename(profile: SystemProfile): string {
    return `${getSystemId(profile)}.json`;
}
