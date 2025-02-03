import {expect, describe, it, beforeEach} from "bun:test";
import { validateActivityStream } from "@sockethub/schemas";
import {readFileSync} from "fs";
import equal from "fast-deep-equal";

import { IrcToActivityStreams } from "./index.js";
import { TestData } from "./index.test.data.js";
const ircdata = readFileSync(__dirname + "/index.test.data.irc.txt", "utf-8");
const inputs = ircdata.split("\n");

function matchStream(done) {
    return (stream) => {
        expect(typeof stream.published).toEqual("string");
        delete stream.published;
        let matched = false;
        for (let i = 0; i <= TestData.length; i++) {
            matched = equal(stream, TestData[i]);
            if (matched) {
                // when matched, remove output entry from list
                TestData.splice(i, 1);
                break;
            }
        }
        if (!matched) {
            console.log();
            console.log("available matches:" + JSON.stringify(TestData));
            console.log("failed to find match for: " + JSON.stringify(stream));
            return done(new Error("failed matching " + JSON.stringify(stream)));
        }
        const err = validateActivityStream(stream);
        if (err) {
            return done(new Error(err + " - " + JSON.stringify(stream)));
        }
    };
}

describe("IrcToActivityStreams", () => {
    let irc2as,
        pongs = 0,
        pings = 0;
    beforeEach(() => {
        irc2as = new IrcToActivityStreams({ server: "localhost" });
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
            irc2as.events.on("incoming", matchStream(done));
            irc2as.events.on("error", matchStream(done));
            for (let i = 0; inputs.length > i; i++) {
                irc2as.input(inputs[i]);
            }
            setTimeout(() => {
                expect(TestData.length).toEqual(0);
                done();
            }, 0);
        });
        it("ping and pong count", () => {
            expect(pings).toEqual(2);
            expect(pongs).toEqual(3);
        });
    });

    describe("handle many room joins", () => {
        let totalCount = 0;
        it("send join messages", (done) => {
            irc2as.events.on("incoming", () => {
                totalCount += 1;
                if (totalCount === 5 * 100) {
                    done();
                }
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
});
