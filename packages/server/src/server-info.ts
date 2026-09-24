/**
 * The human-facing server info page served at the root URL.
 *
 * A browser hitting a Sockethub server should learn what it is talking to and
 * how to connect, instead of seeing a bare 404. The page is the human rendering
 * of the same public API information the HTTP actions service descriptor
 * publishes to machines (see `api-info.ts`), plus operator-supplied details
 * from the `about` config block. Exact package versions stay off the page
 * unless the operator opts in with `about.showVersion`.
 */
import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { buildServiceDescriptor } from "./api-info.js";
import type { PlatformMap } from "./bootstrap/load-platforms.js";
import config from "./config.js";
import { SOCKETHUB_API_VERSION, SOCKETHUB_VERSION } from "./version.js";

export const EXAMPLES_PATH = "/examples";

const DOCS_URL = "https://sockethub.org";
const SOURCE_URL = "https://github.com/sockethub/sockethub";
const ACTIVITYSTREAMS_URL = "https://www.w3.org/TR/activitystreams-core/";
const CLIENT_GUIDE_URL =
    "https://github.com/sockethub/sockethub/blob/master/docs/client-guide.md";

export type InfoLink = { label: string; url: string };

export type ServerInfo = {
    name?: string;
    description?: string;
    contact?: string;
    links: Array<InfoLink>;
    apiVersion: number;
    /** Only present when `about.showVersion` is enabled. */
    version?: string;
    /** Only present when `about.showVersion` is enabled. */
    uptimeSeconds?: number;
    platforms: Array<{ id: string; apiVersion: number }>;
    endpoints: {
        /**
         * Socket.IO needs the origin and the transport path as separate
         * `io()` arguments: a path appended to the URL would be read as a
         * namespace, not as the server's path.
         */
        socket: { origin: string; path: string };
        httpActions?: string;
        examples?: string;
    };
};

export type ServerInfoOptions = {
    platforms: PlatformMap;
};

export type ServerInfoDependencies = {
    getConfig?: (key: string) => unknown;
    uptimeSeconds?: () => number;
};

const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443 };

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() !== ""
        ? value.trim()
        : undefined;
}

/** Only http(s) links are rendered; anything else is dropped, never linked. */
function safeLinks(value: unknown): Array<InfoLink> {
    if (!Array.isArray(value)) {
        return [];
    }
    const links: Array<InfoLink> = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") {
            continue;
        }
        const label = nonEmptyString((entry as InfoLink).label);
        const url = nonEmptyString((entry as InfoLink).url);
        if (label && url && /^https?:\/\//i.test(url)) {
            links.push({ label, url });
        }
    }
    return links;
}

/**
 * Origin clients reach this server at, built from the `public` settings so it
 * is right behind a reverse proxy. The port is omitted when it is the protocol
 * default.
 */
export function publicOrigin(getConfig: (key: string) => unknown): string {
    const protocol = nonEmptyString(getConfig("public:protocol")) ?? "http";
    const host = nonEmptyString(getConfig("public:host")) ?? "localhost";
    const port = Number(getConfig("public:port"));
    const portSuffix =
        Number.isFinite(port) && port > 0 && DEFAULT_PORTS[protocol] !== port
            ? `:${port}`
            : "";
    return `${protocol}://${host}${portSuffix}`;
}

/** The origin and transport path a client hands to `io(origin, { path })`. */
export function publicSocketEndpoint(getConfig: (key: string) => unknown): {
    origin: string;
    path: string;
} {
    return {
        origin: publicOrigin(getConfig),
        path: nonEmptyString(getConfig("sockethub:path")) ?? "/",
    };
}

