export interface IInitObject {
    version: string;
    platforms: Map<string, {
        id: string;
        moduleName: string;
        config: {
            persist?: boolean;
        };
        schemas: {
            credentials?: object;
            messages?: object;
        };
        version: string;
        types: Array<string>;
    }>;
}
declare const init: IInitObject;
export default init;
