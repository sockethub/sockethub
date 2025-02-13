import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import parser from "svelte-eslint-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: ["build", ".svelte-kit"],
    },
    ...compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:svelte/recommended",
        "prettier",
    ),
    {
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },

            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: "module",

            parserOptions: {
                extraFileExtensions: [".svelte"],
            },
        },

        rules: {
            "svelte/no-at-html-tags": "off",
        },
    },
    {
        files: ["**/*.svelte"],

        languageOptions: {
            parser: parser,
            ecmaVersion: 5,
            sourceType: "script",

            parserOptions: {
                parser: "@typescript-eslint/parser",
            },
        },
    },
];
