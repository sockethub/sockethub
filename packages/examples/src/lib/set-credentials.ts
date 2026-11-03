import type SockethubClient from "@sockethub/client";
import type { CredentialsObject } from "@sockethub/schemas";

/** Wait for credential acceptance without locking the form through a disconnect. */
export function setCredentials(
    socket: SockethubClient["socket"],
    credentials: CredentialsObject,
): Promise<void> {
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
        const timer = setTimeout(
            () =>
                finish(
                    new Error(
                        "Credential acknowledgement timed out. Try again.",
                    ),
                ),
            10_000,
        );
        const disconnected = () =>
            finish(
                new Error(
                    "Disconnected before credentials were acknowledged. Try again.",
                ),
            );
        function finish(error?: Error): void {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.off("disconnect", disconnected);
            if (error) reject(error);
            else resolve();
        }
        socket.on("disconnect", disconnected);
        try {
            socket.emit(
                "credentials",
                credentials,
                (response?: { error?: string }) => {
                    finish(
                        response?.error ? new Error(response.error) : undefined,
                    );
                },
            );
        } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
        }
    });
}
