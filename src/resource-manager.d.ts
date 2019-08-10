declare function resourceManagerCycle(): void;
declare const ResourceManager: {
    start: typeof resourceManagerCycle;
    alreadyCalled: boolean;
    cycleCount: number;
    reportCount: number;
};
export default ResourceManager;
