import { expect } from "@esm-bundle/chai";
import createTestUtils from "../utils.js";
import "../../packages/server/res/sockethub-client.js";
import "../../packages/server/res/socket.io.js";

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
    interval = 100,
) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(
                    new Error(
                        `Timeout waiting for condition after ${timeout}ms`,
                    ),
                );
            } else {
                setTimeout(check, interval);
            }
        };
        check();
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
    return new Promise((resolve, reject) => {
        const creds = {
            actor: jid,
            context: "xmpp",
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
        sh.socket.emit("credentials", creds, (response) => {
            if (response?.error) {
                reject(
                    new Error(
                        `Credentials failed for ${jid}: ${response.error}`,
                    ),
                );
            } else {
                resolve();
            }
        });
    });
}

// Helper function to connect to XMPP
export function connectXMPP(sh, jid) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("XMPP connect timeout after 10 seconds"));
        }, 10000);
        
        sh.socket.emit(
            "message",
            {
                type: "connect",
                actor: jid,
                context: "xmpp",
            },
            (msg) => {
                clearTimeout(timeout);
                if (msg?.error) {
                    reject(
                        new Error(`Connect failed for ${jid}: ${msg.error}`),
                    );
                } else {
                    resolve(msg);
                }
            },
        );
    });
}

// Helper function to join XMPP room
export function joinXMPPRoom(sh, jid, room = config.prosody.room) {
    return new Promise((resolve, reject) => {
        sh.socket.emit(
            "message",
            {
                type: "join",
                actor: jid,
                context: "xmpp",
                target: {
                    type: "room",
                    id: room,
                },
            },
            (msg) => {
                if (msg?.error) {
                    reject(new Error(`Join failed for ${jid}: ${msg.error}`));
                } else {
                    resolve(msg);
                }
            },
        );
    });
}

// Helper function to send XMPP message
export function sendXMPPMessage(sh, jid, room, content) {
    return new Promise((resolve, reject) => {
        sh.socket.emit(
            "message",
            {
                type: "send",
                actor: jid,
                context: "xmpp",
                object: {
                    type: "message",
                    content,
                },
                target: {
                    type: "room",
                    id: room,
                },
            },
            (msg) => {
                if (msg?.error) {
                    reject(new Error(`Send failed for ${jid}: ${msg.error}`));
                } else {
                    resolve(msg);
                }
            },
        );
    });
}
