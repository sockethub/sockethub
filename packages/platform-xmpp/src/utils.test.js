import "https://deno.land/x/deno_mocha/global.ts";
import { assertEquals } from "jsr:@std/assert";
import utils from "./utils.js";

describe("Utils", () => {
  describe("buildXmppCredentials", () => {
    it("returns correct credential object used for xmpp.js connect", () => {
      assertEquals(
        utils.buildXmppCredentials({
          object: {
            userAddress: "barney@dinosaur.com.au",
            password: "bar",
            resource: "Home",
          },
        }),
        {
          password: "bar",
          service: "dinosaur.com.au",
          username: "barney",
          resource: "Home",
        },
      );
    });
  });
  it("allows overriding server value", () => {
    assertEquals(
      utils.buildXmppCredentials({
        object: {
          userAddress: "barney@dinosaur.com.au",
          server: "foo",
          password: "bar",
          resource: "Home",
        },
      }),
      {
        password: "bar",
        service: "foo",
        username: "barney",
        resource: "Home",
      },
    );
  });
  it("allows a custom port", () => {
    assertEquals(
      utils.buildXmppCredentials({
        object: {
          userAddress: "barney@dinosaur.com.au",
          port: 123,
          password: "bar",
          resource: "Home",
        },
      }),
      {
        password: "bar",
        service: "dinosaur.com.au:123",
        username: "barney",
        resource: "Home",
      },
    );
  });
});
