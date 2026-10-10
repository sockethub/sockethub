import { beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import equal from "fast-deep-equal";

import { IrcToActivityStreams } from "./index.js";
import { TestData } from "./index.test.data.js";
const ircdata = readFileSync(__dirname + "/index.test.data.irc.txt", "utf-8");
const inputs = ircdata.split("\n");
const IRC_CONTEXTS = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
];

// `remaining` is a per-test copy of the expected outputs; matched entries are
// removed from it (never from the shared TestData export, which other test
// files import). Schema validation of irc2as output lives in platform-irc's
// responses-schema test (the correct outbound validator), not here.
function matchStream(remaining, done) {
    return (stream) => {
        expect(typeof stream.published).toEqual("string");
        delete stream.published;
        let matched = false;
        for (let i = 0; i < remaining.length; i++) {
            matched = equal(stream, remaining[i]);
            if (matched) {
                // when matched, remove output entry from list
                remaining.splice(i, 1);
                break;
            }
        }
        if (!matched) {
            console.log();
            console.log("available matches:" + JSON.stringify(remaining));
            console.log("failed to find match for: " + JSON.stringify(stream));
            return done(new Error("failed matching " + JSON.stringify(stream)));
        }
    };
}

describe("IrcToActivityStreams", () => {
    let irc2as,
        pongs = 0,
        pings = 0;
    beforeEach(() => {
        irc2as = new IrcToActivityStreams({
            server: "localhost",
            contexts: IRC_CONTEXTS,
        });
        expect(irc2as).toHaveProperty("events");
        expect(typeof irc2as.events.on).toEqual("function");
        irc2as.events.on("unprocessed", (string) => {
            console.log("unprocessed> " + string);
        });
        irc2as.events.on("pong", () => {
            pongs++;
        });
        irc2as.events.on("ping", () => {
            pings++;
        });
    });

    describe("inputs generate expected outputs", () => {
        it("inputs generate expected outputs", (done) => {
            const remaining = [...TestData];
            irc2as.events.on("incoming", matchStream(remaining, done));
            irc2as.events.on("error", matchStream(remaining, done));
            for (let i = 0; inputs.length > i; i++) {
                irc2as.input(inputs[i]);
            }
            setTimeout(() => {
                expect(remaining.length).toEqual(0);
                done();
            }, 0);
        });
        it("ping and pong count", () => {
            expect(pings).toEqual(2);
            expect(pongs).toEqual(3);
        });
    });

    describe("handle many room joins", () => {
        it("send join messages", (done) => {
            // 5 NAMES lines of 1 + 500 nicks each, one attendance message.
            irc2as.events.on("incoming", (stream) => {
                expect(stream.type).toEqual("query");
                expect(stream.object.members.length).toEqual(5 * 501);
                done();
            });
            for (let i = 0; i < 5; i++) {
                let names =
                    ":hitchcock.freenode.net 353 hyper_slvrbckt @ #kosmos-random :hyper_slvrbckt ";
                for (let n = 0; n < 100; n++) {
                    names += ` gregkare${i}${n} hal8000${i}${n} botka${i}${n} raucao${i}${n} galfert${i}${n}`;
                }
                irc2as.input(names);
            }
            irc2as.input(
                ":hitchcock.freenode.net 366 hyper_slvrbckt #kosmos-random :End of /NAMES list.",
            );
        });
    });

    it("preserves multiple channel sigils in room ids", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.target).toEqual({
                type: "room",
                id: "##private@localhost",
                name: "##private",
            });
            done();
        });
        irc2as.input(":alice!user@example.test PRIVMSG ##private :hello");
    });

    // Modern servers send bare CTCP framing; the "+"/"-" prefix only appears
    // with the legacy identify-msg capability.
    for (const [label, prefix] of [
        ["bare", ""],
        ["identify-msg +", "+"],
        ["identify-msg -", "-"],
    ]) {
        it(`parses ${label} CTCP ACTION as a "me" object`, (done) => {
            irc2as.events.on("incoming", (stream) => {
                expect(stream.object).toEqual({
                    type: "me",
                    content: "waves hello",
                });
                done();
            });
            irc2as.input(
                `:alice!user@example.test PRIVMSG #room :${prefix}\u0001ACTION waves hello\u0001`,
            );
        });
    }

    // Servers truncate over-long lines, which can drop the closing delimiter.
    it("parses a CTCP ACTION missing its closing delimiter", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.object).toEqual({
                type: "me",
                content: "waves hello",
            });
            done();
        });
        irc2as.input(
            ":alice!user@example.test PRIVMSG #room :\u0001ACTION waves hello",
        );
    });

    // A non-ACTION CTCP request is aimed at the client software, not the
    // user. Delivering it as a message leaks \u0001 framing to the client
    // and opens a phantom conversation with the sender (#551).
    it("emits a CTCP VERSION request on `ctcp` instead of `incoming`", (done) => {
        irc2as.events.on("incoming", () => {
            done(new Error("CTCP request was delivered as a message"));
        });
        irc2as.events.on("ctcp", (ctcp) => {
            expect(ctcp).toEqual({
                kind: "request",
                command: "VERSION",
                args: "",
                from: "alice",
                target: "hyper_slvrbckt",
            });
            done();
        });
        irc2as.input(
            ":alice!user@example.test PRIVMSG hyper_slvrbckt :\u0001VERSION\u0001",
        );
    });

    it("carries the CTCP argument and tolerates the identify-msg prefix", (done) => {
        irc2as.events.on("ctcp", (ctcp) => {
            expect(ctcp).toEqual({
                kind: "request",
                command: "PING",
                args: "1234567890",
                from: "alice",
                target: "hyper_slvrbckt",
            });
            done();
        });
        irc2as.input(
            ":alice!user@example.test PRIVMSG hyper_slvrbckt :+\u0001ping 1234567890\u0001",
        );
    });

    it("emits a CTCP reply carried in a NOTICE on `ctcp` instead of `incoming`", (done) => {
        irc2as.events.on("incoming", () => {
            done(new Error("CTCP reply was delivered as a message"));
        });
        irc2as.events.on("ctcp", (ctcp) => {
            expect(ctcp).toEqual({
                kind: "reply",
                command: "VERSION",
                args: "WeeChat 4.1.0",
                from: "alice",
                target: "hyper_slvrbckt",
            });
            done();
        });
        irc2as.input(
            ":alice!user@example.test NOTICE hyper_slvrbckt :\u0001VERSION WeeChat 4.1.0\u0001",
        );
    });

    it("still delivers a plain NOTICE as a service message", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.actor).toEqual({ type: "service", id: "localhost" });
            expect(stream.object).toEqual({
                type: "message",
                content: "*** Looking up your hostname...",
            });
            done();
        });
        irc2as.input(
            ":irc.example.test NOTICE * :*** Looking up your hostname...",
        );
    });

    it("leaves a plain message starting with + untouched", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.object).toEqual({
                type: "message",
                content: "+1 to that",
            });
            done();
        });
        irc2as.input(":alice!user@example.test PRIVMSG #room :+1 to that");
    });

    // RFC 1459 allows the final parameter to omit its colon when it has no
    // spaces. Ergo serializes one-word messages and nick changes that way.
    it("keeps a one-word PRIVMSG that omits the trailing colon", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.object).toEqual({
                type: "message",
                content: "hi",
            });
            expect(stream.target).toEqual({
                type: "room",
                id: "#room@localhost",
                name: "#room",
            });
            done();
        });
        irc2as.input(":alice!user@example.test PRIVMSG #room hi");
    });

    it("keeps a trailing parameter that itself contains space-colon", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.object).toEqual({
                type: "message",
                content: "see :this",
            });
            done();
        });
        irc2as.input(":alice!user@example.test PRIVMSG #room :see :this");
    });

    it("reports nick-change rejections that are not RFC 433", (done) => {
        const seen = [];
        irc2as.events.on("error", (stream) => {
            seen.push([stream.actor.id, stream.error]);
        });
        irc2as.events.on("unprocessed", () => {
            done(new Error("nick rejection was left unprocessed"));
        });
        irc2as.input(
            ":irc.example.net 438 alice bob :Nick change too fast. Please wait 29 seconds.",
        );
        irc2as.input(
            ":irc.example.net 436 alice bob :Nickname collision KILL",
        );
        irc2as.input(":irc.example.net 431 alice :No nickname given");
        irc2as.input(":irc.example.net 431 alice NoNick");
        expect(seen).toEqual([
            ["bob@localhost", "Nick change too fast. Please wait 29 seconds."],
            ["bob@localhost", "Nickname collision KILL"],
            ["alice@localhost", "No nickname given"],
            ["alice@localhost", "NoNick"],
        ]);
        done();
    });

    it("reads a nick change that omits the trailing colon", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.actor).toEqual({
                type: "person",
                id: "alice@localhost",
                name: "alice",
            });
            expect(stream.target).toEqual({
                type: "person",
                id: "bob@localhost",
                name: "bob",
            });
            expect(stream.object).toEqual({ type: "address" });
            done();
        });
        irc2as.input(":alice!user@example.test NICK bob");
    });

    it("parses a single-nick RPL_NAMREPLY that omits the trailing colon", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.object).toEqual({
                type: "attendance",
                members: ["onlynick"],
            });
            expect(stream.actor).toEqual({
                type: "room",
                id: "#room@localhost",
                name: "#room",
            });
            expect(stream.target).toEqual({
                type: "person",
                id: "alice@localhost",
                name: "alice",
            });
            done();
        });
        irc2as.input(":irc.example.net 353 alice @ #room onlynick");
        irc2as.input(":irc.example.net 366 alice #room :End of /NAMES list.");
    });

    // RFC 2812 prefixes voiced users with "+". UnrealIRCd and InspIRCd also
    // send "~", "&", "%", and "!". Leaving the prefix in place makes the nick
    // not match joins, parts, or messages from that user.
    it("strips channel status prefixes from attendance members", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.object).toEqual({
                type: "attendance",
                members: [
                    "alice",
                    "op",
                    "voice",
                    "halfop",
                    "founder",
                    "admin",
                    "oper",
                ],
            });
            done();
        });
        irc2as.input(
            ":irc.example.net 353 me = #room :alice @op +voice %halfop ~founder &admin !oper",
        );
        irc2as.input(":irc.example.net 366 me #room :End of /NAMES list.");
    });

    it("strips every leading status prefix from one nick", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.object.members).toEqual(["alice"]);
            done();
        });
        irc2as.input(":irc.example.net 353 me = #room :@+alice");
        irc2as.input(":irc.example.net 366 me #room :End of /NAMES list.");
    });

    // UnrealIRCd sends this form unless the client negotiated extended-join.
    it("reads a JOIN whose channel is the trailing parameter", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.type).toEqual("join");
            expect(stream.actor).toEqual({
                type: "person",
                id: "alice@localhost",
                name: "alice",
            });
            expect(stream.target).toEqual({
                type: "room",
                id: "#room@localhost",
                name: "#room",
            });
            done();
        });
        irc2as.input(":alice!user@example.test JOIN :#room");
    });

    it("keeps a positional JOIN channel when the realname is trailing", (done) => {
        irc2as.events.on("incoming", (stream) => {
            expect(stream.target).toEqual({
                type: "room",
                id: "#room@localhost",
                name: "#room",
            });
            done();
        });
        irc2as.input(
            ":alice!user@example.test JOIN #room account :#not-the-channel",
        );
    });
});
