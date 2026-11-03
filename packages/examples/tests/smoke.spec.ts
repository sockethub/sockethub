import { expect, test } from "@playwright/test";

test.describe("examples smoke against sockethub --examples", () => {
    test("root URL serves the server info page linking to the examples", async ({
        page,
    }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "Sockethub",
        );
        await page.getByRole("link", { name: "open the examples" }).click();
        await expect(page).toHaveURL(/\/examples$/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Sockethub Examples",
        );
    });

    test("home page loads", async ({ page }) => {
        await page.goto("/examples");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Sockethub Examples",
        );
    });

    for (const platform of ["messenger", "instagram"] as const) {
        test(`${platform} credentials and reply controls`, async ({ page }) => {
            await page.goto(`/examples/${platform}`);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                `${platform === "messenger" ? "Messenger" : "Instagram"} Platform Example`,
            );
            const send = page.getByRole("button", { name: "Send Message" });
            const setCredentials = page.getByRole("button", {
                name: "Set Credentials",
            });
            await expect(send).toBeDisabled();
            await page
                .getByLabel(
                    platform === "messenger"
                        ? "Facebook Page ID"
                        : "Instagram account ID",
                )
                .fill("123");
            await page
                .getByLabel("Access token")
                .fill("test-token-not-sent-to-meta");
            await expect(page.getByLabel("Access token")).toHaveAttribute(
                "type",
                "password",
            );
            await page.getByLabel("Graph API version").fill("invalid");
            await expect(setCredentials).toBeDisabled();
            await page.getByLabel("Graph API version").fill("v22.0");
            await expect(setCredentials).toBeEnabled();
            await setCredentials.click();
            await expect(page.getByRole("status")).toContainText(
                "Credentials set for this session",
            );
            await page
                .getByLabel(
                    platform === "messenger"
                        ? "Recipient Page-scoped ID (PSID)"
                        : "Recipient Instagram-scoped ID (IGSID)",
                )
                .fill("456");
            await page.getByLabel("Message", { exact: true }).fill("Hello");
            await expect(send).toBeEnabled();
            await page
                .getByLabel("Message", { exact: true })
                .fill("x".repeat(platform === "messenger" ? 2001 : 1001));
            await expect(send).toBeDisabled();
            await page.getByLabel("Message", { exact: true }).fill("Hello");
            const humanAgent = page.getByRole("checkbox", {
                name: "Human Agent reply",
            });
            await expect(humanAgent).not.toBeChecked();
            await humanAgent.check();
            await page.getByLabel("Access token").fill("changed-token");
            await expect(send).toBeDisabled();
            await expect(humanAgent).not.toBeChecked();
            await expect(setCredentials).toBeEnabled();
            await page
                .getByRole("button", { name: "Clear Credentials" })
                .click();
            await expect(page.getByLabel("Access token")).toHaveValue("");
            await expect(
                page.getByLabel("Message", { exact: true }),
            ).toHaveValue("");
            await expect(setCredentials).toBeDisabled();
        });
    }

    test("feeds page fetches local feed.xml without runtime errors", async ({
        page,
    }) => {
        const consoleErrors: string[] = [];
        page.on("pageerror", (error) => {
            consoleErrors.push(error.message);
        });
        page.on("console", (message) => {
            if (message.type() === "error") {
                consoleErrors.push(message.text());
            }
        });

        await page.goto("/examples/feeds");
        // Use a separate local fixture server to avoid Sockethub deadlocking when
        // the feeds platform fetches from the same HTTP port as the examples app.
        await page
            .getByLabel("Feed URL")
            .fill("http://localhost:10551/feed.xml");

        await page.getByRole("button", { name: "Confirm actor" }).click();

        const fetchButton = page.getByRole("button", { name: "Fetch Feed" });
        await expect(fetchButton).toBeEnabled({ timeout: 30_000 });
        await fetchButton.click();

        // The examples logger renders individual feed items (not the collection
        // summary line) when Sockethub returns a feeds collection.
        await expect(
            page.getByRole("link", { name: "Sockethub 4.1.0" }),
        ).toBeVisible({ timeout: 30_000 });
        await expect(
            page.getByText("Sent → Response OK").first(),
        ).toBeVisible();

        const relevantErrors = consoleErrors.filter(
            (message) =>
                !message.includes("favicon") &&
                !message.includes("Failed to load resource"),
        );
        expect(relevantErrors).toEqual([]);
    });

    test("caldav page exposes the simple create flow", async ({ page }) => {
        await page.goto("/examples/caldav");
        await expect(
            page.getByRole("heading", { name: "CalDAV Platform Example" }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Fetch Calendars" }),
        ).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "Add Event" }),
        ).toBeDisabled();

        await page
            .getByLabel("CalDAV URL")
            .fill("https://calendar.example/dav/");
        await page.getByLabel("Username").fill("alice");
        await page.getByLabel("Password").fill("app-password");
        await page.getByRole("button", { name: "Set Credentials" }).click();
        await expect(
            page.getByRole("button", { name: "Credentials Set" }),
        ).toBeDisabled();

        await page.getByLabel("Username").fill("alice-changed");
        await expect(
            page.getByRole("button", { name: "Set Credentials" }),
        ).toBeEnabled();
    });

    test("carddav page exposes the address-book and contact flows", async ({
        page,
    }) => {
        await page.goto("/examples/carddav");
        await expect(
            page.getByRole("heading", { name: "CardDAV Platform Example" }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Fetch Address Books" }),
        ).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "List Contacts" }),
        ).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "Add Contact" }),
        ).toBeDisabled();
        await page.getByLabel("Search text (optional)").fill("Bob");
        await expect(
            page.getByRole("button", { name: "Search Contacts" }),
        ).toBeDisabled();

        await page
            .getByLabel("CardDAV URL")
            .fill("https://contacts.example/dav/");
        await page.getByLabel("Username").fill("alice");
        await page.getByLabel("Password").fill("app-password");
        await page.getByRole("button", { name: "Set Credentials" }).click();
        await expect(
            page.getByRole("button", { name: "Credentials Set" }),
        ).toBeDisabled();

        await page.getByLabel("Username").fill("alice-changed");
        await expect(
            page.getByRole("button", { name: "Set Credentials" }),
        ).toBeEnabled();
    });
});
