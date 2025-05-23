import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import * as sinon from "sinon";

import routes, { basePaths, type IRoutePaths } from "./routes.js";

describe("routes/base", () => {
    afterEach(() => {
        sinon.restore();
    });

    it("can find each of the base files it serves", () => {
        Object.values(basePaths).forEach((fwd: string) => {
            try {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                expect(existsSync(fwd)).toBeTrue();
            } catch (e) {
                throw new Error(`Unable to resolve path ${fwd}`);
            }
        });
    });

    it("adds base routes", () => {
        const app = {
            get: sinon.spy(),
        };
        routes.setup(app);
        sinon.assert.callCount(app.get, Object.keys(basePaths).length);
    });

    it("handles calls to base routes as expected", () => {
        const routeHandlers: any = {};
        const app = {
            get: (path: string | number, route: any) => {
                routeHandlers[path] = route;
            },
        };
        routes.setup(app);

        function verifyPathRoutes(pathMap: IRoutePaths) {
            Object.keys(pathMap).forEach((path) => {
                const res = {
                    setHeader: sinon.spy(),
                    sendFile: sinon.spy(),
                };
                expect(pathMap[path].endsWith(".ejs")).toBeFalse();
                routeHandlers[path]({ url: path }, res);
                sinon.assert.called(res.setHeader);
                sinon.assert.calledWith(res.sendFile, pathMap[path]);
            });
        }
        verifyPathRoutes(basePaths);
    });
});
