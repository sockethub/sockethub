import { createLogger } from "@sockethub/logger";
import type {
    ActivityObject,
    ActivityStream,
    Logger,
} from "@sockethub/schemas";

export default function middleware<T>(name: string): MiddlewareChain<T> {
    return new MiddlewareChain<T>(name);
}

export type MiddlewareNext<T> = (data?: T | Error) => void;

export type MiddlewareHandler<T> = (data: T, next: MiddlewareNext<T>) => void;
export type MiddlewareErrorHandler<T> = (
    err: Error,
    data: T,
    next: MiddlewareNext<T>,
) => void;

export type LogErrorInterface = (msg: Error) => void;
export type MiddlewareChainInterface<T = ActivityStream | ActivityObject> =
    MiddlewareNext<T>;

export class MiddlewareChain<T> {
    public name: string;
    private chain: Array<MiddlewareHandler<T>> = [];
    private errHandler: MiddlewareErrorHandler<T> = (err: Error) => {
        throw err;
    };
    private readonly logger: Logger;

    constructor(name: string) {
        this.name = name;
        this.logger = createLogger(`server:middleware:${name}`);
    }

    use(func: MiddlewareErrorHandler<T> | MiddlewareHandler<T>): this {
        if (typeof func !== "function") {
            throw new Error(
                "middleware use() can only take a function as an argument",
            );
        }
        if (func.length === 3) {
            this.errHandler = func as MiddlewareErrorHandler<T>;
        } else if (func.length === 2) {
            this.chain.push(func as MiddlewareHandler<T>);
        } else {
            throw new Error(
                `middleware function provided with incorrect number of params: ${func.length}`,
            );
        }
        return this;
    }

    done() {
        return (data: T, callbackFunc: MiddlewareNext<T>) => {
            let cb = callbackFunc as MiddlewareNext<T>;
            let position = 0;
            if (typeof callbackFunc !== "function") {
                cb = () => {
                    // ensure we have a callback function
                };
            }
            const next: MiddlewareNext<T> = (_data) => {
                const nextData = _data === undefined ? data : _data;
                if (nextData instanceof Error) {
                    this.logger.error(nextData.toString());
                    this.errHandler(nextData, data, cb);
                } else if (typeof this.chain[position] === "function") {
                    this.chain[position++](nextData as T, next);
                } else {
                    cb(nextData as T);
                }
            };
            next(data);
        };
    }
}
