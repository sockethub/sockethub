import { buildCanonicalContext } from "@sockethub/schemas";
import { PlatformSchema } from "./schema.js";

const XMPP_CONTEXT = buildCanonicalContext(PlatformSchema.contextUrl);

function getMessageBody(stanza) {
    for (const elem of stanza.children) {
        if (elem.name === "body") {
            return elem.children.join(" ");
        }
    }
}

function getMessageTimestamp(stanza) {
    try {
        const delay = stanza.children.find((c) => c.name === "delay");
        return delay.attrs.stamp;
    } catch (_e) {
        // no timestamp
        return null;
    }
}

function getMessageId(stanza) {
    try {
        return stanza.attrs.id;
    } catch (_e) {
        // no message id
        return null;
    }
}

function getMessageStanzaId(stanza) {
    try {
        const stanzaId = stanza.children.find((c) => c.name === "stanza-id");
        return stanzaId.attrs.id;
    } catch (_e) {
        // no stanza id
        return null;
    }
}

function getMessageReplaceId(stanza) {
    try {
        const replaceEl = stanza.children.find((c) => c.name === "replace");
        return replaceEl.attrs.id;
    } catch (_e) {
        // no origin id
        return null;
    }
}

function getPresence(stanza) {
    if (stanza.getChild("show")) {
        return stanza.getChild("show").getText();
    }
    return stanza.attrs.type === "unavailable" ? "offline" : "online";
}

export class IncomingHandlers {
    constructor(session) {
        this.session = session;
    }

