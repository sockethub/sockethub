declare function janitorCycle(): void;
declare const janitor: {
    start: typeof janitorCycle;
    alreadyCalled: boolean;
    cycleCount: number;
    reportCount: number;
};
export default janitor;
