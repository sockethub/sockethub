import type { AnyActivityStream } from "../lib/sockethub";

declare module "$components/chat/IncomingMessages.svelte" {
    export function displayMessage(
        msg: AnyActivityStream,
        isLocal: boolean,
    ): void;
    export default class IncomingMessages extends SvelteComponent {}
}

declare module "$components/logs/Logger.svelte" {
    export function addObject(
        label: string,
        obj: AnyActivityStream,
        isResponse?: boolean,
    ): AnyActivityStream;
    export default class Logger extends SvelteComponent {}
}

declare module "@sockethub/client" {
    export default class SockethubClient {
        socket: unknown;
        constructor(socket: unknown);
    }
}
