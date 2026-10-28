import debug from "debug";

/** Disable namespaces that log raw payloads or session IDs, or recurse over client input. */
export default function disablePayloadDebug() {
    debug.enable(
        `${debug.disable()},-socket.io:socket,-socket.io-parser,-engine:ws,-engine:polling,-engine:socket,-engine`,
    );
}

// debug.enable also updates DEBUG, so subsequently loaded debug copies inherit it.
disablePayloadDebug();
