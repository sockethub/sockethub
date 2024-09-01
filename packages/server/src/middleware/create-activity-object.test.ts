import createActivityObject from "./create-activity-object.ts";
import type { ActivityStream } from "@sockethub/schemas";

Deno.test("Middleware: createActivityObject - calls activity.Object.create with incoming data", () => {
  return new Promise((resolve) => {
    createActivityObject({ foo: "bar" } as unknown as ActivityStream, () => {
      resolve();
    });
  });
});
