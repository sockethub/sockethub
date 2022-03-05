import { debug } from 'debug';

export default function middleware(name: string): MiddlewareChain {
  return new MiddlewareChain(name);
}

export class MiddlewareChain {
  public name: string;
  private chain: Array<Function> = [];
  private errHandler: Function = (err: Error) => { throw err; };
  private logger: Function;

  constructor(name: string) {
    this.name = name;
    this.logger = debug(`sockethub:middleware:${name}`);
  }

  use(func: Function): this {
    if (typeof func !== 'function') {
      throw new Error('middleware use() can only take a function as an argument');
    }
    if (func.length === 3) {
      this.errHandler = func;
    } else if (func.length === 2) {
      this.chain.push(func);
    } else {
      throw new Error(
        'middleware function provided with incorrect number of params: ' + func.length);
    }
    return this;
  }

  done() {
    return (data: any, callback: Function) => {
      let position = 0;
      if (typeof callback !== 'function') {
        callback = () => {};
      }
      const next = (_data: any) => {
        if (_data instanceof Error) {
          this.logger(_data);
          this.errHandler(_data, data, callback);
        } else if (typeof this.chain[position] === 'function') {
          this.chain[position++](_data, next);
        } else {
          callback(_data);
        }
      };
      next(data);
    };
  }
}
