import { expect } from "@esm-bundle/chai";

// The client and socket.io are loaded as globals from the running server by the
// test runner's HTML. This suite runs with `--csp`, so the page's Content
// Security Policy blocks `new Function`/`eval`: if the client still needed Ajv
// code generation it would throw while loading, before any test runs.
const config = window.TEST_CONFIG;

/** Emit a socket.io event and resolve with its acknowledgement response. */
function emitWithAck(socket, event, message) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`timed out waiting for ${event}`)),
            10000,
        );
        socket.emit(event, message, (response) => {
            clearTimeout(timer);
            resolve(response);
        });
    });
}

describe(`Sockethub client under CSP at ${config.sockethub.url}`, () => {
    it("loads the client script without throwing", () => {
        expect(typeof SockethubClient).to.equal("function");
        expect(typeof io).to.equal("function");
    });

    it("connects, becomes ready and composes contexts", async () => {
        const sc = new SockethubClient(
            io(config.sockethub.url, { path: "/sockethub" }),
        );
        try {
            const info = await sc.ready();
            expect(info.platforms.length).to.be.greaterThan(0);
            expect(sc.contextFor("dummy").length).to.equal(3);
        } finally {
            sc.socket.disconnect();
        }
    });

    it("sends a dummy echo", async () => {
        const sc = new SockethubClient(
            io(config.sockethub.url, { path: "/sockethub" }),
        );
        try {
            await sc.ready();
            const response = await emitWithAck(sc.socket, "message", {
                type: "echo",
                actor: { id: "csp@dummy", type: "person", name: "CSP" },
                "@context": sc.contextFor("dummy"),
                object: { type: "message", content: "hello from csp" },
            });
            expect(response?.error).to.equal(undefined);
        } finally {
            sc.socket.disconnect();
        }
    });
});
