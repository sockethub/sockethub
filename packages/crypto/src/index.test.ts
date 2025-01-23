import "https://deno.land/x/deno_mocha/global.ts";
import { ActivityStream } from "@sockethub/schemas";
import { Crypto } from "./index.ts";
import { assertEquals } from "https://deno.land/std/testing/asserts.ts";

const secret = "a test secret.. that is 16 x 2..";
const data: ActivityStream = { foo: "bar" } as unknown as ActivityStream;
const encryptedData =
  "00000000000000000000000000000000:88af14af85acf2795eb062a56a88edb2";


describe("crypto", () => {
  let crypto: Crypto;
  beforeEach(() => {
    crypto = new Crypto();
  });

  it("encrypts", () => {
    assertEquals(crypto.encrypt(data, secret), encryptedData);
  });

  it("decrypts", () => {
    assertEquals(crypto.decrypt(encryptedData, secret), data);
  });

  it("hashes", () => {
    assertEquals(crypto.hash("foobar"), "8843d7f");
  });

  //     // it("randTokens 8", () => {
  //     //     const token = crypto.randToken(8);
  //     //     assertEquals(token.length, 8);
  //     // });
  //     //
  //     // it("randTokens 16", () => {
  //     //     const token = crypto.randToken(16);
  //     //     assertEquals(token.length, 16);
  //     // });
  //     //
  //     // it("randTokens 32", () => {
  //     //     const token = crypto.randToken(32);
  //     //     assertEquals(token.length, 32);
  //     // });
  //     //
  //     // it("randTokens 33+ will fail", () => {
  //     //     assertThrows(() => {
  //     //         crypto.randToken(33);
  //     //     });
  //     // });
});

// describe("getPlatformId", () => {
//     let cryptoHashStub: any;
//     let crypto;
//
//     beforeEach(() => {
//         cryptoHashStub = sinon.mock();
//         class TestCrypto extends Crypto {
//             createRandomBytes() {
//                 this.randomBytes = () => Buffer.alloc(16);
//             }
//         }
//         crypto = new TestCrypto();
//         cryptoHashStub = sinon.stub(crypto, "hash");
//         cryptoHashStub.returnsArg(0);
//     });
//
//     afterEach(() => {
//         cryptoHashStub.restore();
//     });
//
//     it("generates platform hash", () => {
//         expect(getPlatformId("foo", undefined, crypto)).to.be.equal("foo");
//         sinon.assert.calledOnce(cryptoHashStub);
//         sinon.assert.calledWith(cryptoHashStub, "foo");
//     });
//     it("generates platform + actor hash", () => {
//         expect(getPlatformId("foo", "bar", crypto)).to.be.equal("foobar");
//         sinon.assert.calledOnce(cryptoHashStub);
//         sinon.assert.calledWith(cryptoHashStub, "foobar");
//     });
// });
