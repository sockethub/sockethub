import type { IconName } from "$components/Icon.svelte";

/** One example page, as listed in the sidebar and on the home page. */
export interface ExampleInfo {
    /** Route path under the app base, e.g. `/irc`. */
    path: string;
    /** Platform id the server must report for the page to be usable. */
    platform: string;
    title: string;
    icon: IconName;
    /** One line for the home page card. */
    summary: string;
    /** Activity types the example sends. */
    activities: string[];
    /** Needs an account on a real external service. */
    needsAccount: boolean;
    /** Short note on what access the example needs. */
    access: string;
}

export interface ExampleGroup {
    label: string;
    items: ExampleInfo[];
}

export const exampleGroups: ExampleGroup[] = [
    {
        label: "Start here",
        items: [
            {
                path: "/dummy",
                platform: "dummy",
                title: "Dummy",
                icon: "flask",
                summary:
                    "A test platform that answers instantly. Learn the message shape with nothing to set up.",
                activities: ["echo", "greet", "fail", "throw"],
                needsAccount: false,
                access: "No account needed",
            },
        ],
    },
    {
        label: "Web data",
        items: [
            {
                path: "/feeds",
                platform: "feeds",
                title: "Feeds",
                icon: "rss",
                summary: "Fetch an RSS or Atom feed and get each entry back.",
                activities: ["fetch"],
                needsAccount: false,
                access: "No account needed",
            },
            {
                path: "/metadata",
                platform: "metadata",
                title: "Metadata",
                icon: "link",
                summary:
                    "Turn a URL into a link preview: title, description, and image.",
                activities: ["fetch"],
                needsAccount: false,
                access: "No account needed",
            },
        ],
    },
    {
        label: "Chat",
        items: [
            {
                path: "/irc",
                platform: "irc",
                title: "IRC",
                icon: "hash",
                summary: "Connect to an IRC network, join a channel, and chat.",
                activities: ["connect", "join", "send"],
                needsAccount: false,
                access: "No account needed",
            },
            {
                path: "/xmpp",
                platform: "xmpp",
                title: "XMPP",
                icon: "chat",
                summary:
                    "Sign in to a Jabber account and chat in a group room.",
                activities: ["connect", "join", "send"],
                needsAccount: true,
                access: "Needs your own account",
            },
        ],
    },
    {
        label: "Messaging",
        items: [
            {
                path: "/email",
                platform: "email",
                title: "Email",
                icon: "mail",
                summary: "Read mail over IMAP and send it over SMTP.",
                activities: ["connect", "fetch", "send"],
                needsAccount: true,
                access: "Needs your own account",
            },
            {
                path: "/messenger",
                platform: "messenger",
                title: "Messenger",
                icon: "bubble",
                summary: "Reply to a customer from a Facebook Page.",
                activities: ["send"],
                needsAccount: true,
                access: "Needs your own account",
            },
            {
                path: "/instagram",
                platform: "instagram",
                title: "Instagram",
                icon: "camera",
                summary: "Reply from an Instagram professional account.",
                activities: ["send"],
                needsAccount: true,
                access: "Needs your own account",
            },
        ],
    },
    {
        label: "Calendars & contacts",
        items: [
            {
                path: "/caldav",
                platform: "caldav",
                title: "CalDAV",
                icon: "calendar",
                summary:
                    "List calendars, add events and to-dos, or read a public .ics feed.",
                activities: ["fetch", "create", "read"],
                needsAccount: true,
                access: "Public feeds need no account",
            },
            {
                path: "/carddav",
                platform: "carddav",
                title: "CardDAV",
                icon: "contacts",
                summary: "Browse, search, add, edit, and delete contacts.",
                activities: ["fetch", "query", "create"],
                needsAccount: true,
                access: "Needs your own account",
            },
        ],
    },
];

export const allExamples = exampleGroups.flatMap((group) => group.items);

/** Find the catalog entry for a platform id. */
export function exampleFor(platform: string): ExampleInfo | undefined {
    return allExamples.find((example) => example.platform === platform);
}

/** Group label for a platform id, used as the page eyebrow. */
export function groupFor(platform: string): string | undefined {
    return exampleGroups.find((group) =>
        group.items.some((item) => item.platform === platform),
    )?.label;
}
