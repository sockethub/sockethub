const DISCOVERY_TIMEOUT = 5000;

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
    } catch (e) {
        // no timestamp
        return null;
    }
}

function getMessageId(stanza) {
    try {
        return stanza.attrs.id;
    } catch (e) {
        // no message id
        return null;
    }
}

function getMessageStanzaId(stanza) {
    try {
        const stanzaId = stanza.children.find((c) => c.name === "stanza-id");
        return stanzaId.attrs.id;
    } catch (e) {
        // no stanza id
        return null;
    }
}

function getMessageReplaceId(stanza) {
    try {
        const replaceEl = stanza.children.find((c) => c.name === "replace");
        return replaceEl.attrs.id;
    } catch (e) {
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
        // Cache for JID type discoveries to avoid repeated queries
        this.jidTypeCache = new Map();
    }

    /**
     * Determines the actor type (person or room) for a JID using service discovery.
     * Falls back to heuristic if service discovery fails.
     * @param {string} jid - The JID to check
     * @returns {Promise<string>} - 'person' or 'room'
     */
    async determineActorType(jid) {
        // Remove resource part for bare JID
        const bareJid = jid.split("/")[0];

        // Check cache first
        if (this.jidTypeCache.has(bareJid)) {
            return this.jidTypeCache.get(bareJid);
        }

        try {
            // Perform service discovery
            const discoId = `disco_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            const discoIq = this.session.__xml(
                "iq",
                {
                    type: "get",
                    to: bareJid,
                    id: discoId,
                },
                this.session.__xml("query", {
                    xmlns: "http://jabber.org/protocol/disco#info",
                }),
            );

            // Send disco query and wait for response
            const response = await this.session.__client.sendReceive(
                discoIq,
                DISCOVERY_TIMEOUT,
            ); // 5 second timeout

            // Look for MUC feature or room identity
            const query = response.getChild("query");
            if (query) {
                // Check for MUC feature
                const features = query.getChildren("feature");
                for (const feature of features) {
                    if (
                        feature.attrs.var === "http://jabber.org/protocol/muc"
                    ) {
                        this.jidTypeCache.set(bareJid, "room");
                        return "room";
                    }
                }

                // Check for conference identity
                const identities = query.getChildren("identity");
                for (const identity of identities) {
                    if (identity.attrs.category === "conference") {
                        this.jidTypeCache.set(bareJid, "room");
                        return "room";
                    }
                }
            }

            // Default to person if no room indicators found
            this.jidTypeCache.set(bareJid, "person");
            return "person";
        } catch (error) {
            // Provide more specific error messages for debugging
            const errorType =
                error.name === "TimeoutError" ||
                error.message.includes("timeout")
                    ? "timeout"
                    : "error";
            this.session.debug(
                `Service discovery ${errorType} for ${bareJid}, falling back to heuristic: ${error.message}`,
            );

            // Fallback: Use heuristic - if JID looks like a conference server, assume room
            // This is a simple heuristic based on common patterns
            const type =
                bareJid.includes("conference.") ||
                bareJid.includes("muc.") ||
                bareJid.includes("chat.")
                    ? "room"
                    : "person";
            this.jidTypeCache.set(bareJid, type);
            return type;
        }
    }

    close() {
        if (!this.session) {
            console.debug("close event received but session is undefined");
            return;
        }

        this.session.debug("received close event with no handler specified");
        if (this.session.actor && this.session.sendToClient) {
            this.session.sendToClient({
                context: "xmpp",
                type: "close",
                actor: this.session.actor,
                target: this.session.actor,
            });
            this.session.debug(
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
                context: "xmpp",
                type: "error",
                error: err.text || err.toString(),
                object: {
                    type: "message",
                    condition: err.condition || "unknown",
                },
            });
        } catch (e) {
            this.session.debug("*** XMPP ERROR (rl catch): ", e);
        }
    }

    async presence(stanza) {
        // Determine the actor type using service discovery
        const actorType = await this.determineActorType(stanza.attrs.from);

        const obj = {
            context: "xmpp",
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
            obj.object.content = stanza.getChildText("status");
        }
        obj.object.presence = getPresence(stanza);
        if (stanza.attrs.to) {
            obj.target = { id: stanza.attrs.to, type: "person" };
        } else {
            obj.actor.name = stanza.attrs.from.split("/")[1];
        }
        this.session.debug(
            `received ${actorType} presence update from ${stanza.attrs.from}`,
        );
        this.session.sendToClient(obj);
    }

    subscribe(to, from, name) {
        this.session.debug(`received subscribe request from ${from}`);
        const actor = { id: from, type: "person" };
        if (name) {
            actor.name = name;
        }
        this.session.sendToClient({
            context: "xmpp",
            type: "request-friend",
            actor: actor,
            target: to,
        });
    }

    // unsubscribe(from) {
    //   this.session.debug('received unsubscribe request from ' + from);
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
            context: "xmpp",
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
            context: "xmpp",
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
                if (!Object.hasOwnProperty.call(entries, e)) {
                    continue;
                }
                members.push(entries[e].attrs.name);
            }

            this.session.sendToClient({
                context: "xmpp",
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

    online() {
        this.session.debug("online");
    }

    /**
     * Handles all unknown conditions that we don't have an explicit handler for
     **/
    async stanza(stanza) {
        // console.log("incoming stanza ", stanza);
        if (stanza.attrs.type === "error") {
            this.notifyError(stanza);
        } else if (stanza.is("message")) {
            this.notifyChatMessage(stanza);
        } else if (stanza.is("presence")) {
            // Handle async presence method
            try {
                await this.presence(stanza);
            } catch (error) {
                this.session.debug(
                    `Error handling presence stanza: ${error.message}`,
                );
            }
        } else if (stanza.is("iq")) {
            if (
                stanza.attrs.id === "muc_id" &&
                stanza.attrs.type === "result"
            ) {
                this.session.debug("got room attendance list");
                return this.notifyRoomAttendance(stanza);
            }

            // todo: clean up this area, unsure of what these are
            const query = stanza.getChild("query");
            if (query) {
                const entries = query.getChildren("item");
                for (const e in entries) {
                    if (!entries.hasOwn(e)) {
                        continue;
                    }
                    this.session.debug("STANZA ATTRS: ", entries[e].attrs);
                    if (entries[e].attrs.subscription === "both") {
                        this.session.sendToClient({
                            context: "xmpp",
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
                            context: "xmpp",
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
            this.session.debug(`got XMPP unknown stanza... ${stanza}`);
        }
    }
}
