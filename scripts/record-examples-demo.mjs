/**
 * Records a walkthrough of the Sockethub examples app.
 * Run with: node /tmp/record-examples-demo.mjs
 */
import { chromium } from "playwright";
import { mkdir, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const BASE = process.env.SOCKETHUB_URL || "http://localhost:10550";
const ARTIFACTS = "/opt/cursor/artifacts";
const VIDEO_DIR = path.join(ARTIFACTS, "demo-frames");
const OUTPUT_MP4 = path.join(ARTIFACTS, "examples-demo.mp4");

async function pause(page, ms = 1500) {
    await page.waitForTimeout(ms);
}

async function scrollToBottom(page) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pause(page, 800);
}

async function clickButton(page, name) {
    const btn = page.getByRole("button", { name, exact: false }).first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
}

async function waitForConnected(page) {
    await page.locator("#room").waitFor({ state: "visible", timeout: 45000 });
}

async function confirmActor(page) {
    await clickButton(page, "Confirm actor");
    await pause(page, 1200);
}


async function demoDummy(page) {
    await page.goto(`${BASE}/dummy`);
    await page.waitForLoadState("networkidle");
    await pause(page, 2000);

    await page.getByLabel("Message Content").fill("Hello from the Sockethub examples demo!");
    await pause(page, 800);
    await clickButton(page, "Echo");
    await pause(page, 2500);

    await clickButton(page, "Greet");
    await pause(page, 2500);

    await scrollToBottom(page);
}

async function demoFeeds(page) {
    await page.goto(`${BASE}/feeds`);
    await page.waitForLoadState("networkidle");
    await pause(page, 1500);

    await confirmActor(page);
    await clickButton(page, "Fetch Feed");
    await pause(page, 6000);
    await scrollToBottom(page);
}

async function demoMetadata(page) {
    await page.goto(`${BASE}/metadata`);
    await page.waitForLoadState("networkidle");
    await pause(page, 1500);

    await confirmActor(page);
    await clickButton(page, "Extract Metadata");
    await pause(page, 6000);
    await scrollToBottom(page);
}

async function demoIrc(page) {
    await page.goto(`${BASE}/irc`);
    await page.waitForLoadState("networkidle");
    await pause(page, 1500);

    const nick = `demo${Date.now().toString(36).slice(-5)}`;
    await page.locator("#actor-id-input").fill(nick);
    await pause(page, 500);
    await confirmActor(page);

    await page.getByLabel("IRC Server").fill("localhost");
    await page.locator("#port").fill("6667");
    await pause(page, 500);

    const creds = page.locator("#json-object-Credentials");
    await creds.fill(
        JSON.stringify(
            {
                type: "credentials",
                nick,
                server: "localhost",
                port: 6667,
                secure: false,
                sasl: false,
            },
            null,
            3,
        ),
    );
    await pause(page, 500);

    await clickButton(page, "Set Credentials");
    await pause(page, 2500);
    await page.getByRole("button", { name: /^Connect$/ }).click();
    await waitForConnected(page);
    await pause(page, 1500);

    await page.locator("#room").fill("#sockethub-test");
    await pause(page, 500);
    await clickButton(page, "Join Room");
    await pause(page, 3000);

    await page.locator("#sendMessage").fill("Hello IRC from Sockethub examples!");
    await clickButton(page, "Send");
    await pause(page, 4000);
    await scrollToBottom(page);
}

async function demoXmpp(page) {
    await page.goto(`${BASE}/xmpp`);
    await page.waitForLoadState("networkidle");
    await pause(page, 1500);

    await page.locator("#actor-id-input").fill("jimmy@localhost");
    await page.locator("#xmpp-password-input").fill("passw0rd");
    await pause(page, 500);
    await confirmActor(page);

    const creds = page.locator("#json-object-Credentials");
    const credObj = {
        type: "credentials",
        userAddress: "jimmy@localhost",
        resource: "SockethubExample",
        password: "passw0rd",
        server: "xmpp://localhost:5222",
    };
    await creds.fill(JSON.stringify(credObj, null, 3));
    await pause(page, 500);

    await clickButton(page, "Set Credentials");
    await pause(page, 2500);
    await page.getByRole("button", { name: /^Connect$/ }).click();
    await waitForConnected(page);
    await pause(page, 1500);

    await page.locator("#room").fill("testroom@conference.prosody");
    await pause(page, 500);
    await clickButton(page, "Join Room");
    await pause(page, 3000);

    await page.locator("#sendMessage").fill("Hello XMPP from Sockethub examples!");
    await clickButton(page, "Send");
    await pause(page, 4000);
    await scrollToBottom(page);
}

async function demoHome(page) {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState("networkidle");
    await pause(page, 2500);
    await scrollToBottom(page);
    await pause(page, 1500);
}

async function convertWebmToMp4(webmPath, mp4Path) {
    await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        webmPath,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        mp4Path,
    ]);
}

async function main() {
    await mkdir(ARTIFACTS, { recursive: true });
    await mkdir(VIDEO_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
        recordVideo: {
            dir: VIDEO_DIR,
            size: { width: 1400, height: 900 },
        },
    });
    const page = await context.newPage();

    console.log("Recording Sockethub examples demo…");

  let recordError;
  try {
    await demoHome(page);
    await demoDummy(page);
    await demoFeeds(page);
    await demoMetadata(page);
    await demoIrc(page);
    await demoXmpp(page);

    await page.goto(`${BASE}/`);
    await pause(page, 2000);
  } catch (err) {
    recordError = err;
  } finally {
        const video = page.video();
        await context.close();
        await browser.close();

        if (video) {
            const webmPath = await video.path();
            console.log(`Raw recording: ${webmPath}`);
            await convertWebmToMp4(webmPath, OUTPUT_MP4);
            console.log(`MP4 saved: ${OUTPUT_MP4}`);
        } else {
            const files = await readdir(VIDEO_DIR);
            const webm = files.find((f) => f.endsWith(".webm"));
            if (webm) {
                const webmPath = path.join(VIDEO_DIR, webm);
                await convertWebmToMp4(webmPath, OUTPUT_MP4);
                console.log(`MP4 saved: ${OUTPUT_MP4}`);
            }
        }
    }

    if (recordError) {
        throw recordError;
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
