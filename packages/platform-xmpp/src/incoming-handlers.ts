import { buildCanonicalContext } from "@sockethub/schemas";
import type { XmppElement } from "@xmpp/client";

import { PlatformSchema } from "./schema.js";
import type { XmppHandlerSession } from "./types.js";
import { utils } from "./utils.js";

const XMPP_CONTEXT = buildCanonicalContext(PlatformSchema.contextUrl);

function getMessageBody(stanza: XmppElement): string | undefined {
    for (const elem of stanza.children) {
        if (typeof elem !== "string" && elem.name === "body") {
            return elem.children.join(" ");
        }
    }
}

function getMessageTimestamp(stanza: XmppElement): string | null {
    try {
        const delay = stanza.children.find(
            (c): c is XmppElement =>
                typeof c !== "string" && c.name === "delay",
        );
        return delay?.attrs.stamp ?? null;
    } catch (_e) {
        return null;
    }
}

function getMessageId(stanza: XmppElement): string | null {
    try {
        return stanza.attrs.id ?? null;
    } catch (_e) {
        return null;
    }
}

function getMessageStanzaId(stanza: XmppElement): string | null {
    try {
        const stanzaId = stanza.children.find(
            (c): c is XmppElement =>
                typeof c !== "string" && c.name === "stanza-id",
        );
        return stanzaId?.attrs.id ?? null;
    } catch (_e) {
        return null;
    }
}

function getMessageReplaceId(stanza: XmppElement): string | null {
    try {
        const replaceEl = stanza.children.find(
            (c): c is XmppElement =>
                typeof c !== "string" && c.name === "replace",
        );
        return replaceEl?.attrs.id ?? null;
    } catch (_e) {
        return null;
    }
}

function getPresence(stanza: XmppElement): string {
    if (stanza.getChild("show")) {
        return stanza.getChild("show")!.getText();
    }
    return stanza.attrs.type === "unavailable" ? "offline" : "online";
}

export class IncomingHandlers {
    /** @internal Exposed to allow test access for null-handling validation. */
    session: XmppHandlerSession | undefined;

    constructor(session?: XmppHandlerSession) {
        this.session = session;
    }

