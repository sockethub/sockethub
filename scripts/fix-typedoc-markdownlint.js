#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const GENERIC_HEADINGS = new Set([
    "Call Signature",
    "Description",
    "Extended by",
    "Extends",
    "Get Signature",
    "Hierarchy",
    "Implementation of",
    "Indexable",
    "Inherited from",
    "Overrides",
    "Parameters",
    "Returns",
    "Set Signature",
    "Type Parameters",
    "Type declaration",
]);

function walkMarkdownFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...walkMarkdownFiles(fullPath));
            continue;
        }

        if (entry.isFile() && fullPath.endsWith(".md")) {
            files.push(fullPath);
        }
    }

    return files;
}

function rewriteHeadings(content) {
    const lines = content.split("\n");
    const headings = [];
    let inFence = false;

    return lines
        .map((line) => {
            if (/^```/.test(line)) {
                inFence = !inFence;
                return line;
            }

            if (inFence) {
                return line;
            }

            const match = /^(#{1,6}) (.+)$/.exec(line);

            if (!match) {
                return line;
            }

            const [, hashes, rawHeading] = match;
            const level = hashes.length;

            headings.length = level;

            let heading = rawHeading.trim();

            if (level >= 4 && GENERIC_HEADINGS.has(heading)) {
                const contextParts = headings
                    .slice(3, level)
                    .filter(Boolean)
                    .map((value) => String(value).replace(/[*_`]/g, "").trim())
                    .reduce((parts, value) => {
                        const previous = parts.at(-1);

                        if (previous && value.startsWith(`${previous} `)) {
                            parts[parts.length - 1] = value;
                            return parts;
                        }

                        parts.push(value);
                        return parts;
                    }, []);
                const context = contextParts.join(" ");

                if (context) {
                    heading = `${context} ${heading}`;
                    line = `${hashes} ${heading}`;
                }
            }

            headings[level] = heading;
            return line;
        })
        .join("\n");
}

function main() {
    const targetDir = process.argv[2];

    if (!targetDir) {
        console.error("Usage: fix-typedoc-markdownlint.js <docs-dir>");
        process.exit(1);
    }

    const resolvedDir = path.resolve(process.cwd(), targetDir);

    if (!fs.existsSync(resolvedDir)) {
        console.error(`Directory not found: ${resolvedDir}`);
        process.exit(1);
    }

    for (const filePath of walkMarkdownFiles(resolvedDir)) {
        const original = fs.readFileSync(filePath, "utf8");
        const updated = rewriteHeadings(original);

        if (updated !== original) {
            fs.writeFileSync(filePath, updated);
        }
    }
}

main();
