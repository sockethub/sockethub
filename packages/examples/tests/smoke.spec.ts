import { expect, test } from "@playwright/test";

test.describe("examples smoke against sockethub --examples", () => {
    test("home page loads", async ({ page }) => {
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Sockethub Examples",
        );
    });

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

        await page.goto("/feeds");
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
});
