import SharedResources from "./shared-resources";

describe('SharedResources', () => {
  it('should have a platformInstances Map', () => {
    expect(SharedResources.platformInstances instanceof Map).toBe(true);
  });
  it('should have a sessionsConnections Map', () => {
    expect(SharedResources.sessionConnections instanceof Map).toBe(true);
  });
});