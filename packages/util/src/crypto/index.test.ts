import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as sinon from "sinon";
import { SecretValidator } from "secure-store-redis";

import { Crypto, getPlatformId } from "./index";

const secret = "a test secret.. that is 16 x 2..";
const data = { foo: "bar" };
const encryptedData =
    "00000000000000000000000000000000:0543ec94d863fbf4b7a19b48e69d9317";

describe("crypto", () => {
    let crypto;
    beforeEach(() => {
        class TestCrypto extends Crypto {
            createRandomBytes() {
                this.randomBytes = () => Buffer.alloc(16);
            }
        }
        crypto = new TestCrypto();
    });

    it("encrypts", () => {
        expect(crypto.encrypt(data, secret)).toEqual(encryptedData);
    });

    it("decrypts", () => {
        expect(crypto.decrypt(encryptedData, secret)).toEqual(data);
    });

    it("hashes", () => {
        expect(crypto.hash("foobar")).toEqual("8843d7f");
    });

    it("randTokens 8", () => {
        const token = crypto.randToken(8);
        expect(token.length).toEqual(8);
    });

    it("randTokens 16", () => {
        const token = crypto.randToken(16);
        expect(token.length).toEqual(16);
    });

    it("randTokens 32", () => {
        const token = crypto.randToken(32);
        expect(token.length).toEqual(32);
    });

    it("randTokens 33+ will fail", () => {
        expect(() => {
            crypto.randToken(33);
        }).toThrow();
    });

    describe("deriveSecret", () => {
        it("returns a 32-char string", () => {
            const result = crypto.deriveSecret("secret1", "secret2");
            expect(result.length).toEqual(32);
        });

        it("returns a validator-safe secret", () => {
            const result = crypto.deriveSecret("secret1", "secret2");
            const validation = SecretValidator.validate(result);
            expect(validation.valid).toEqual(true);
        });

        it("is deterministic - same inputs produce same output", () => {
            const result1 = crypto.deriveSecret("foo", "bar");
            const result2 = crypto.deriveSecret("foo", "bar");
            expect(result1).toEqual(result2);
        });

        it("is deterministic - known input/output pair (2 args)", () => {
            const result = crypto.deriveSecret("parent123", "session456");
            expect(result).toEqual("uX5MIvHKtFdxZvLbHt0F7G&ufOt0a*hQ");
        });

        it("is deterministic - known input/output pair (3 args)", () => {
            const result = crypto.deriveSecret("a", "b", "c");
            expect(result).toEqual("1ZSGTK2%WDHR98osAZ4oc8&Bw14VFow&");
        });

        it("returns different results for different inputs", () => {
            const result1 = crypto.deriveSecret("foo", "bar");
            const result2 = crypto.deriveSecret("foo", "baz");
            expect(result1).not.toEqual(result2);
        });

        it("works with single secret", () => {
            const result = crypto.deriveSecret("single");
            expect(result.length).toEqual(32);
        });

        it("works with multiple secrets", () => {
            const result = crypto.deriveSecret("a", "b", "c", "d");
            expect(result.length).toEqual(32);
        });

        it("produces valid 70-char set characters", () => {
            const result = crypto.deriveSecret("test", "secret");
            // Uses A-Za-z0-9!@#$%^&*
            expect(result).toMatch(/^[A-Za-z0-9!@#$%^&*]{32}$/);
        });
    });
});

describe("getPlatformId", () => {
    let cryptoHashStub: any;
    let crypto;

    beforeEach(() => {
        cryptoHashStub = sinon.mock();
        class TestCrypto extends Crypto {
            createRandomBytes() {
                this.randomBytes = () => Buffer.alloc(16);
            }
        }
        crypto = new TestCrypto();
        cryptoHashStub = sinon.stub(crypto, "hash");
        cryptoHashStub.returnsArg(0);
    });

    afterEach(() => {
        cryptoHashStub.restore();
    });

    it("generates platform hash", () => {
        expect(getPlatformId("foo", undefined, crypto)).toEqual("foo");
        sinon.assert.calledOnce(cryptoHashStub);
        sinon.assert.calledWith(cryptoHashStub, "foo");
    });
    it("generates platform + actor hash", () => {
        expect(getPlatformId("foo", "bar", crypto)).toEqual("foobar");
        sinon.assert.calledOnce(cryptoHashStub);
        sinon.assert.calledWith(cryptoHashStub, "foobar");
    });
});
