declare const SharedResources: {
    platformInstances: Map<any, any>;
    sessionConnections: Map<any, any>;
    platformMappings: Map<any, any>;
    helpers: {
        removePlatform: (platformInstance: any) => void;
    };
};
export default SharedResources;
