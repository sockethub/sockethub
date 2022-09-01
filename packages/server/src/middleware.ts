import {IActivityStream} from "@sockethub/schemas";

export default function middleware(name: string): MiddlewareChain {
  return new MiddlewareChain(name);
}

export interface MiddlewareChainInterface {
  (data: IActivityStream): Promise<IActivityStream>;
}

interface ErrorHandlerInterface {
  (err: Error, data?: unknown, cb?: unknown): Promise<IActivityStream>;
}

export interface LogErrorInterface {
  (msg: Error): void;
}

export class MiddlewareChain {
  public name: string;
  private chain: Array<MiddlewareChainInterface> = [];
  private errHandler: ErrorHandlerInterface = (err: Error) => { throw err; };

  constructor(name: string) {
    this.name = name;
  }

  use(func: ErrorHandlerInterface | MiddlewareChainInterface): this {
    if (typeof func !== 'function') {
      throw new Error('middleware use() can only take a function as an argument');
    }
    if (func.length === 2) {
      this.errHandler = func as ErrorHandlerInterface;
    } else if (func.length === 1) {
      this.chain.push(func as MiddlewareChainInterface);
    } else {
      throw new Error(
        'middleware function provided with incorrect number of params: ' + func.length);
    }
    return this;
  }

  done() {
    return async (data: any) => {
      let currData = data;
      for (let i = 0; i < this.chain.length; i++) {
        try {
          currData = await this.chain[i](currData);
        } catch (err) {
          currData = await this.errHandler(err, currData);
          break;
        }
      }
      return currData;
    };
  }
}
