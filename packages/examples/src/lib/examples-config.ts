import {
    type ExamplesConfig,
    validateExamplesConfig,
} from "@sockethub/schemas/examples-config";

export type { ExamplesConfig };

export const defaultConfig: ExamplesConfig = {
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

let examplesConfigPromise: Promise<ExamplesConfig> | undefined;

export function loadExamplesConfig(): Promise<ExamplesConfig> {
    if (!examplesConfigPromise) {
        examplesConfigPromise = fetch("/examples-config.json")
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        `failed to load runtime config: ${response.status}`,
                    );
                }
                const config: unknown = await response.json();
                if (!validateExamplesConfig(config)) {
                    throw new Error("invalid examples config");
                }
                return config;
            })
            .catch((error: unknown) => {
                examplesConfigPromise = undefined;
                console.error("failed to load examples config", error);
                throw error;
            });
    }

    return examplesConfigPromise;
}

export function platformId(packageName: string): string {
    const name = packageName.split("/").pop() ?? packageName;
    return name.replace(/^platform-/, "");
}
