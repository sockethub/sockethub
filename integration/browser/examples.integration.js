import { expect } from "@esm-bundle/chai";
import { getConfig } from "./shared-setup.js";

const config = getConfig();

describe(`Examples Page Integration Tests at ${config.sockethub.url}`, () => {
    describe("Examples Page Loading", () => {
        it("can reach sockethub HTTP server", async () => {
            // Test that we can access the sockethub client JS file (always available)
            const response = await fetch(
                `${config.sockethub.url}/sockethub-client.js`,
            );
            expect(response.ok).to.be.true;
            expect(response.status).to.equal(200);
        });

        it("loads the main examples page", async () => {
            const response = await fetch(`${config.sockethub.url}/`);
            expect(response.ok).to.be.true;
            expect(response.status).to.equal(200);
            const html = await response.text();

            // Verify the page is HTML
            expect(html).to.include("<!doctype html>");
            expect(html).to.include("<html");
        });

        it("includes required scripts in main page", async () => {
            const response = await fetch(`${config.sockethub.url}/`);
            const html = await response.text();

            // Check for SvelteKit app scripts
            expect(html).to.include("/_app/immutable/entry/start");
            expect(html).to.include("/_app/immutable/entry/app");
        });

        it("loads the dummy platform example page", async () => {
            const response = await fetch(`${config.sockethub.url}/dummy`);
            expect(response.ok).to.be.true;
            expect(response.status).to.equal(200);
            const html = await response.text();
            expect(html).to.include("<!doctype html>");
        });

        it("loads the feeds platform example page", async () => {
            const response = await fetch(`${config.sockethub.url}/feeds`);
            expect(response.ok).to.be.true;
            expect(response.status).to.equal(200);
            const html = await response.text();
            expect(html).to.include("<!doctype html>");
        });

        it("loads the IRC platform example page", async () => {
            const response = await fetch(`${config.sockethub.url}/irc`);
            expect(response.ok).to.be.true;
            expect(response.status).to.equal(200);
            const html = await response.text();
            expect(html).to.include("<!doctype html>");
        });

        it("loads the XMPP platform example page", async () => {
            const response = await fetch(`${config.sockethub.url}/xmpp`);
            expect(response.ok).to.be.true;
            expect(response.status).to.equal(200);
            const html = await response.text();
            expect(html).to.include("<!doctype html>");
        });

        it("loads the metadata platform example page", async () => {
            const response = await fetch(`${config.sockethub.url}/metadata`);
            expect(response.ok).to.be.true;
            expect(response.status).to.equal(200);
            const html = await response.text();
            expect(html).to.include("<!doctype html>");
        });
    });

    describe("Static Assets", () => {
        it("loads the Sockethub logo", async () => {
            const response = await fetch(
                `${config.sockethub.url}/sockethub-logo.svg`,
            );
            expect(response.ok).to.be.true;
            expect(response.headers.get("content-type")).to.include("svg");
        });

        it("loads SvelteKit app entry point", async () => {
            const response = await fetch(`${config.sockethub.url}/`);
            const html = await response.text();

            // Extract the app.js script path from HTML
            const appScriptMatch = html.match(
                /\/_app\/immutable\/entry\/app\.[^"]+\.js/,
            );
            expect(appScriptMatch).to.not.be.null;

            if (appScriptMatch) {
                const appScriptPath = appScriptMatch[0];
                const appResponse = await fetch(
                    `${config.sockethub.url}${appScriptPath}`,
                );
                expect(appResponse.ok).to.be.true;
                expect(appResponse.headers.get("content-type")).to.include(
                    "javascript",
                );
            }
        });
    });

    describe("Config File", () => {
        it("serves config.json with sockethub configuration", async () => {
            const response = await fetch(`${config.sockethub.url}/config.json`);
            expect(response.ok).to.be.true;
            const configData = await response.json();

            // Verify config structure
            expect(configData).to.have.property("sockethub");
            expect(configData.sockethub).to.have.property("host");
            expect(configData.sockethub).to.have.property("port");
            expect(configData.sockethub.port).to.equal(config.sockethub.port);
        });
    });
});