    close() {
        if (!this.session) {
            console.debug("close event received but session is undefined");
            return;
        }

        this.session.log.debug(
            "received close event with no handler specified",
        );
        if (this.session.actor && this.session.sendToClient) {
            this.session.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "close",
                actor: this.session.actor,
                target: this.session.actor,
            });
            this.session.log.debug(
                `**** xmpp this.session.for ${this.session.actor.id} closed`,
            );
        }
        if (
            this.session.connection &&
            typeof this.session.connection.disconnect === "function"
        ) {
            this.session.connection.disconnect();
        }
    }

    error(err) {
        try {
            this.session.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "error",
                error: err.text || err.toString(),
                object: {
                    type: "message",
                    condition: err.condition || "unknown",
                },
            });
        } catch (e) {
            this.session.log.debug("*** XMPP ERROR (rl catch): ", e);
        }
    }

    presence(stanza) {
        const obj = {
            "@context": XMPP_CONTEXT,
            type: "update",
            actor: {
                type: "person",
                id: stanza.attrs.from,
            },
            object: {
                type: "presence",
            },
        };
        if (stanza.getChildText("status")) {
            obj.object.content = stanza.getChildText("status");
        }
        obj.object.presence = getPresence(stanza);
        if (stanza.attrs.to) {
            obj.target = { id: stanza.attrs.to, type: "person" };
        } else {
            obj.actor.name = stanza.attrs.from.split("/")[1];
        }
        this.session.log.debug(
            `received contact presence update from ${stanza.attrs.from}`,
        );
        this.session.sendToClient(obj);
    }

    subscribe(to, from, name) {
        this.session.log.debug(`received subscribe request from ${from}`);
        const actor = { id: from, type: "person" };
        if (name) {
            actor.name = name;
        }
        this.session.sendToClient({
            "@context": XMPP_CONTEXT,
            type: "request-friend",
            actor: actor,
            target: to,
        });
    }

    // unsubscribe(from) {
    //   this.session.log.debug('received unsubscribe request from ' + from);
    //   this.session.sendToClient({
    //     type: "remove-friend",
    //     actor: { id: from },
    //     target: this.session.actor
    //   });
    // }

    notifyChatMessage(stanza) {
        const message = getMessageBody(stanza);
        if (!message) {
            return;
        }
        const from = stanza.attrs.from;
        const timestamp = getMessageTimestamp(stanza);
        const messageId = getMessageId(stanza);
        const type = stanza.attrs.type === "groupchat" ? "room" : "person";

        const activity = {
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
            activity.object["xmpp:stanza-id"] = messageStanzaId;
        }

        const messageReplaceId = getMessageReplaceId(stanza);
        if (messageReplaceId) {
            activity.object["xmpp:replace"] = { id: messageReplaceId };
        }

        if (type === "room") {
            [activity.target.id, activity.actor.name] = from.split("/");
        }

        if (timestamp) {
            activity.published = new Date(timestamp).toISOString();
        }

        this.session.sendToClient(activity);
    }

    notifyError(stanza) {
        const error = stanza.getChild("error");
        let message = stanza.toString();
        let type = "message";
        if (stanza.is("presence")) {
            type = "update";
        }

        if (error) {
            message = error.toString();
            if (error.getChild("remote-server-not-found")) {
                // when we get this.session.type of return message, we know it was a response from a join
                type = "join";
                message = `remote server not found ${stanza.attrs.from}`;
            }
        }

        this.session.sendToClient({
            "@context": XMPP_CONTEXT,
            type: type,
            actor: {
                id: stanza.attrs.from,
                type: "room",
            },
            error: message,
            target: {
                id: stanza.attrs.to,
                type: "person",
            },
        });
    }

    notifyRoomAttendance(stanza) {
        const query = stanza.getChild("query");
        if (query) {
            const members = [];
            const entries = query.getChildren("item");
            for (const e in entries) {
                if (!Object.hasOwn(entries, e)) {
                    continue;
                }
                members.push(entries[e].attrs.name);
            }

            this.session.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "query",
                actor: {
                    id: stanza.attrs.from,
                    type: "room",
                },
                target: {
                    id: stanza.attrs.to,
                    type: "person",
                },
                object: {
                    type: "attendance",
                    members: members,
                },
            });
        }
    }

    notifyRoomInfo(stanza) {
        const query = stanza.getChild("query");
        if (
            query &&
            query.attrs.xmlns === "http://jabber.org/protocol/disco#info"
        ) {
            // Extract identities (XEP-0030 §4.2: entities may have multiple identities)
            const identities = query.getChildren("identity").map((el) => ({
                category: el.attrs.category,
                type: el.attrs.type,
                ...(el.attrs.name && { name: el.attrs.name }),
            }));

            // Extract features
            const features = query.getChildren("feature");
            const featureList = features.map((feature) => feature.attrs.var);

            // Use first identity name as actor display name, fall back to JID
            const displayName = identities[0]?.name || stanza.attrs.from;

            const object = { type: "room-info", features: featureList };
            if (identities.length > 0) {
                object.identities = identities;
            }

            this.session.sendToClient({
                "@context": XMPP_CONTEXT,
                type: "room-info",
                actor: {
                    id: stanza.attrs.from,
                    type: "room",
                    name: displayName,
                },
                target: {
                    id: stanza.attrs.to,
                    type: "person",
                },
                object,
            });
        }
    }

    notifyRoomInfoError(stanza) {
        const error = stanza.getChild("error");
        const message = error ? error.toString() : stanza.toString();
        this.session.sendToClient({
            "@context": XMPP_CONTEXT,
            type: "room-info",
            actor: {
                id: stanza.attrs.from,
                type: "room",
            },
            target: {
                id: stanza.attrs.to,
                type: "person",
            },
            error: message,
        });
    }

    online() {
        this.session.log.debug("online");
    }

    /**
     * Handles all unknown conditions that we don't have an explicit handler for
     **/
    stanza(stanza) {
        // console.log("incoming stanza ", stanza);
        if (stanza.attrs.type === "error") {
            if (
                stanza.is("iq") &&
                stanza.attrs.id?.startsWith("room_info_")
            ) {
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
                this.session.log.debug("got room attendance list");
                return this.notifyRoomAttendance(stanza);
            }

            // Handle room info disco#info responses
            if (
                stanza.attrs.type === "result" &&
                stanza.attrs.id?.startsWith("room_info_")
            ) {
                this.session.log.debug("got room info response");
                return this.notifyRoomInfo(stanza);
            }

            // todo: clean up this area, unsure of what these are
            const query = stanza.getChild("query");
            if (query) {
                const entries = query.getChildren("item");
                for (const e in entries) {
                    if (!entries.hasOwn(e)) {
                        continue;
                    }
                    this.session.log.debug("STANZA ATTRS: ", entries[e].attrs);
                    if (entries[e].attrs.subscription === "both") {
                        this.session.sendToClient({
                            "@context": XMPP_CONTEXT,
                            type: "update",
                            actor: {
                                id: entries[e].attrs.jid,
                                name: entries[e].attrs.name,
                            },
                            target: this.session.actor,
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
                        this.session.sendToClient({
                            "@context": XMPP_CONTEXT,
                            type: "update",
                            actor: {
                                id: entries[e].attrs.jid,
                                name: entries[e].attrs.name,
                            },
                            target: this.session.actor,
                            object: {
                                type: "presence",
                                statusText: "",
                                presence: "notauthorized",
                            },
                        });
                    } else {
                        /**
                         * can't figure out how to know if one of these query stanzas are from
                         * added contacts or pending requests
                         */
                        this.subscribe(
                            this.session.actor,
                            entries[e].attrs.jid,
                            entries[e].attrs.name,
                        );
                    }
                }
            }
        } else {
            this.session.log.debug(`got XMPP unknown stanza... ${stanza}`);
        }
    }
}
