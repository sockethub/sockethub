export interface RuntimeConfig {
    sockethub: {
        port: number;
        host: string;
        path: string;
    };
    public: {
        protocol: string;
        host: string;
        port: number;
        path: string;
    };
    platforms?: string[];
}

export const defaultConfig: RuntimeConfig = {
    sockethub: {
        port: 10550,
        host: "localhost",
        path: "/sockethub",
    },
    public: {
        protocol: "http",
        host: "localhost",
        port: 10550,
        path: "/",
    },
};

let runtimeConfigPromise: Promise<RuntimeConfig> | undefined;

export function loadRuntimeConfig(): Promise<RuntimeConfig> {
    if (!runtimeConfigPromise) {
        runtimeConfigPromise = fetch("/config.json")
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        `failed to load runtime config: ${response.status}`,
                    );
                }
                const config: unknown = await response.json();
                if (!isRuntimeConfig(config)) {
                    throw new Error("invalid runtime config");
                }
                return config;
            })
            .catch((error: unknown) => {
                runtimeConfigPromise = undefined;
                console.error("failed to load runtime config", error);
                throw error;
            });
    }

    return runtimeConfigPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
    return typeof value === "string";
}

function isPort(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function isRuntimeConfig(value: unknown): value is RuntimeConfig {
    if (!isRecord(value)) {
        return false;
    }

    const sockethub = value.sockethub;
    const publicConfig = value.public;
    if (!isRecord(sockethub) || !isRecord(publicConfig)) {
        return false;
    }

    return (
        isPort(sockethub.port) &&
        isString(sockethub.host) &&
        isString(sockethub.path) &&
        isString(publicConfig.protocol) &&
        isString(publicConfig.host) &&
        isPort(publicConfig.port) &&
        isString(publicConfig.path) &&
        (value.platforms === undefined ||
            (Array.isArray(value.platforms) && value.platforms.every(isString)))
    );
}

export function platformId(packageName: string): string {
    const name = packageName.split("/").pop() ?? packageName;
    return name.replace(/^platform-/, "");
}
