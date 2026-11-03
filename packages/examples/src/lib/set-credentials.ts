import type SockethubClient from "@sockethub/client";
import type { CredentialsObject } from "@sockethub/schemas";
import { emitWithAck } from "./emit-with-ack";

/** Wait for credential acceptance without locking the form through a disconnect. */
export async function setCredentials(
    socket: SockethubClient["socket"],
    credentials: CredentialsObject,
): Promise<void> {
    const response = await emitWithAck(socket, "credentials", credentials);
    if (response?.error) throw new Error(response.error);
}
