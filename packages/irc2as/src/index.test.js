import { assertEquals } from "jsr:@std/assert";
import schemas from "@sockethub/schemas";
import IRC2AS from "./index.js";
import outputs from "./index.data.test.js";
import fs from "node:fs";
import equal from "npm:fast-deep-equal";

const ircData = fs.readFileSync("./src/index.data.irc.test.txt", "utf-8");
const inputs = ircData.split("\n");

function timeout(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
await timeout(0);

function matchStream() {
    return async (stream) => {
        return new Promise((resolve, reject) => {
            assertEquals(typeof stream.published, "string");
            delete stream.published;
            let matched = false;
            for (let i = 0; i <= outputs.length; i++) {
                matched = equal(stream, outputs[i]);
                if (matched) {
                    // when matched, remove output entry from list
                    outputs.splice(i, 1);
                    break;
                }
            }
            if (!matched) {
                console.log();
                console.log("available matches:" + JSON.stringify(outputs));
                console.log(
                    "failed to find match for: " + JSON.stringify(stream),
                );
                reject(new Error("failed matching " + JSON.stringify(stream)));
            }
            const err = schemas.validateActivityStream(stream);
            if (err) {
                reject(new Error(err + " - " + JSON.stringify(stream)));
            }
            resolve();
        });
    };
}

Deno.test("IRC2AS", async () => {
    const irc2as = new IRC2AS({ server: "localhost" });
    assertEquals(!!irc2as.events, true);
    assertEquals(!!irc2as.input, true);
    assertEquals(typeof irc2as.events.on, "function");

    irc2as.events.on("unprocessed", (string) => {
        console.log("unprocessed> " + string);
    });

    irc2as.events.removeAllListeners();
});

Deno.test("inputs generate expected outputs", async () => {
    const irc2as = new IRC2AS({ server: "localhost" });
    let pongs = 0,
        pings = 0;
    let callbackCalled = false;

    const callback = async (event) => {
        const match = await matchStream();
        callbackCalled = true;
        await match(event);
    };

    irc2as.events.on("incoming", callback);
    irc2as.events.on("error", callback);
    irc2as.events.on("pong", () => {
        pongs++;
    });
    irc2as.events.on("ping", () => {
        pings++;
    });

    for (let i = 0; inputs.length > i; i++) {
        irc2as.input(inputs[i]);
    }

    await timeout(0);
    assertEquals(callbackCalled, true);
    assertEquals(outputs.length, 0);
    assertEquals(pings, 2);
    assertEquals(pongs, 3);

    irc2as.events.removeAllListeners();
});

Deno.test("handle many room joins", async () => {
    const irc2as = new IRC2AS({ server: "localhost" });
    let sentCount = 0;
    let receivedCount = 0;

    irc2as.events.on("incoming", (d) => {
        receivedCount += 1;
    });

    for (let i = 0; i < 5; i++) {
        let names =
            ":hitchcock.freenode.net 353 hyper_slvrbckt @ #kosmos-random :hyper_slvrbckt ";
        for (let n = 0; n < 100; n++) {
            names += ` hal8000${i}${n} botka${i}${n} gregkare${i}${n} raucao${i}${n} galfert${i}${n}`;
        }
        sentCount += 1;
        irc2as.input(names);
    }
    irc2as.input(
        ":hitchcock.freenode.net 366 hyper_slvrbckt #kosmos-random :End of /NAMES list.",
    );

    await timeout(0);
    assertEquals(sentCount, 5);
    assertEquals(receivedCount, 5 * 100 * sentCount + sentCount);

    irc2as.events.removeAllListeners();
});