export function buildServerInfo(
    platforms: PlatformMap,
    deps: ServerInfoDependencies = {},
): ServerInfo {
    const getConfig = deps.getConfig ?? ((key: string) => config.get(key));
    const uptime = deps.uptimeSeconds ?? (() => process.uptime());
    const showVersion = Boolean(getConfig("about:showVersion"));
    const httpActionsPath = nonEmptyString(getConfig("httpActions:path"));

    const info: ServerInfo = {
        name: nonEmptyString(getConfig("about:name")),
        description: nonEmptyString(getConfig("about:description")),
        contact: nonEmptyString(getConfig("about:contact")),
        links: safeLinks(getConfig("about:links")),
        apiVersion: SOCKETHUB_API_VERSION,
        platforms: Array.from(platforms.values()).map((platform) => ({
            id: platform.id,
            apiVersion: platform.apiVersion,
        })),
        endpoints: {
            socket: publicSocketEndpoint(getConfig),
        },
    };
    if (showVersion) {
        info.version = SOCKETHUB_VERSION;
        info.uptimeSeconds = Math.floor(uptime());
    }
    if (Boolean(getConfig("httpActions:enabled")) && httpActionsPath) {
        info.endpoints.httpActions = `${publicOrigin(getConfig)}${httpActionsPath}`;
    }
    if (getConfig("examples")) {
        info.endpoints.examples = EXAMPLES_PATH;
    }
    return info;
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function formatUptime(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: Array<string> = [];
    if (days > 0) {
        parts.push(`${days} day${days === 1 ? "" : "s"}`);
    }
    if (hours > 0) {
        parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
    }
    if (days === 0 && minutes > 0) {
        parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
    }
    if (parts.length === 0) {
        return "less than a minute";
    }
    return parts.join(", ");
}

/** A `mailto:` link for addresses, a plain link for URLs, text otherwise. */
function renderContact(contact: string): string {
    const text = escapeHtml(contact);
    if (/^https?:\/\//i.test(contact)) {
        return `<a href="${text}" rel="noopener">${text}</a>`;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        return `<a href="mailto:${text}">${text}</a>`;
    }
    return text;
}

function row(label: string, valueHtml: string): string {
    return `<tr><th scope="row">${escapeHtml(label)}</th><td>${valueHtml}</td></tr>`;
}

function link(url: string, text: string): string {
    return `<a href="${escapeHtml(url)}" rel="noopener">${escapeHtml(text)}</a>`;
}

const STYLES = `
:root { color-scheme: light dark; --fg: #111; --muted: #5b5751; --bg: #fff; --stripe: #f6f4f0; --line: #e2ddd5; --head: #e9e4dc; --head-fg: #2b2825; --accent: #f23c00; }
@media (prefers-color-scheme: dark) { :root { --fg: #ece8e1; --muted: #a39d94; --bg: #151412; --stripe: #1c1a17; --line: #302d28; --head: #2a2723; --head-fg: #ece8e1; --accent: #ff7a45; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem 1.25rem 4rem; background: var(--bg); color: var(--fg); font: 18px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 52rem; margin: 0 auto; }
header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem 2rem; margin: .5rem 0 2.25rem; }
h1 { margin: 0; line-height: 0; }
h1 img { width: 240px; max-width: 100%; height: auto; display: block; }
@media (prefers-color-scheme: dark) { h1 img { filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff); } }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.connect { margin: 0; font-size: 1.15rem; font-weight: 600; }
.connect a { color: var(--accent); }
.examples { margin: -1.25rem 0 2rem; padding: .8rem 1rem; border-left: 4px solid var(--accent); background: var(--stripe); font-size: 1rem; }
.examples p { margin: 0; }
table { width: 100%; border-collapse: collapse; margin-bottom: 2.5rem; font-size: 1.05rem; }
caption { text-align: left; caption-side: top; padding: .55rem .9rem; background: var(--head); color: var(--head-fg); font-weight: 700; font-size: 1.1rem; }
th, td { padding: .6rem .8rem; vertical-align: top; }
th[scope=row] { width: 24%; text-align: right; font-weight: 400; color: var(--muted); white-space: nowrap; }
td { font-weight: 600; overflow-wrap: anywhere; }
tbody tr:nth-child(even) { background: var(--stripe); }
code { font: .92em ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 500; }
a { color: var(--accent); text-underline-offset: .15em; }
.platforms { display: flex; flex-wrap: wrap; gap: .4rem .5rem; }
.platforms span { border: 1px solid var(--line); border-radius: 999px; padding: .05rem .7rem; font-weight: 500; }
.platforms small { color: var(--muted); font-weight: 400; }
footer { color: var(--muted); font-size: .95rem; }
footer a { color: inherit; }
`.trim();

function table(caption: string, rows: Array<string>): string {
    return `<table><caption>${escapeHtml(caption)}</caption><tbody>${rows.join("")}</tbody></table>`;
}

export function renderServerInfoPage(info: ServerInfo): string {
    const title = info.name ? `${info.name} · Sockethub` : "Sockethub server";

    const serverRows: Array<string> = [];
    if (info.name) {
        serverRows.push(row("Name", escapeHtml(info.name)));
    }
    if (info.description) {
        serverRows.push(row("Description", escapeHtml(info.description)));
    }
    if (info.contact) {
        serverRows.push(row("Contact", renderContact(info.contact)));
    }
    for (const entry of info.links) {
        serverRows.push(row(entry.label, link(entry.url, entry.url)));
    }

    const connectRows: Array<string> = [
        // Shown as the actual client call: the path is an `io()` option, and
        // appending it to the URL would select a namespace instead.
        row(
            "Socket.IO",
            `<code>io(${JSON.stringify(escapeHtml(info.endpoints.socket.origin))}, { path: ${JSON.stringify(escapeHtml(info.endpoints.socket.path))} })</code>`,
        ),
    ];
    if (info.endpoints.httpActions) {
        connectRows.push(
            row(
                "HTTP actions",
                `<code>${escapeHtml(info.endpoints.httpActions)}</code>`,
            ),
        );
    }
    connectRows.push(row("Client guide", link(CLIENT_GUIDE_URL, "docs")));

    const platformItems =
        info.platforms.length > 0
            ? info.platforms
                  .map(
                      (platform) =>
                          `<span>${escapeHtml(platform.id)} <small>v${platform.apiVersion}</small></span>`,
                  )
                  .join("")
            : "<span>none enabled</span>";

    const softwareRows: Array<string> = [
        row("Software", link(SOURCE_URL, "Sockethub")),
        row("API version", String(info.apiVersion)),
    ];
    if (info.version !== undefined) {
        softwareRows.push(row("Version", escapeHtml(info.version)));
    }
    softwareRows.push(
        row("Platforms", `<div class="platforms">${platformItems}</div>`),
    );
    if (info.uptimeSeconds !== undefined) {
        softwareRows.push(row("Uptime", formatUptime(info.uptimeSeconds)));
    }

    const examplesNotice = info.endpoints.examples
        ? `<div class="examples"><p>Interactive examples for each platform are enabled on this server: <a href="${escapeHtml(info.endpoints.examples)}">open the examples</a>.</p></div>`
        : "";

    const serverTable =
        serverRows.length > 0 ? table("Server", serverRows) : "";

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate icon" href="/favicon.ico" type="image/x-icon">
<style>${STYLES}</style>
</head>
<body>
<main>
<header>
<h1><a href="${DOCS_URL}" rel="noopener" title="Sockethub"><span class="sr-only">Sockethub</span><img src="/sockethub-logo.svg" alt="" width="240" height="75"></a></h1>
<p class="connect">Please use a <a href="${CLIENT_GUIDE_URL}" rel="noopener">Sockethub client</a> to connect.</p>
</header>
${examplesNotice}
${serverTable}
${table("Connect", connectRows)}
${table("Server Software", softwareRows)}
<footer><a href="${DOCS_URL}" rel="noopener">Sockethub</a> is a multi-protocol gateway for the Web, speaking <a href="${ACTIVITYSTREAMS_URL}" rel="noopener">ActivityStreams 2.0</a>. <a href="${SOURCE_URL}" rel="noopener">Source</a>.</footer>
</main>
</body>
</html>
`;
}

/**
 * Register `GET /`. Browsers get the HTML page; a client that explicitly asks
 * for JSON gets the same service descriptor the HTTP actions path serves, so
 * discovery works from the root even when HTTP actions are disabled.
 */
export function registerServerInfoRoute(
    app: Express,
    options: ServerInfoOptions,
    deps: ServerInfoDependencies = {},
) {
    // Same budget as the examples static files: this is a page for humans.
    const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false,
    });
    // The registry is static after platform load, so build this once.
    const descriptor = buildServiceDescriptor(options.platforms);

    app.get("/", limiter, (req: Request, res: Response) => {
        res.setHeader("Cache-Control", "no-store");
        if (req.accepts(["html", "json"]) === "json") {
            res.status(200).json(descriptor);
            return;
        }
        // Uptime changes per request, so the info is rebuilt each time.
        const info = buildServerInfo(options.platforms, deps);
        res.status(200).type("html").send(renderServerInfoPage(info));
    });
}
