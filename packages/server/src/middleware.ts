import { debug } from 'debug';
import {IActivityStream} from "@sockethub/schemas";

export default function middleware(name: string): MiddlewareChain {
  return new MiddlewareChain(name);
}

export interface MiddlewareChainInterface {
  (error: IActivityStream | Error,
    data?: IActivityStream | MiddlewareChainInterface,
    next?: MiddlewareChainInterface): void;
}

interface ErrorHandlerInterface {
  (err: Error, data?: unknown, cb?: unknown): void;
}

export interface LogErrorInterface {
  (msg: Error): void;
}

export class MiddlewareChain {
  public name: string;
  private chain: Array<MiddlewareChainInterface> = [];
  private errHandler: ErrorHandlerInterface = (err: Error) => { throw err; };
  private readonly logger: LogErrorInterface;

  constructor(name: string) {
    this.name = name;
    this.logger = debug(`sockethub:middleware:${name}`);
  }

  use(func: ErrorHandlerInterface | MiddlewareChainInterface): this {
    if (typeof func !== 'function') {
      throw new Error('middleware use() can only take a function as an argument');
    }
    if (func.length === 3) {
      this.errHandler = func as ErrorHandlerInterface;
    } else if (func.length === 2) {
      this.chain.push(func as MiddlewareChainInterface);
    } else {
      throw new Error(
        'middleware function provided with incorrect number of params: ' + func.length);
    }
    return this;
  }

  done() {
    return (data: IActivityStream, callback: MiddlewareChainInterface) => {
      let position = 0;
      if (typeof callback !== 'function') {
        callback = () => {
          // ensure we have a callback function
        };
      }
      const next = (_data: unknown) => {
        if (_data instanceof Error) {
          this.logger(_data);
          this.errHandler(_data, data, callback);
        } else if (typeof this.chain[position] === 'function') {
          this.chain[position++](_data as IActivityStream, next);
        } else {
          callback(_data as IActivityStream);
        }
      };
      next(data);
    };
  }
}
