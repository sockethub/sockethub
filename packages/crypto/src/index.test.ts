import {expect, describe, it, beforeEach, afterEach} from "bun:test";
import * as sinon from "sinon";

import { getPlatformId, Crypto } from "./index";

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
