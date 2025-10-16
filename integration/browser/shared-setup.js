import { expect } from "@esm-bundle/chai";
import "./../../packages/server/res/sockethub-client.js";
import "./../../packages/server/res/socket.io.js";

export const SH_PORT = 10550;

// Mocha configuration
mocha.bail(true);
mocha.timeout("120s");

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

// Helper function to create a client with message tracking
export function createSockethubClient(clientId = "default") {
    const messageLog = [];
    const socket = io(`http://localhost:${SH_PORT}/`, { path: "/sockethub" });
    const sc = new SockethubClient(socket);

    // Track all incoming messages
    sc.socket.on("message", (msg) => {
        messageLog.push({
            clientId,
            timestamp: Date.now(),
            message: msg,
        });
    });

    return {
        client: sc,
        socket: sc.socket,
        messageLog,
        cleanup: () => {
            if (sc.socket.connected) {
                sc.socket.disconnect();
            }
        },
    };
}

// Helper function to wait for a condition with timeout
export function waitFor(condition, timeout = 5000, interval = 100) {
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
    userId = "jimmy",
    password = "passw0rd",
    resource = null,
) {
    // Extract resource from actorId if not provided
    const defaultResource =
        resource || actorId.split("/")[1] || "SockethubTest";

    return new Promise((resolve, reject) => {
        console.log(`[${userId}] Setting XMPP credentials for ${actorId}`);

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
                    userAddress: `${userId}@prosody`,
                },
            },
            (response) => {
                if (response?.error) {
                    console.error(
                        `[${userId}] Credentials failed:`,
                        response.error,
                    );
                    reject(
                        new Error(
                            `Credentials failed for ${userId}: ${response.error}`,
                        ),
                    );
                } else {
                    console.log(`[${userId}] Credentials set successfully`);
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
        console.log(`[${userId}] Attempting XMPP connection for ${actorId}`);

        const startTime = Date.now();
        socket.emit(
            "message",
            {
                type: "connect",
                actor: actorId,
                context: "xmpp",
            },
            (msg) => {
                const duration = Date.now() - startTime;
                if (msg?.error) {
                    console.error(
                        `[${userId}] XMPP connection failed after ${duration}ms:`,
                        {
                            error: msg.error,
                            fullMessage: msg,
                            socketConnected: socket.connected,
                            socketId: socket.id,
                        },
                    );
                    reject(
                        new Error(`Connect failed for ${userId}: ${msg.error}`),
                    );
                } else {
                    console.log(
                        `[${userId}] XMPP connection successful after ${duration}ms`,
                    );
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
        console.log(`[${userId}] Attempting to join room ${roomId}`);

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
                    console.error(`[${userId}] Room join failed:`, msg.error);
                    reject(
                        new Error(`Join failed for ${userId}: ${msg.error}`),
                    );
                } else {
                    console.log(
                        `[${userId}] Successfully joined room ${roomId}`,
                    );
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
        console.log(
            `[${userId}] Sending message to ${roomId}: ${content.substring(0, 50)}...`,
        );

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
                    console.error(
                        `[${userId}] Message send failed:`,
                        msg.error,
                    );
                    reject(
                        new Error(`Send failed for ${userId}: ${msg.error}`),
                    );
                } else {
                    console.log(`[${userId}] Message sent successfully`);
                    resolve(msg);
                }
            },
        );
    });
}
