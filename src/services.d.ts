declare const services: {
    startQueue: (parentId: any) => any;
    startExternal: () => any;
    __startKue: () => void;
    __startListener: (http: any) => void;
    __initExpress: () => any;
};
export default services;
