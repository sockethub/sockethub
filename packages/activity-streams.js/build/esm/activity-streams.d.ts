/*!
 * activity-streams
 *   https://github.com/silverbucket/activity-streams
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net>
 *
 * activity-streams is released under the MIT (see LICENSE).
 *
 * You don't have to do anything special to choose one license or the other
 * and you don't have to notify anyone which license you are using.
 * Please see the corresponding license file for details of these licenses.
 * You are free to use, modify and distribute this software, but all copyright
 * information must remain.
 *
 */
export interface ActivityObjectManager {
    create(obj: unknown): unknown;
    delete(id: string): boolean;
    list(): IterableIterator<any>;
    get(id: string, expand?: boolean): unknown;
}
export interface ASFactoryOptions {
    specialObjs?: Array<string>;
    failOnUnknownObjectProperties?: boolean;
    warnOnUnknownObjectProperties?: boolean;
    customProps?: any;
}
interface ASManager {
    Stream(meta: unknown): unknown;
    Object: ActivityObjectManager;
    emit(event: any, obj: any): void;
    on(event: any, func: any): void;
    once(event: any, func: any): void;
    off(event: any, funcName: any): void;
}
export default function ASFactory(opts?: ASFactoryOptions): ASManager;
export {};
