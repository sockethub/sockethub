import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isBlockedAddress } from "@sockethub/util/net";

// Pin the checked address so protocol-library DNS resolution cannot bypass the guard.
export async function mailHost(
    host: string,
    allowPrivate: boolean,
): Promise<string> {
    const addresses = isIP(host)
        ? [{ address: host }]
        : await lookup(host, { all: true });
    if (
        !addresses.length ||
        (!allowPrivate &&
            addresses.some(({ address }) => isBlockedAddress(address)))
    ) {
        throw new Error("email:blocked-server-address");
    }
    return addresses[0].address;
}
