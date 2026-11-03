import type { AnyActivityStream } from "../lib/sockethub";

declare module "$components/chat/IncomingMessages.svelte" {
    export function displayMessage(
        msg: AnyActivityStream,
        isLocal: boolean,
    ): void;
    const IncomingMessages: import("svelte").Component;
    export default IncomingMessages;
}

declare module "$components/logs/Logger.svelte" {
    export function addObject(
        label: string,
        obj: AnyActivityStream,
        isResponse?: boolean,
    ): AnyActivityStream;
    const Logger: import("svelte").Component;
    export default Logger;
}
