declare module "irc-socket-sasl" {
    export interface IrcSocketInstance {
        end?: () => void;
        raw: (message: string) => void;
        once: (
            event: string,
            handler: (...args: Array<unknown>) => void,
        ) => void;
        on: (event: string, handler: (...args: Array<unknown>) => void) => void;
        connect: () => Promise<unknown>;
    }
    const IrcSocket: new (...args: Array<unknown>) => IrcSocketInstance;
    export default IrcSocket;
}

declare module "@sockethub/irc2as" {
    export class IrcToActivityStreams {
        constructor(options: { server: string });
        input(data: unknown): void;
        events: {
            on(event: string, handler: (...args: Array<unknown>) => void): void;
        };
    }
}

declare module "./octal-hack.js" {
    const buildCommand: (input: string) => string;
    export default buildCommand;
}
