import debug from "debug";

/** Disable namespaces that log raw credentials or recursively serialize client input. */
export default function disablePayloadDebug() {
    debug.enable(
        `${debug.disable()},-socket.io:socket,-socket.io-parser,-engine:ws,-engine:polling`,
    );
}

// debug.enable also updates DEBUG, so subsequently loaded debug copies inherit it.
disablePayloadDebug();
