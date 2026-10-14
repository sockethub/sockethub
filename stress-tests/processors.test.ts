import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type Payload = {
    type: string;
    actor: { id: string; name?: string };
    object?: { resource?: string };
    target?: { id: string };
};
type Processor = (
    context: { vars: Record<string, unknown> },
    events: { emit: (...args: unknown[]) => void },
    done: (error?: Error) => void,
) => void;

function processor(environment: Record<string, string> = {}) {
    const module = { exports: {} as Record<string, Processor> };
    runInNewContext(
        readFileSync(
            new URL(
                "./artillery/processors/sockethub-client.js",
                import.meta.url,
            ),
            "utf8",
        ),
        {
            module,
            require: () => ({}),
            process: { env: environment },
            Date,
            setTimeout,
            clearTimeout,
            console,
        },
    );
    return module.exports;
}

function execute(
    fn: Processor,
    vars: Record<string, unknown>,
    emit: (...args: unknown[]) => void = () => {},
) {
    return new Promise<Error | undefined>((resolve) =>
        fn({ vars }, { emit }, resolve),
    );
}

describe("Artillery processors", () => {
    it("sets credentials, connects, and joins with distinct resources and nicknames", async () => {
        const calls: [string, Payload][] = [];
        const vars: Record<string, unknown> = {
            $uuid: "one",
            errors: [],
            client: {
                socket: {
                    emit: (
                        event: string,
                        payload: Payload,
                        ack: (response: object) => void,
                    ) => {
                        calls.push([event, payload]);
                        ack({});
                    },
                },
            },
        };
        const setup = processor({
            XMPP_USER: "benchmark@example.test",
            XMPP_PASSWORD: "test-fixture-password",
        }).setupXMPP;
        expect(await execute(setup, vars)).toBeUndefined();
        expect(calls.map(([event, payload]) => [event, payload.type])).toEqual([
            ["credentials", "credentials"],
            ["message", "connect"],
            ["message", "join"],
        ]);
        expect(calls[0][1].object?.resource).toBe("stress-one");
        expect(calls[2][1].actor.name).toBe("stress-one");
        vars.$uuid = "two";
        expect(await execute(setup, vars)).toBeUndefined();
        expect(calls[3][1].actor.id).not.toBe(calls[0][1].actor.id);
    });
    it("stops after a rejected XMPP setup and disconnects without exposing credentials", async () => {
        let disconnected = false;
        let calls = 0;
        const vars = {
            $uuid: "one",
            errors: [],
            client: {
                socket: {
                    emit: (
                        _event: string,
                        _payload: Payload,
                        ack: (response: object) => void,
                    ) => {
                        calls++;
                        ack({ error: "sensitive detail" });
                    },
                    disconnect: () => {
                        disconnected = true;
                    },
                },
            },
        };
        const error = await execute(
            processor({
                XMPP_USER: "benchmark@example.test",
                XMPP_PASSWORD: "test-fixture-password",
            }).setupXMPP,
            vars,
        );
        expect(error?.message).toBe("XMPP setup failed; check server logs");
        expect(calls).toBe(1);
        expect(disconnected).toBe(true);
    });
    it("requires explicit XMPP credentials", async () => {
        expect((await execute(processor().setupXMPP, {}))?.message).toContain(
            "required",
        );
    });
    it("does not record rejected acknowledgements as successful latency samples", async () => {
        const metrics: unknown[][] = [];
        const vars = {
            connected: true,
            schemasReady: true,
            actorId: "test",
            errors: [],
            client: {
                socket: {
                    emit: (
                        _event: string,
                        _payload: Payload,
                        ack: (response: object) => void,
                    ) => ack({ error: "rejected" }),
                },
            },
        };
        await execute(processor().sendDummyEcho, vars, (...args) =>
            metrics.push(args),
        );
        expect(metrics.map((entry) => entry[1])).toEqual([
            "sockethub.attempt.echo",
            "sockethub.error.echo",
        ]);
    });
    it("uses the fixture URL as the feed actor", async () => {
        let message: Payload | undefined;
        const vars = {
            connected: true,
            schemasReady: true,
            errors: [],
            client: {
                socket: {
                    emit: (
                        _event: string,
                        payload: Payload,
                        ack: (response: object) => void,
                    ) => {
                        message = payload;
                        ack({});
                    },
                    disconnect: () => {},
                },
            },
        };
        await execute(
            processor({ FEED_URL: "https://fixture.example.test/feed.xml" })
                .sendFeedMessage,
            vars,
        );
        expect(message?.actor.id).toBe("https://fixture.example.test/feed.xml");
        expect(message?.object).toBeUndefined();
        expect(
            (await execute(processor().sendFeedMessage, vars))?.message,
        ).toContain("FEED_URL");
    });
});
