import { expect } from "@esm-bundle/chai";

// sockethub-client.js and socket.io.js are loaded via <script> tags
// in the test runner HTML (injected from the running Sockethub server)

// Verify globals are loaded
if (typeof window.io === "undefined") {
    throw new Error("socket.io.js failed to load - window.io is undefined");
}
if (typeof window.SockethubClient === "undefined") {
    throw new Error(
        "sockethub-client.js failed to load - window.SockethubClient is undefined",
    );
}

// Mocha configuration
mocha.bail(true);
mocha.timeout("120s");

/**
 * Get configuration for browser tests
 * @returns {object} Configuration object
 */
export function getConfig() {
    if (typeof window !== "undefined" && window.TEST_CONFIG) {
        return window.TEST_CONFIG;
    }
    throw new Error("TEST_CONFIG not available in browser environment");
}

const config = getConfig();

// Shared setup and validation functions
export function validateGlobals() {
    describe("Global Library Validation", () => {
        it("has global `io`", () => {
            expect(typeof io).to.equal("function");
        });

        it("has global `SockethubClient`", () => {
            expect(typeof SockethubClient).to.equal("function");
        });
    });
}

// Helper function to wait for a condition with timeout
export function waitFor(
    condition,
    timeout = config.timeouts.message,
    interval = 50, // Reduced from 100ms to 50ms for faster condition detection
    debugInfo = null,
) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            try {
                if (condition()) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    const elapsed = Date.now() - startTime;
                    const debugMsg = debugInfo
                        ? ` Debug: ${typeof debugInfo === "function" ? debugInfo() : debugInfo}`
                        : "";
                    reject(
                        new Error(
                            `Timeout waiting for condition after ${elapsed}ms (limit: ${timeout}ms).${debugMsg}`,
                        ),
                    );
                } else {
                    setTimeout(check, interval);
                }
            } catch (error) {
                reject(new Error(`Error checking condition: ${error.message}`));
            }
        };
        check();
    });
}

/**
 * Safely create a string preview of a value for logging.
 *
 * Attempts to JSON.stringify the provided value and truncate the result
 * to the specified character limit. If serialization fails, returns a
 * placeholder string indicating that the value was unserializable.
 *
 * @param {any} value - The value to generate a preview for.
 * @param {number} [limit=1000] - Maximum number of characters to include in the preview.
 * @returns {string} A safe, possibly truncated string representation of the value.
 */
function safePreview(value, limit = 1000) {
    try {
        const raw = JSON.stringify(value);
        if (!raw) {
            return String(value);
        }
        return raw.length > limit ? `${raw.slice(0, limit)}…` : raw;
    } catch (error) {
        return `<<unserializable:${error.message}>>`;
    }
}

export function emitWithAck(
    socket,
    event,
    payload,
    { timeout = config.timeouts.message, label = "" } = {},
) {
    return new Promise((resolve, reject) => {
        const socketId = socket?.id ?? "unknown";
        const labelText = label ? ` (${label})` : "";
        const payloadPreview = safePreview(payload);

        console.log(
            `[browser-test] emit${labelText} event=${event} socket=${socketId} payload=${payloadPreview}`,
        );

        const timer = setTimeout(() => {
            const message = `Timeout waiting for ack after ${timeout}ms for event=${event}${labelText} socket=${socketId} payload=${payloadPreview}`;
            console.error(`[browser-test] ${message}`);
            reject(new Error(message));
        }, timeout);

        socket.emit(event, payload, (...args) => {
            clearTimeout(timer);
            if (args.length > 1) {
                console.log(
                    `[browser-test] ack${labelText} event=${event} socket=${socketId} extraArgs=${args.length - 1}`,
                );
            }
            resolve(args[0]);
        });
    });
}

// Helper function to set XMPP credentials
export function setXMPPCredentials(
    sh,
    jid,
    resource = config.prosody.resource,
    username = config.prosody.testUser.username,
    password = config.prosody.testUser.password,
) {
    const creds = {
        actor: jid,
        "@context": [
            "https://www.w3.org/ns/activitystreams",
            "https://sockethub.org/ns/context/v1.jsonld",
            "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
        ],
        type: "credentials",
        object: {
            type: "credentials",
            password,
            resource: resource,
            userAddress: `${username}@${config.prosody.host}`,
            // We use xmpp://user@host:port to get around limitations with our prosody docker instance.
            // - The port is specified explicitly to bypass DNS SRV record lookups that were timing out
            // - The `xmpp://` URI scheme is specified explicitly to enable a plain-text connection,
            // avoiding the TLS negotiation issues that were causing connection failures.
            server: `xmpp://${config.prosody.host}:${config.prosody.port}`,
        },
    };
    console.log("sending credentials: ", creds);
    return emitWithAck(sh.socket, "credentials", creds, {
        label: "xmpp credentials",
    }).then((response) => {
        if (response?.error) {
            throw new Error(`Credentials failed for ${jid}: ${response.error}`);
        }
    });
}

// Helper function to connect to XMPP
export function connectXMPP(sh, jid) {
    return emitWithAck(
        sh.socket,
        "message",
        {
            type: "connect",
            actor: jid,
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
        },
        {
            timeout: config.timeouts.connect,
            label: "xmpp connect",
        },
    ).then((msg) => {
        if (msg?.error) {
            throw new Error(`Connect failed for ${jid}: ${msg.error}`);
        }
        return msg;
    });
}

// Helper function to join XMPP room
export function joinXMPPRoom(sh, jid, room = config.prosody.room) {
    return emitWithAck(
        sh.socket,
        "message",
        {
            type: "join",
            actor: jid,
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
            target: {
                type: "room",
                id: room,
            },
        },
        { label: "xmpp join" },
    ).then((msg) => {
        if (msg?.error) {
            throw new Error(`Join failed for ${jid}: ${msg.error}`);
        }
        return msg;
    });
}

// Helper function to send XMPP message
export function sendXMPPMessage(sh, jid, room, content) {
    return emitWithAck(
        sh.socket,
        "message",
        {
            type: "send",
            actor: jid,
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                "https://sockethub.org/ns/context/platform/xmpp/v1.jsonld",
            ],
            object: {
                type: "message",
                content,
            },
            target: {
                type: "room",
                id: room,
            },
        },
        { label: "xmpp send" },
    ).then((msg) => {
        if (msg?.error) {
            throw new Error(`Send failed for ${jid}: ${msg.error}`);
        }
        return msg;
    });
}