    close(): void {
        if (!this.session) {
            console.debug("close event received but session is undefined");
            return;
        }

        this.session!.log.debug(
            "received close event with no handler specified",
        );
        if (this.session!.actor && this.session!.sendToClient) {
            this.session!.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "close",
                actor: this.session!.actor,
                target: this.session!.actor,
            });
            this.session!.log.debug(
                `**** xmpp session for ${this.session!.actor.id} closed`,
            );
        }
        if (
            this.session!.connection &&
            typeof this.session!.connection.disconnect === "function"
        ) {
            this.session!.connection.disconnect();
        }
    }

    error(err: {
        text?: string;
        condition?: string;
        toString(): string;
    }): void {
        try {
            this.session!.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "error",
                actor: { id: "unknown", type: "person" },
                error: err.text || err.toString(),
                object: {
                    type: "message",
                    condition: err.condition || "unknown",
                },
            });
        } catch (e) {
            this.session!.log.debug("*** XMPP ERROR (rl catch): ", { e });
        }
    }

    presence(stanza: XmppElement): void {
        const bareJid = (stanza.attrs.from ?? "").split("/")[0];
        const actorType = this.session!.__knownRooms.has(bareJid)
            ? "room"
            : "person";

        const obj: Record<string, unknown> = {
            "@context": XMPP_CONTEXT,
            type: "update",
            actor: {
                type: actorType,
                id: stanza.attrs.from,
            },
            object: {
                type: "presence",
            },
        };
        if (stanza.getChildText("status")) {
            (obj.object as Record<string, unknown>).content =
                stanza.getChildText("status");
        }
        (obj.object as Record<string, unknown>).presence = getPresence(stanza);
        if (stanza.attrs.to) {
            obj.target = { id: stanza.attrs.to, type: "person" };
        } else {
            (obj.actor as Record<string, unknown>).name =
                stanza.attrs.from?.split("/")[1];
        }
        this.session!.log.debug(
            `received ${actorType} contact presence update from ${stanza.attrs.from}`,
        );
        // biome-ignore lint/suspicious/noExplicitAny: ActivityStream type doesn't cover all dynamic XMPP fields
        this.session!.sendToClient(obj as any);
    }

    subscribe(
        to: { id: string; type: string },
        from: string,
        name?: string,
    ): void {
        this.session!.log.debug(`received subscribe request from ${from}`);
        const actor: { id: string; type: string; name?: string } = {
            id: from,
            type: "person",
        };
        if (name) {
            actor.name = name;
        }
        this.session!.sendToClient({
            "@context": XMPP_CONTEXT,
            type: "request-friend",
            actor: actor,
            target: to,
        });
    }

    notifyChatMessage(stanza: XmppElement): void {
        const message = getMessageBody(stanza);
        if (!message) {
            return;
        }
        const from = stanza.attrs.from ?? "";
        const timestamp = getMessageTimestamp(stanza);
        const messageId = getMessageId(stanza);
        const type = stanza.attrs.type === "groupchat" ? "room" : "person";

        const activity: Record<string, unknown> = {
            "@context": XMPP_CONTEXT,
            type: "send",
            actor: {
                type: "person",
                id: from,
            },
            target: {
                type: type,
                id: stanza.attrs.to,
            },
            object: {
                type: "message",
                id: messageId,
                content: message,
            },
        };

        const messageStanzaId = getMessageStanzaId(stanza);
        if (messageStanzaId) {
            (activity.object as Record<string, unknown>)["xmpp:stanza-id"] =
                messageStanzaId;
        }

        const messageReplaceId = getMessageReplaceId(stanza);
        if (messageReplaceId) {
            (activity.object as Record<string, unknown>)["xmpp:replace"] = {
                id: messageReplaceId,
            };
        }

        if (type === "room") {
            const [targetId, actorName] = from.split("/");
            (activity.target as Record<string, unknown>).id = targetId;
            (activity.actor as Record<string, unknown>).name = actorName;
        }

        if (timestamp) {
            activity.published = new Date(timestamp).toISOString();
        }

        // biome-ignore lint/suspicious/noExplicitAny: ActivityStream type doesn't cover all dynamic XMPP fields
        this.session!.sendToClient(activity as any);
    }

    notifyError(stanza: XmppElement): void {
        const error = stanza.getChild("error");
        let message = stanza.toString();
        let type = "message";
        if (stanza.is("presence")) {
            type = "update";
        }

        if (error) {
            message = error.toString();
            if (error.getChild("remote-server-not-found")) {
                type = "join";
                message = `remote server not found ${stanza.attrs.from}`;
            }
        }

        this.session!.sendToClient({
            "@context": XMPP_CONTEXT,
            type: type,
            actor: {
                id: stanza.attrs.from ?? "",
                type: "room",
            },
            error: message,
            target: {
                id: stanza.attrs.to ?? "",
                type: "person",
            },
        });
    }

    notifyRoomAttendance(stanza: XmppElement): void {
        const query = stanza.getChild("query");
        if (query) {
            const members: string[] = [];
            const entries = query.getChildren("item");
            for (const e in entries) {
                if (!Object.hasOwn(entries, e)) {
                    continue;
                }
                members.push(entries[e].attrs.name ?? "");
            }

            this.session!.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "query",
                actor: {
                    id: stanza.attrs.from ?? "",
                    type: "room",
                },
                target: {
                    id: stanza.attrs.to ?? "",
                    type: "person",
                },
                object: {
                    type: "attendance",
                    members: members,
                },
            });
        }
    }

    notifyRoomInfo(stanza: XmppElement): void {
        const query = stanza.getChild("query");
        if (
            query &&
            query.attrs.xmlns === "http://jabber.org/protocol/disco#info"
        ) {
            const identities = query
                .getChildren("identity")
                .filter((el) => el.attrs.category && el.attrs.type)
                .map((el) => ({
                    category: el.attrs.category as string,
                    type: el.attrs.type as string,
                    ...(el.attrs.name && { name: el.attrs.name }),
                }));

            const featureList = query
                .getChildren("feature")
                .filter((el) => el.attrs.var)
                .map((el) => el.attrs.var as string);

            const displayName = identities[0]?.name || stanza.attrs.from;

            const object: Record<string, unknown> = {
                type: "room-info",
                features: featureList,
            };
            if (identities.length > 0) {
                object.identities = identities;
            }

            const x = query
                .getChildren("x")
                .find((el) => el.attrs.xmlns === "jabber:x:data");

            if (x) {
                const fields = x.getChildren("field");
                for (const field of fields) {
                    const parsed = utils.parseXDataField(field);
                    if (!parsed) {
                        continue;
                    }

                    let section = "custom";
                    let key = parsed.var;

                    if (parsed.var.startsWith("muc#")) {
                        const remainder = parsed.var.slice(4);
                        const underscoreIdx = remainder.indexOf("_");
                        if (underscoreIdx !== -1) {
                            const parsedSection = remainder.slice(
                                0,
                                underscoreIdx,
                            );
                            if (
                                parsedSection === "roominfo" ||
                                parsedSection === "roomconfig"
                            ) {
                                section = parsedSection;
                                key = remainder.slice(underscoreIdx + 1);
                            }
                        }
                    }

                    if (!object[section]) {
                        object[section] = {};
                    }
                    (object[section] as Record<string, unknown>)[key] =
                        parsed.field;
                }
            }

            this.session!.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "query",
                actor: {
                    id: stanza.attrs.from ?? "",
                    type: "room",
                    name: displayName,
                },
                target: {
                    id: stanza.attrs.to ?? "",
                    type: "person",
                },
                object,
            });
        } else {
            this.notifyRoomInfoError(stanza);
        }
    }

    notifyRoomInfoError(stanza: XmppElement): void {
        const error = stanza.getChild("error");
        const message = error ? error.toString() : stanza.toString();
        this.session!.sendToClient({
            "@context": XMPP_CONTEXT,
            type: "query",
            actor: {
                id: stanza.attrs.from ?? "",
                type: "room",
            },
            target: {
                id: stanza.attrs.to ?? "",
                type: "person",
            },
            object: {
                type: "room-info",
            },
            error: message,
        });
    }

    online(): void {
        this.session!.log.debug("online");
    }

    stanza(stanza: XmppElement): void {
        if (stanza.attrs.type === "error") {
            if (stanza.is("iq") && stanza.attrs.id?.startsWith("room_info_")) {
                return this.notifyRoomInfoError(stanza);
            }
            this.notifyError(stanza);
        } else if (stanza.is("message")) {
            this.notifyChatMessage(stanza);
        } else if (stanza.is("presence")) {
            this.presence(stanza);
        } else if (stanza.is("iq")) {
            if (
                stanza.attrs.id === "muc_id" &&
                stanza.attrs.type === "result"
            ) {
                this.session!.log.debug("got room attendance list");
                return this.notifyRoomAttendance(stanza);
            }

            if (
                stanza.attrs.type === "result" &&
                stanza.attrs.id?.startsWith("room_info_")
            ) {
                this.session!.log.debug("got room info response");
                return this.notifyRoomInfo(stanza);
            }

            const query = stanza.getChild("query");
            if (query) {
                const entries = query.getChildren("item");
                for (const e in entries) {
                    if (!Object.hasOwn(entries, e)) {
                        continue;
                    }
                    this.session!.log.debug("STANZA ATTRS: ", entries[e].attrs);
                    if (entries[e].attrs.subscription === "both") {
                        this.session!.sendToClient({
                            "@context": XMPP_CONTEXT,
                            type: "update",
                            actor: {
                                id: entries[e].attrs.jid ?? "",
                                name: entries[e].attrs.name,
                                type: "person",
                            },
                            target: this.session!.actor ?? {
                                id: "",
                                type: "person",
                            },
                            object: {
                                type: "presence",
                                status: "",
                                presence: getPresence(entries[e]),
                            },
                        });
                    } else if (
                        entries[e].attrs.subscription === "from" &&
                        entries[e].attrs.ask &&
                        entries[e].attrs.ask === "subscribe"
                    ) {
                        this.session!.sendToClient({
                            "@context": XMPP_CONTEXT,
                            type: "update",
                            actor: {
                                id: entries[e].attrs.jid ?? "",
                                name: entries[e].attrs.name,
                                type: "person",
                            },
                            target: this.session!.actor ?? {
                                id: "",
                                type: "person",
                            },
                            object: {
                                type: "presence",
                                statusText: "",
                                presence: "notauthorized",
                            },
                        });
                    } else {
                        this.subscribe(
                            this.session!.actor ?? { id: "", type: "person" },
                            entries[e].attrs.jid ?? "",
                            entries[e].attrs.name,
                        );
                    }
                }
            }
        } else {
            this.session!.log.debug(`got XMPP unknown stanza... ${stanza}`);
        }
    }
}
