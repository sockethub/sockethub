"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const shared_resources_1 = __importDefault(require("./shared-resources"));
describe('SharedResources', () => {
    it('should have a platformInstances Map', () => {
        expect(shared_resources_1.default.platformInstances instanceof Map).toBe(true);
    });
    it('should have a sessionsConnections Map', () => {
        expect(shared_resources_1.default.sessionConnections instanceof Map).toBe(true);
    });
});
//# sourceMappingURL=shared-resources.test.js.map