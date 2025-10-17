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
    timeout = null,
    interval = 100,
) {
    const config = getConfig();
    timeout = timeout ? timeout : config.timeouts.message;
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
    socket,
    actorId,
    userId = null,
    password = null,
    resource = null,
) {
    const config = getConfig();
    
    // Use defaults from config if not provided
    userId = userId ? userId : config.prosody.testUser.username;
    password = password ? password : config.prosody.testUser.password;
    
    // Extract resource from actorId if not provided
    const defaultResource =
        resource ||
        actorId.split("/")[1] ||
        config.prosody.resource;

    return new Promise((resolve, reject) => {
        socket.emit(
            "credentials",
            {
                actor: {
                    id: actorId,
                    type: "person",
                },
                context: "xmpp",
                type: "credentials",
                object: {
                    type: "credentials",
                    password,
                    resource: defaultResource,
                    userAddress: `${userId}@${config.prosody.host}`,
                    // We use xmpp://user@host:port to get around limitations with our prosody docker instance.
                    // - The port is specified explicitly to bypass DNS SRV record lookups that were timing out
                    // - The `xmpp://` URI scheme is specified explicitly to enable a plain-text connection,
                    // avoiding the TLS negotiation issues that were causing connection failures.
                    server: `xmpp://${config.prosody.host}:${config.prosody.port}`,
                },
            },
            (response) => {
                if (response?.error) {
                    reject(
                        new Error(
                            `Credentials failed for ${userId}: ${response.error}`,
                        ),
                    );
                } else {
                    resolve();
                }
            },
        );
    });
}

// Helper function to connect to XMPP
export function connectXMPP(socket, actorId) {
    const userId = actorId.split("@")[0]; // Extract user part for logging
    return new Promise((resolve, reject) => {
        socket.emit(
            "message",
            {
                type: "connect",
                actor: actorId,
                context: "xmpp",
            },
            (msg) => {
                if (msg?.error) {
                    reject(
                        new Error(`Connect failed for ${userId}: ${msg.error}`),
                    );
                } else {
                    resolve(msg);
                }
            },
        );
    });
}

// Helper function to join XMPP room
export function joinXMPPRoom(socket, actorId, roomId) {
    const userId = actorId.split("@")[0];
    return new Promise((resolve, reject) => {
        socket.emit(
            "message",
            {
                type: "join",
                actor: actorId,
                context: "xmpp",
                target: {
                    type: "room",
                    id: roomId,
                },
            },
            (msg) => {
                if (msg?.error) {
                    reject(
                        new Error(`Join failed for ${userId}: ${msg.error}`),
                    );
                } else {
                    resolve(msg);
                }
            },
        );
    });
}

// Helper function to send XMPP message
export function sendXMPPMessage(socket, actorId, roomId, content) {
    const userId = actorId.split("@")[0];
    return new Promise((resolve, reject) => {
        socket.emit(
            "message",
            {
                type: "send",
                actor: actorId,
                context: "xmpp",
                object: {
                    type: "message",
                    content,
                },
                target: {
                    type: "room",
                    id: roomId,
                },
            },
            (msg) => {
                if (msg?.error) {
                    reject(
                        new Error(`Send failed for ${userId}: ${msg.error}`),
                    );
                } else {
                    resolve(msg);
                }
            },
        );
    });
}
