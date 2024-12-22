import { assertEquals } from "jsr:@std/assert";
import { Config } from "./config.ts";

Deno.test("loads default values", () => {
  const config = new Config();
  assertEquals(typeof config.get, "function");
  assertEquals(config.get("sockethub:host"), "localhost");
});

Deno.test("overrides from env", () => {
  const hostname = "a host string";
  Deno.env.set("HOST", hostname);
  const config = new Config();
  assertEquals(config.get("sockethub:host"), hostname);
});

Deno.test("defaults to redis config", () => {
  Deno.env.set("REDIS_URL", "");
  const config = new Config();
  assertEquals(config.get("redis"), { url: "redis://127.0.0.1:6379" });
});

Deno.test("redis config overridden by env var", () => {
  Deno.env.set("REDIS_URL", "foobar");
  const config = new Config();
  assertEquals(config.get("redis"), { url: "foobar" });
});
