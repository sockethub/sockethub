import type SockethubClient from "@sockethub/client";
import type { AnyActivityStream } from "./sockethub";

/** Bound acknowledgement waits; an uncertain send must never be retried automatically. */
export function emitWithAck(
    socket: SockethubClient["socket"],
    event: "credentials" | "message",
    activity: unknown,
): Promise<AnyActivityStream | undefined> {
    return new Promise((resolve, reject) => {
        if (!socket.connected) {
            reject(
                new Error(
                    "Sockethub is disconnected. Reconnect and try again.",
                ),
            );
            return;
        }
        let settled = false;
        const credential = event === "credentials";
        const timer = setTimeout(
            () =>
                finish(
                    new Error(
                        credential
                            ? "Credential acknowledgement timed out. Try again."
                            : "Message acknowledgement timed out; delivery is unknown. Do not retry automatically.",
                    ),
                ),
            credential ? 10_000 : 30_000,
        );
        const disconnected = () =>
            finish(
                new Error(
                    credential
                        ? "Disconnected before credentials were acknowledged. Try again."
                        : "Disconnected before message acknowledgement; delivery is unknown. Do not retry automatically.",
                ),
            );
        function finish(error?: Error, response?: AnyActivityStream): void {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.off("disconnect", disconnected);
            if (error) reject(error);
            else resolve(response);
        }
        socket.on("disconnect", disconnected);
        try {
            socket.emit(event, activity, (response?: AnyActivityStream) =>
                finish(undefined, response),
            );
        } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
        }
    });
}
