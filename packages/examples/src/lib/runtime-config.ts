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
    runtimeConfigPromise ??= fetch("/config.json")
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(
                    `failed to load runtime config: ${response.status}`,
                );
            }
            return (await response.json()) as RuntimeConfig;
        })
        .catch(() => defaultConfig);

    return runtimeConfigPromise;
}

export function platformId(packageName: string): string {
    const name = packageName.split("/").pop() ?? packageName;
    return name.replace(/^platform-/, "");
}
