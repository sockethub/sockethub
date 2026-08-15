import {
    type RuntimeConfig,
    validateRuntimeConfig,
} from "@sockethub/schemas/runtime-config";

export type { RuntimeConfig };

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
                if (!validateRuntimeConfig(config)) {
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

export function platformId(packageName: string): string {
    const name = packageName.split("/").pop() ?? packageName;
    return name.replace(/^platform-/, "");
}
