export interface XmppElement {
    name: string;
    attrs: Record<string, string | undefined>;
    children: Array<XmppElement | string>;
    is(name: string, xmlns?: string): boolean;
    getText(): string;
    toString(): string;
    getChild(name: string, xmlns?: string): XmppElement | undefined;
    getChildren(name: string): XmppElement[];
    getChildText(name: string): string | null;
}

declare module "@xmpp/client" {
    export interface XmppElement {
        name: string;
        attrs: Record<string, string | undefined>;
        children: Array<XmppElement | string>;
        is(name: string, xmlns?: string): boolean;
        getText(): string;
        toString(): string;
        getChild(name: string, xmlns?: string): XmppElement | undefined;
        getChildren(name: string): XmppElement[];
        getChildText(name: string): string | null;
    }

    export interface XmppSocket {
        writable: boolean;
    }

    export interface XmppClientInstance {
        socket?: XmppSocket;
        status: string;
        on(event: string, handler: (...args: unknown[]) => void): void;
        removeAllListeners(): void;
        start(): Promise<void>;
        stop(): Promise<void>;
        send(element: XmppElement): Promise<void>;
    }

    export interface XmppClientOptions {
        service: string;
        username: string;
        password: string;
        resource?: string;
        timeout?: number;
        tls?: boolean;
    }

    export function client(options: XmppClientOptions): XmppClientInstance;
    export function xml(
        name: string,
        attrs?: Record<string, string | undefined>,
        ...children: (XmppElement | undefined)[]
    ): XmppElement;
}

declare module "@xmpp/xml/lib/parse.js" {
    import type { XmppElement } from "@xmpp/client";
    function parse(xml: string): XmppElement;
    export default parse;
}
