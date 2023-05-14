import { RedisConfig } from "./types";
import SecureStore from "secure-store-redis";
import debug from "debug";

const log = debug("sockethub:data-layer:checks");

export async function redisCheck(config: RedisConfig) {
    log("checking redis connection");
    const ss = new SecureStore({
        redis: config,
    });
    await ss.init();
}
