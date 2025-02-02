import security from "eslint-plugin-security";
import globals from "globals";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: [
            "**/node_modules",
            "**/.svelte-kit",
            "**/dist",
            "**/build",
            "**/*-suite.js",
            "**/*.d.ts",
            "**/*.data.*",
            "**/.DS_Store",
            ".svelte-kit",
            "!**/.env.example",
            "**/pnpm-lock.yaml",
            "packages/platform-irc/src/octal-hack.js",
            "packages/server/res",
            "packages/sockethub/build",
            "test",
            "**/*.test.*",
        ],
    },
    ...compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
    ),
    {
        plugins: {
            security,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.mocha,
            },

            ecmaVersion: 2021,
            sourceType: "module",

            parserOptions: {
                ecmaFeatures: {
                    jsx: false,
                    modules: true,
                },
            },
        },

        settings: {
            "svelte3/typescript": "() => require('typescript')",
        },

        rules: {
            "comma-spacing": [
                2,
                {
                    before: false,
                    after: true,
                },
            ],

            eqeqeq: 2,
            "handle-callback-err": 2,
            "keyword-spacing": 2,
            "no-eq-null": 2,
            "no-eval": 2,
            "no-tabs": 2,
            "no-var": 2,
            semi: 2,
            "space-before-blocks": 2,

            "space-before-function-paren": [
                2,
                {
                    anonymous: "always",
                    named: "never",
                },
            ],

            "no-octal-escape": "off",
            "security/detect-object-injection": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    caughtErrors: "none",
                },
            ],
        },
    },
    ...compat
        .extends("plugin:@typescript-eslint/recommended")
        .map((config) => ({
            ...config,
            files: ["**/*.ts"],
        })),
    {
        files: ["**/*.ts"],

        plugins: {
            "@typescript-eslint": typescriptEslint,
            security,
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 5,
            sourceType: "script",

            parserOptions: {
                project: ["./tsconfig.json"],
            },
        },
    },
    {
        files: ["**/*.test.ts"],

        rules: {
            "@typescript-eslint/no-explicit-any": ["off"],
            "@typescript-eslint/no-empty-function": ["off"],
        },
    },
    {
        files: ["**/*.js"],

        rules: {
            "@typescript-eslint/no-var-requires": ["off"],
        },
    },
];
